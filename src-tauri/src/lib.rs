use serde::Serialize;
use std::{collections::HashMap, path::{Path, PathBuf}, process::Stdio, time::Duration};
use tauri::{ipc::Channel, AppHandle, Manager};
mod workspace;
use tokio::{io::{AsyncBufReadExt, BufReader}, process::Command};

#[derive(Clone, Serialize)]
#[serde(tag = "kind", content = "data")]
enum RunEvent { Stdout(String), Stderr(String), Exit(i32), Error(String) }

type Paths = HashMap<String, String>;

/// One language the run blocks can use. Templates may contain {exe} (the program that was found or set by hand), {src} (full path of the
/// source file), {file} (just its name; the working directory is the temp folder) and {out} (the compiled program).
struct Lang {
    ext: &'static str,
    /// Program names to try, in order, when nothing was set by hand (on Windows each is also tried with .cmd/.bat).
    exe: &'static [&'static str],
    /// Arguments that make the program print its version (used to tell that it works).
    probe: &'static [&'static str],
    compile: Option<&'static [&'static str]>,
    run: &'static [&'static str],
}

#[cfg(windows)] const PYTHON: &[&str] = &["python", "py"];
#[cfg(not(windows))] const PYTHON: &[&str] = &["python3", "python"];
/// How long a run (compile + run) may take; the first .NET build is slow.
const RUN_SECS: u64 = 60;
const V: &[&str] = &["--version"];
const NATIVE: &[&str] = &["{out}"];

// To add a language: one line here, one in RUN_LANGS in src/langs.ts (same name), and a Monaco language for colours in src/monaco.ts.
const LANGS: &[(&str, Lang)] = &[
    ("c",          Lang { ext: "c",     exe: &["cc", "gcc", "clang"],     probe: V,              compile: Some(&["{exe}", "{src}", "-o", "{out}"]), run: NATIVE }),
    ("cpp",        Lang { ext: "cpp",   exe: &["c++", "g++", "clang++"],   probe: V,              compile: Some(&["{exe}", "{src}", "-o", "{out}"]), run: NATIVE }),
    ("rust",       Lang { ext: "rs",    exe: &["rustc"],                   probe: V,              compile: Some(&["{exe}", "{src}", "-o", "{out}"]), run: NATIVE }),
    ("go",         Lang { ext: "go",    exe: &["go"],                      probe: &["version"],   compile: None, run: &["{exe}", "run", "{src}"] }),
    ("python",     Lang { ext: "py",    exe: PYTHON,                       probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("java",       Lang { ext: "java",  exe: &["java"],                    probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("node",       Lang { ext: "js",    exe: &["node"],                    probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("typescript", Lang { ext: "ts",    exe: &["deno"],                    probe: V,              compile: None, run: &["{exe}", "run", "-A", "--quiet", "{src}"] }),
    ("zig",        Lang { ext: "zig",   exe: &["zig"],                     probe: &["version"],   compile: None, run: &["{exe}", "run", "{src}"] }),
    ("odin",       Lang { ext: "odin",  exe: &["odin"],                    probe: &["version"],   compile: Some(&["{exe}", "build", "{src}", "-file", "-out:{out}"]), run: NATIVE }),
    ("nim",        Lang { ext: "nim",   exe: &["nim"],                     probe: V,              compile: None, run: &["{exe}", "r", "--hints:off", "--verbosity:0", "{src}"] }),
    ("csharp",     Lang { ext: "cs",    exe: &["dotnet"],                  probe: V,              compile: None, run: &["{exe}", "run", "{src}"] }),
    ("kotlin",     Lang { ext: "kts",   exe: &["kotlinc"],                 probe: &["-version"],  compile: None, run: &["{exe}", "-script", "{src}"] }),
    ("swift",      Lang { ext: "swift", exe: &["swift"],                   probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("dart",       Lang { ext: "dart",  exe: &["dart"],                    probe: V,              compile: None, run: &["{exe}", "run", "{src}"] }),
    ("ruby",       Lang { ext: "rb",    exe: &["ruby"],                    probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("lua",        Lang { ext: "lua",   exe: &["lua", "lua5.4", "luajit"], probe: &["-v"],        compile: None, run: &["{exe}", "{src}"] }),
    ("php",        Lang { ext: "php",   exe: &["php"],                    probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("perl",       Lang { ext: "pl",    exe: &["perl"],                   probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("r",          Lang { ext: "R",     exe: &["Rscript"],                probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("julia",      Lang { ext: "jl",    exe: &["julia"],                   probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("elixir",     Lang { ext: "exs",   exe: &["elixir"],                  probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("haskell",    Lang { ext: "hs",    exe: &["runghc"],                  probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("ocaml",      Lang { ext: "ml",    exe: &["ocaml"],                   probe: &["-version"],  compile: None, run: &["{exe}", "{src}"] }),
    ("bash",       Lang { ext: "sh",    exe: &["bash"],                    probe: V,              compile: None, run: &["{exe}", "{src}"] }),
    ("powershell", Lang { ext: "ps1",   exe: &["pwsh", "powershell"],      probe: &["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], compile: None, run: &["{exe}", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "{src}"] }),
    ("sql",        Lang { ext: "sql",   exe: &["sqlite3"],                 probe: V,              compile: None, run: &["{exe}", ":memory:", ".read {file}"] }),
];

/// Appended to Java sources that call Trace.step(...). Java 11+ runs a single file directly (`java main.java`),
/// and the first class in the file is the one that runs, so this helper goes after the author's code.
const JAVA_TRACE: &str = r#"
final class Trace {
    static final int NONE = Integer.MIN_VALUE;
    static void step(String op, int[] a, int... hl) { emit(op, a, hl, NONE, NONE); }
    static void state(String op, int[] a, int sorted, int key, int... hl) { emit(op, a, hl, sorted, key); }
    private static int line() {
        for (StackTraceElement e : new Throwable().getStackTrace())
            if (!e.getClassName().equals("Trace")) return e.getLineNumber();
        return -1;
    }
    private static void emit(String op, int[] a, int[] hl, int sorted, int key) {
        StringBuilder s = new StringBuilder("@itsd {\"op\":\"").append(op).append("\",\"a\":[");
        for (int i = 0; i < a.length; i++) s.append(i > 0 ? "," : "").append(a[i]);
        s.append("],\"hl\":[");
        for (int i = 0; i < hl.length; i++) s.append(i > 0 ? "," : "").append(hl[i]);
        s.append("]");
        if (sorted != NONE) s.append(",\"sorted\":").append(sorted);
        if (key != NONE) s.append(",\"key\":").append(key);
        int ln = line();
        if (ln > 0) s.append(",\"line\":").append(ln);
        System.out.println(s.append("}"));
    }
}
"#;

/// Appended to C# sources that call Trace.State(...) / Trace.Step(...). .NET 10+ runs a single .cs file directly (`dotnet run main.cs`);
/// top-level statements must come first, so this helper goes after the author's code, like JAVA_TRACE.
const CSHARP_TRACE: &str = r#"
static class Trace {
    public const int None = int.MinValue;
    public static void Step(string op, int[] a, params int[] hl) { Emit(op, a, hl, None, None); }
    public static void State(string op, int[] a, int sorted, int key, params int[] hl) { Emit(op, a, hl, sorted, key); }
    static void Emit(string op, int[] a, int[] hl, int sorted, int key) {
        var s = new System.Text.StringBuilder("@itsd {\"op\":\"" + op + "\",\"a\":[" + string.Join(",", a) + "],\"hl\":[" + string.Join(",", hl) + "]");
        if (sorted != None) s.Append(",\"sorted\":" + sorted);
        if (key != None) s.Append(",\"key\":" + key);
        int ln = new System.Diagnostics.StackTrace(2, true).GetFrame(0)?.GetFileLineNumber() ?? 0;
        if (ln > 0) s.Append(",\"line\":" + ln);
        System.Console.WriteLine(s.Append("}"));
    }
}
"#;

fn lang_for(name: &str) -> Option<(&'static str, &'static Lang)> {
    // the frontend sends the canonical id; the common fence names still work if something else calls this
    let n = match name { "py" => "python", "js" | "javascript" => "node", "rs" => "rust", "c++" => "cpp", "ts" | "deno" => "typescript", other => other };
    LANGS.iter().find(|(id, _)| *id == n).map(|(id, l)| (*id, l))
}

async fn exec(args: Vec<String>, cwd: &Path, ch: &Channel<RunEvent>) -> Result<i32, String> {
    let mut child = Command::new(&args[0])
        .args(&args[1..])
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("couldn't start `{}`: {e}", args[0]))?;

    let out = BufReader::new(child.stdout.take().unwrap());
    let err = BufReader::new(child.stderr.take().unwrap());
    let (c1, c2) = (ch.clone(), ch.clone());
    let t1 = tokio::spawn(async move {
        let mut l = out.lines();
        while let Ok(Some(s)) = l.next_line().await { let _ = c1.send(RunEvent::Stdout(s)); }
    });
    let t2 = tokio::spawn(async move {
        let mut l = err.lines();
        while let Ok(Some(s)) = l.next_line().await { let _ = c2.send(RunEvent::Stderr(s)); }
    });
    let status = tokio::time::timeout(Duration::from_secs(RUN_SECS), child.wait())
        .await
        .map_err(|_| format!("timed out after {RUN_SECS}s"))?
        .map_err(|e| e.to_string())?;
    let _ = tokio::join!(t1, t2);
    Ok(status.code().unwrap_or(-1))
}

// ---- finding a language's program -------------------------------------------------------------------------------------------------
// Normally the program is found on PATH. When it isn't (installed somewhere unusual, or PATH is not what the app was started with),
// Settings > Languages lets you point at it by hand: a program file, or the folder that holds it. A path set by hand is used as it is;
// if it doesn't work it is reported, never silently replaced by something else.

#[derive(Clone, Serialize)]
struct ToolInfo {
    id: String,
    ok: bool,
    /// What will be started: the path set by hand, or the program name that was found on PATH. Empty when nothing works.
    program: String,
    /// First line of the program's own version text.
    version: String,
    /// A path was set by hand for this language.
    manual: bool,
}

/// Names to try for a program: on Windows also with .cmd and .bat (npm-style shims and kotlinc.bat are not found by name alone).
fn names(l: &Lang) -> Vec<String> {
    let mut v = Vec::new();
    for e in l.exe {
        v.push(e.to_string());
        if cfg!(windows) { v.push(format!("{e}.exe")); v.push(format!("{e}.cmd")); v.push(format!("{e}.bat")); }
    }
    v
}

/// Run the program with its version arguments; the first line of what it prints says it works.
async fn probe(program: &str, args: &[&str]) -> Option<String> {
    let fut = Command::new(program).args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true).output();
    let out = tokio::time::timeout(Duration::from_secs(8), fut).await.ok()?.ok()?;
    if !out.status.success() { return None; }
    let text = format!("{}\n{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    Some(text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("works").chars().take(80).collect())
}

/// What a hand-set path can mean: the program itself, or a folder holding it (or holding a bin/ folder that does).
fn manual_candidates(l: &Lang, set: &str) -> Vec<String> {
    let p = PathBuf::from(set);
    if !p.is_dir() { return vec![set.to_string()]; }
    let mut v = Vec::new();
    for dir in [p.clone(), p.join("bin")] {
        for n in names(l) { let f = dir.join(&n); if f.is_file() { v.push(f.to_string_lossy().to_string()); } }
    }
    v
}

fn clean(p: &str) -> String { p.trim().trim_matches('"').to_string() }

async fn resolve(id: &str, l: &Lang, paths: &Paths) -> ToolInfo {
    let none = |manual: bool| ToolInfo { id: id.to_string(), ok: false, program: String::new(), version: String::new(), manual };
    if let Some(set) = paths.get(id).map(|p| clean(p)).filter(|p| !p.is_empty()) {
        for c in manual_candidates(l, &set) {
            if let Some(v) = probe(&c, l.probe).await { return ToolInfo { id: id.to_string(), ok: true, program: c, version: v, manual: true }; }
        }
        return ToolInfo { program: set, ..none(true) };
    }
    for n in names(l) {
        if let Some(v) = probe(&n, l.probe).await { return ToolInfo { id: id.to_string(), ok: true, program: n, version: v, manual: false }; }
    }
    none(false)
}

async fn scan(paths: Paths) -> Vec<ToolInfo> {
    let tasks: Vec<_> = LANGS.iter().map(|(id, l)| { let p = paths.clone(); tokio::spawn(async move { resolve(id, l, &p).await }) }).collect();
    let mut v = Vec::new();
    for t in tasks { if let Ok(i) = t.await { v.push(i); } }
    v
}

/// Which languages work, by id. Used at start-up and whenever a path in Settings changes.
#[tauri::command]
async fn check_toolchains(lang_paths: Option<Paths>) -> HashMap<String, bool> {
    scan(lang_paths.unwrap_or_default()).await.into_iter().map(|i| (i.id, i.ok)).collect()
}

/// The same with details (program, version, hand-set or not) for the Languages list in Settings.
#[tauri::command]
async fn tool_status(lang_paths: Option<Paths>) -> Vec<ToolInfo> {
    scan(lang_paths.unwrap_or_default()).await
}

/// Try one path for one language without saving it. Ok = the version line it printed.
#[tauri::command]
async fn test_tool(lang: String, path: String) -> Result<String, String> {
    let (_, l) = lang_for(&lang).ok_or("unknown language")?;
    let set = clean(&path);
    if set.is_empty() { return Err("no path".into()); }
    if !Path::new(&set).exists() { return Err(format!("`{set}` does not exist")); }
    let cands = manual_candidates(l, &set);
    if cands.is_empty() { return Err(format!("no {} program in that folder (looked for {})", lang, l.exe.join(", "))); }
    for c in &cands { if let Some(v) = probe(c, l.probe).await { return Ok(format!("{v}  ({c})")); } }
    Err(format!("`{}` did not answer to `{}`", cands[0], l.probe.join(" ")))
}

/// Folders worth looking in besides PATH: where installers and version managers usually put things.
fn search_dirs() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    let env = |k: &str| std::env::var_os(k).map(PathBuf::from);
    let home = env("HOME").or_else(|| env("USERPROFILE"));
    let mut roots: Vec<PathBuf> = Vec::new(); // folders whose children (and grandchildren) may hold the program
    if let Some(h) = &home {
        for r in [".cargo/bin", ".deno/bin", ".bun/bin", ".local/bin", "go/bin", ".ghcup/bin", ".nimble/bin", ".dotnet", ".dotnet/tools", "scoop/shims", ".pyenv/shims",
                  ".rbenv/shims", ".asdf/shims", ".nix-profile/bin", ".opam/default/bin", ".juliaup/bin", ".sdkman/candidates/java/current/bin", ".sdkman/candidates/kotlin/current/bin",
                  "flutter/bin", "fvm/default/bin", "zig", "odin", "bin"] { v.push(h.join(r)); }
        for r in [".sdkman/candidates", ".local/share", "AppData/Local/Programs", "scoop/apps"] { roots.push(h.join(r)); }
    }
    for k in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA", "ProgramData"] {
        if let Some(d) = env(k) { roots.push(if k == "LOCALAPPDATA" { d.join("Programs") } else { d.clone() }); if k == "ProgramData" { v.push(d.join("chocolatey/bin")); } }
    }
    #[cfg(windows)] for d in ["C:/", "C:/msys64/ucrt64/bin", "C:/msys64/mingw64/bin", "C:/mingw64/bin", "C:/Go/bin", "C:/tools"] { let p = PathBuf::from(d); if d.len() == 3 { roots.push(p) } else { v.push(p) } }
    #[cfg(not(windows))] {
        for d in ["/usr/local/bin", "/opt/homebrew/bin", "/usr/local/go/bin", "/snap/bin", "/usr/bin", "/usr/local/opt"] { v.push(PathBuf::from(d)); }
        for d in ["/opt", "/usr/lib/jvm", "/usr/local/Cellar", "/opt/homebrew/Cellar", "/Library/Frameworks"] { roots.push(PathBuf::from(d)); }
    }
    let mut budget = 800; // never wander through a huge disk
    for r in roots {
        let Ok(kids) = std::fs::read_dir(&r) else { continue };
        for k in kids.flatten().filter(|k| k.path().is_dir()) {
            let kp = k.path();
            for d in [kp.clone(), kp.join("bin")] { v.push(d); }
            if let Ok(g) = std::fs::read_dir(&kp) { for gk in g.flatten().filter(|g| g.path().is_dir()) { let gp = gk.path(); v.push(gp.join("bin")); v.push(gp.clone()); budget -= 1; if budget <= 0 { return v; } } }
        }
    }
    v
}

/// Look for a language's program on PATH and in the usual install folders; every one that answers is returned as (path, version).
#[tauri::command]
async fn find_tool(lang: String) -> Result<Vec<(String, String)>, String> {
    let (_, l) = lang_for(&lang).ok_or("unknown language")?;
    let mut seen = std::collections::HashSet::new();
    let mut found = Vec::new();
    for dir in search_dirs() {
        for n in names(l) {
            let f = dir.join(&n);
            if !f.is_file() { continue; }
            let key = std::fs::canonicalize(&f).unwrap_or(f.clone());
            if !seen.insert(key) { continue; }
            let s = f.to_string_lossy().to_string();
            if let Some(v) = probe(&s, l.probe).await { found.push((s, v)); }
        }
        if found.len() >= 8 { break; }
    }
    Ok(found)
}

#[tauri::command]
async fn run_code(lang: String, code: String, on_event: Channel<RunEvent>, lang_paths: Option<Paths>) -> Result<(), String> {
    let (id, l) = lang_for(&lang).ok_or_else(|| format!("unsupported language `{lang}`"))?;
    let info = resolve(id, l, &lang_paths.unwrap_or_default()).await;
    if !info.ok {
        let how = if info.manual { format!("the path set in Settings > Languages (`{}`) does not work", info.program) } else { format!("none of {} was found on PATH; set where it is in Settings > Languages", l.exe.join(", ")) };
        return Err(format!("no {id} here: {how}"));
    }
    let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let file = format!("main.{}", l.ext);
    let src = dir.path().join(&file);
    let out = dir.path().join(if cfg!(windows) { "main_out.exe" } else { "main_out" });
    let code = if id == "java" && code.contains("Trace.") { format!("{code}\n{JAVA_TRACE}") } else if id == "csharp" && code.contains("Trace.") { format!("{code}\n{CSHARP_TRACE}") } else { code };
    std::fs::write(&src, code).map_err(|e| e.to_string())?;
    let sub = |s: &&str| s.replace("{exe}", &info.program).replace("{src}", src.to_str().unwrap()).replace("{file}", &file).replace("{out}", out.to_str().unwrap());

    if let Some(c) = l.compile {
        let rc = exec(c.iter().map(sub).collect(), dir.path(), &on_event).await?;
        if rc != 0 { let _ = on_event.send(RunEvent::Exit(rc)); return Ok(()); }
    }
    let rc = exec(l.run.iter().map(sub).collect(), dir.path(), &on_event).await?;
    let _ = on_event.send(RunEvent::Exit(rc));
    Ok(())
}

/// Format source with the language's own formatter, if it is installed. Err means "not available", and the app falls back to a built-in tidy.
#[tauri::command]
async fn format_code(lang: String, code: String) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;
    let args: Vec<&str> = match lang.as_str() {
        "rust" | "rs" => vec!["rustfmt", "--edition", "2021", "--emit", "stdout"],
        "python" | "py" => vec!["black", "-q", "-"],
        "go" => vec!["gofmt"],
        "c" => vec!["clang-format", "--assume-filename=a.c"],
        "cpp" => vec!["clang-format", "--assume-filename=a.cpp"],
        "java" => vec!["clang-format", "--assume-filename=a.java"],
        _ => return Err("no formatter for this language".into()),
    };
    let mut child = Command::new(args[0]).args(&args[1..]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true)
        .spawn().map_err(|e| format!("couldn't start `{}`: {e}", args[0]))?;
    let mut stdin = child.stdin.take().unwrap();
    let input = code.into_bytes();
    let w = tokio::spawn(async move { let _ = stdin.write_all(&input).await; });
    let out = tokio::time::timeout(Duration::from_secs(10), child.wait_with_output()).await
        .map_err(|_| "formatter timed out".to_string())?.map_err(|e| e.to_string())?;
    let _ = w.await;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()); }
    String::from_utf8(out.stdout).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_deck(path: String) -> Result<String, String> { std::fs::read_to_string(path).map_err(|e| e.to_string()) }

#[tauri::command]
fn write_deck(path: String, content: String) -> Result<(), String> { std::fs::write(path, content).map_err(|e| e.to_string()) }

// ---- pictures: the Visual view keeps every image in an `assets` folder next to the deck ----

const IMG_EXT: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
const MAX_IMAGE: u64 = 64 * 1024 * 1024;
// Videos are only read (never imported), for the scoreboard module's `video=`. The whole file is held in memory, so keep clips small.
const VIDEO_EXT: &[&str] = &["mp4", "m4v", "webm", "ogv", "mov"];
const MAX_VIDEO: u64 = 512 * 1024 * 1024;

const FONT_EXT: &[&str] = &["ttf", "otf", "woff", "woff2"];
fn is_font(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).map(|e| FONT_EXT.contains(&e.to_ascii_lowercase().as_str())).unwrap_or(false)
}
fn is_image(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).map(|e| IMG_EXT.contains(&e.to_ascii_lowercase().as_str())).unwrap_or(false)
}
fn assets_dir(deck: &str) -> Result<PathBuf, String> {
    Path::new(deck).parent().map(|d| d.join("assets")).ok_or_else(|| "the deck has no folder".to_string())
}

/// Raw bytes of an image (or, for the scoreboard, video) file, handed to the webview as an ArrayBuffer (no JSON/base64 detour).
#[tauri::command]
fn read_binary(path: String) -> Result<tauri::ipc::Response, String> {
    let p = PathBuf::from(&path);
    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    let video = VIDEO_EXT.contains(&ext.as_str()) || SFX_EXT.contains(&ext.as_str());
    if !video && !is_image(&p) && !is_font(&p) { return Err("not an image, font, audio or video file".into()); }
    let len = std::fs::metadata(&p).map_err(|e| e.to_string())?.len();
    if video && len > MAX_VIDEO { return Err("video is larger than 512 MB".into()); }
    if !video && len > MAX_IMAGE { return Err("image is larger than 64 MB".into()); }
    std::fs::read(&p).map(tauri::ipc::Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let p = PathBuf::from(path);
    if p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("zip") || e.eq_ignore_ascii_case("itsdpak")) != Some(true) {
        return Err("only .zip or .itsdpak bundles can be written".into());
    }
    if bytes.len() > 512 * 1024 * 1024 {
        return Err("bundle is larger than 512 MB".into());
    }
    std::fs::write(p, bytes).map_err(|e| e.to_string())
}

/// A .zip / .itsdpak package, read whole so the editor can unpack it (see `write_bundle_file`).
#[tauri::command]
fn read_bundle(path: String) -> Result<tauri::ipc::Response, String> {
    let p = PathBuf::from(&path);
    if p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("zip") || e.eq_ignore_ascii_case("itsdpak")) != Some(true) {
        return Err("only .zip or .itsdpak packages can be opened".into());
    }
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > 512 * 1024 * 1024 { return Err("package is larger than 512 MB".into()); }
    std::fs::read(&p).map(tauri::ipc::Response::new).map_err(|e| e.to_string())
}

/// One file of an unpacked package, written under `dir`. A path that climbs out of `dir` is refused, and a file that already exists is left alone (so edits survive reopening the package).
#[tauri::command]
fn write_bundle_file(dir: String, rel: String, bytes: Vec<u8>) -> Result<(), String> {
    let rel_path = Path::new(&rel);
    if rel.is_empty() || rel_path.is_absolute() || rel_path.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
        return Err("the package contains an unsafe file path".into());
    }
    let dest = Path::new(&dir).join(rel_path);
    if dest.exists() { return Ok(()); }
    if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    std::fs::write(dest, bytes).map_err(|e| e.to_string())
}

/// Family names of the fonts installed on this computer, A to Z, for the font menus.
#[tauri::command]
async fn list_system_fonts() -> Vec<String> {
    tokio::task::spawn_blocking(|| {
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        let mut v: Vec<String> = db.faces().filter_map(|f| f.families.first().map(|(n, _)| n.clone())).collect();
        v.sort_by_key(|s| s.to_lowercase());
        v.dedup();
        v
    }).await.unwrap_or_default()
}

/// Copy a font file into `<deck folder>/assets/fonts/` and return the reference (`assets/fonts/Name.ttf`). Reuses an identical name.
#[tauri::command]
fn import_font(deck: String, src: String) -> Result<String, String> {
    let src = PathBuf::from(src);
    if !is_font(&src) { return Err("not a font file (.ttf, .otf, .woff, .woff2)".into()); }
    let dir = assets_dir(&deck)?.join("fonts");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = src.file_name().and_then(|n| n.to_str()).ok_or("bad file name")?;
    if let (Ok(a), Ok(b)) = (src.canonicalize(), dir.canonicalize()) {
        if a.parent() == Some(b.as_path()) { return Ok(format!("assets/fonts/{file}")); }
    }
    if std::fs::metadata(&src).map_err(|e| e.to_string())?.len() > MAX_IMAGE { return Err("font is larger than 64 MB".into()); }
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("ttf").to_ascii_lowercase();
    let mut stem: String = src.file_stem().and_then(|s| s.to_str()).unwrap_or("font").chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).collect();
    stem.truncate(60);
    if stem.trim_matches('-').is_empty() { stem = "font".into(); }
    let data = std::fs::read(&src).map_err(|e| e.to_string())?;
    for n in 1.. {
        let name = if n == 1 { format!("{stem}.{ext}") } else { format!("{stem}-{n}.{ext}") };
        let dest = dir.join(&name);
        if !dest.exists() {
            std::fs::write(&dest, &data).map_err(|e| e.to_string())?;
            return Ok(format!("assets/fonts/{name}"));
        }
        if std::fs::read(&dest).map(|d| d == data).unwrap_or(false) { return Ok(format!("assets/fonts/{name}")); }
    }
    unreachable!()
}

/// Copy an image into `<deck folder>/assets/` and return the reference to write in the deck (`assets/name.png`).
/// The same picture imported twice reuses one file; a different picture with the same name gets `-2`, `-3`, ...
#[tauri::command]
fn import_asset(deck: String, src: String) -> Result<String, String> {
    let src = PathBuf::from(src);
    if !is_image(&src) { return Err("not an image file".into()); }
    let dir = assets_dir(&deck)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = src.file_name().and_then(|n| n.to_str()).ok_or("bad file name")?;
    // Already in the assets folder: just reference it.
    if let (Ok(a), Ok(b)) = (src.canonicalize(), dir.canonicalize()) {
        if a.parent() == Some(b.as_path()) { return Ok(format!("assets/{file}")); }
    }
    if std::fs::metadata(&src).map_err(|e| e.to_string())?.len() > MAX_IMAGE { return Err("image is larger than 64 MB".into()); }
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("png").to_ascii_lowercase();
    let mut stem: String = src.file_stem().and_then(|s| s.to_str()).unwrap_or("image").chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).collect();
    stem.truncate(60);
    if stem.trim_matches('-').is_empty() { stem = "image".into(); }
    let data = std::fs::read(&src).map_err(|e| e.to_string())?;
    for n in 1.. {
        let name = if n == 1 { format!("{stem}.{ext}") } else { format!("{stem}-{n}.{ext}") };
        let dest = dir.join(&name);
        if !dest.exists() {
            std::fs::write(&dest, &data).map_err(|e| e.to_string())?;
            return Ok(format!("assets/{name}"));
        }
        if std::fs::read(&dest).map(|d| d == data).unwrap_or(false) { return Ok(format!("assets/{name}")); }
    }
    unreachable!()
}

/// Images already in `<deck folder>/assets/`, as deck references.
#[tauri::command]
fn list_assets(deck: String) -> Vec<String> {
    let Ok(dir) = assets_dir(&deck) else { return vec![] };
    let mut out: Vec<String> = std::fs::read_dir(dir).into_iter().flatten().flatten()
        .filter(|e| e.path().is_file() && is_image(&e.path()))
        .filter_map(|e| e.file_name().to_str().map(|n| format!("assets/{n}")))
        .collect();
    out.sort();
    out
}

// ---- sound effects: one folder the author points the app at (an app setting, not part of the deck) ----

const SFX_EXT: &[&str] = &["wav", "mp3", "ogg", "m4a", "flac", "aac", "opus", "webm"];
const MAX_SOUND: u64 = 48 * 1024 * 1024;
fn is_sound(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).map(|e| SFX_EXT.contains(&e.to_ascii_lowercase().as_str())).unwrap_or(false)
}

/// Raw bytes of a sound file for the webview to decode.
#[tauri::command]
fn read_sound(path: String) -> Result<tauri::ipc::Response, String> {
    let p = PathBuf::from(&path);
    if !is_sound(&p) { return Err("not a sound file".into()); }
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > MAX_SOUND { return Err("sound is larger than 48 MB".into()); }
    std::fs::read(&p).map(tauri::ipc::Response::new).map_err(|e| e.to_string())
}

/// Sound file names (not paths) in `dir`, one level deep.
#[tauri::command]
fn list_sounds(dir: String) -> Vec<String> {
    let mut out: Vec<String> = std::fs::read_dir(dir).into_iter().flatten().flatten()
        .filter(|e| e.path().is_file() && is_sound(&e.path()))
        .filter_map(|e| e.file_name().to_str().map(|n| n.to_string()))
        .collect();
    out.sort();
    out
}

// ---- video and audio blocks: streamed from disk through Tauri's asset protocol, so nothing big is held in memory ----

/// Let the webview stream this one file (`convertFileSrc(path)`). The scope starts empty and grows only with files the open deck names.
#[tauri::command]
fn allow_media(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;
    let p = PathBuf::from(&path);
    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if !VIDEO_EXT.contains(&ext.as_str()) && !SFX_EXT.contains(&ext.as_str()) { return Err("not a video or audio file".into()); }
    if !p.is_file() { return Err("no such file".into()); }
    app.asset_protocol_scope().allow_file(&p).map_err(|e| e.to_string())
}

/// Copy a video or audio file into `<deck folder>/assets/` (a disk copy, never read into memory) and return the reference (`assets/name.mp4`).
/// The same name with the same size reuses the file already there; otherwise `-2`, `-3`, ...
#[tauri::command]
fn import_media(deck: String, src: String) -> Result<String, String> {
    let src = PathBuf::from(src);
    let ext = src.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if !VIDEO_EXT.contains(&ext.as_str()) && !SFX_EXT.contains(&ext.as_str()) { return Err("not a video or audio file".into()); }
    let dir = assets_dir(&deck)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let len = std::fs::metadata(&src).map_err(|e| e.to_string())?.len();
    let mut stem: String = src.file_stem().and_then(|s| s.to_str()).unwrap_or("media").chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' }).collect();
    stem.truncate(60);
    if stem.trim_matches('-').is_empty() { stem = "media".into(); }
    for n in 1.. {
        let name = if n == 1 { format!("{stem}.{ext}") } else { format!("{stem}-{n}.{ext}") };
        let dest = dir.join(&name);
        if !dest.exists() { std::fs::copy(&src, &dest).map_err(|e| e.to_string())?; return Ok(format!("assets/{name}")); }
        if std::fs::metadata(&dest).map(|m| m.len() == len).unwrap_or(false) { return Ok(format!("assets/{name}")); }
    }
    unreachable!()
}

/// Path of an .itsd (or .itsdpak) file passed on the command line (double-click / "Open with").
#[tauri::command]
fn launch_file() -> Option<String> {
    std::env::args().skip(1).find(|a| { let l = a.to_ascii_lowercase(); l.ends_with(".itsd") || l.ends_with(".itsdpak") })
}


// ---- the folder system: install folder (read-only, from the MSI) + the author's workspace (Documents\ITSD), see workspace.rs ----

#[derive(Serialize)]
struct WorkspaceInfo { install_dir: String, resources: String, workspace: String, version: String, templates: Vec<workspace::Entry>, examples: Vec<workspace::Entry> }

fn ws_root(app: &AppHandle, custom: &Option<String>) -> PathBuf {
    match custom.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(p) => PathBuf::from(p),
        None => app.path().document_dir().or_else(|_| app.path().home_dir()).unwrap_or_else(|_| PathBuf::from(".")).join("ITSD"),
    }
}
fn decks_in(dir: PathBuf) -> Vec<workspace::Entry> { workspace::list_dir(&dir).into_iter().filter(|e| !e.dir && e.name.ends_with(".itsd")).collect() }

/// Create (or top up) the workspace and report where everything is. Called at every start; it never overwrites anything.
#[tauri::command]
fn workspace_init(app: AppHandle, root: Option<String>) -> Result<WorkspaceInfo, String> {
    let root = ws_root(&app, &root);
    let res = app.path().resource_dir().ok();
    workspace::init(&root, res.as_deref()).map_err(|e| format!("Couldn't prepare {}: {e}", root.display()))?;
    let r = res.clone().unwrap_or_default();
    Ok(WorkspaceInfo {
        install_dir: std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_string_lossy().into_owned())).unwrap_or_default(),
        resources: r.to_string_lossy().into_owned(), workspace: root.to_string_lossy().into_owned(), version: app.package_info().version.to_string(),
        templates: decks_in(r.join("templates")), examples: decks_in(r.join("example")),
    })
}

/// Only the workspace and the installed (read-only) resources may be browsed.
fn browsable(app: &AppHandle, root: &Option<String>, p: &Path) -> bool {
    workspace::inside(&ws_root(app, root), p) || app.path().resource_dir().map(|r| workspace::inside(&r, p)).unwrap_or(false)
}
#[tauri::command]
fn workspace_list(app: AppHandle, root: Option<String>, path: String) -> Result<Vec<workspace::Entry>, String> {
    let p = PathBuf::from(&path);
    if !browsable(&app, &root, &p) { return Err("That folder is outside your ITSD folder".into()); }
    Ok(workspace::list_dir(&p))
}
#[tauri::command]
fn workspace_stat(paths: Vec<String>) -> Vec<Option<workspace::Entry>> { workspace::stat_paths(&paths) }
#[tauri::command]
fn workspace_op(app: AppHandle, root: Option<String>, op: String, path: String, arg: Option<String>) -> Result<String, String> {
    workspace::file_op(&ws_root(&app, &root), &op, &path, &arg.unwrap_or_default())
}
/// A new deck from a template (or any deck in the workspace / the installed examples), saved into Decks under a free name. Returns its path.
#[tauri::command]
fn workspace_new(app: AppHandle, root: Option<String>, template: Option<String>, name: String) -> Result<String, String> {
    let r = ws_root(&app, &root);
    let dir = r.join("Decks");
    match template {
        Some(t) => { let src = PathBuf::from(&t); if !browsable(&app, &root, &src) { return Err("That template is outside your ITSD folder".into()); } workspace::from_template(&src, &dir, &name) }
        None => { std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?; let to = workspace::unique(&dir, &format!("{}.itsd", name.trim_end_matches(".itsd")));
            std::fs::write(&to, "---\ntitle: Untitled\ntransition: fade\n---\n\n# Untitled\n\nStart typing.\n").map_err(|e| e.to_string())?; Ok(to.to_string_lossy().into_owned()) }
    }
}
/// Show a file or folder in the system's file manager.
#[tauri::command]
fn workspace_reveal(app: AppHandle, root: Option<String>, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let install = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf));
    if !browsable(&app, &root, &p) && install.as_deref() != Some(p.as_path()) { return Err("That is outside your ITSD folder".into()); }
    #[cfg(windows)] { let mut c = std::process::Command::new("explorer"); if p.is_dir() { c.arg(&p); } else { c.arg(format!("/select,{}", p.display())); } c.spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")] { std::process::Command::new("open").args(if p.is_dir() { vec![p.as_os_str().to_owned()] } else { vec!["-R".into(), p.as_os_str().to_owned()] }).spawn().map_err(|e| e.to_string())?; }
    #[cfg(all(unix, not(target_os = "macos")))] { let d = if p.is_dir() { p.clone() } else { p.parent().map(Path::to_path_buf).unwrap_or(p.clone()) }; std::process::Command::new("xdg-open").arg(d).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

/// GUI launches on macOS/Linux don't inherit the shell PATH; borrow it from a login shell.
#[cfg(unix)]
fn fix_path() {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
    if let Ok(o) = std::process::Command::new(shell).args(["-ilc", "echo -n $PATH"]).output() {
        if o.status.success() && !o.stdout.is_empty() {
            std::env::set_var("PATH", String::from_utf8_lossy(&o.stdout).to_string());
        }
    }
}
#[cfg(not(unix))]
fn fix_path() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    fix_path();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init()) // lets the Vendor menu download from sites that don't send CORS headers
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![run_code, format_code, check_toolchains, tool_status, test_tool, find_tool, read_deck, write_deck, launch_file, read_binary, write_binary, read_bundle, write_bundle_file, import_asset, import_font, list_assets, list_system_fonts, read_sound, list_sounds, allow_media, import_media, workspace_init, workspace_list, workspace_stat, workspace_op, workspace_new, workspace_reveal])
        .run(tauri::generate_context!())
        .expect("error while running ITSD");
}
