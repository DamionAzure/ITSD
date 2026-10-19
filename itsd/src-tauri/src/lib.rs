use serde::Serialize;
use std::{collections::HashMap, path::{Path, PathBuf}, process::Stdio, time::Duration};
use tauri::ipc::Channel;
use tokio::{io::{AsyncBufReadExt, BufReader}, process::Command};

#[derive(Clone, Serialize)]
#[serde(tag = "kind", content = "data")]
enum RunEvent { Stdout(String), Stderr(String), Exit(i32), Error(String) }

#[cfg(windows)] const PY: &str = "python";
#[cfg(not(windows))] const PY: &str = "python3";

struct Lang {
    ext: &'static str,
    probe: &'static [&'static str],
    compile: Option<&'static [&'static str]>, // {src} {out} are substituted
    run: &'static [&'static str],
}

const LANGS: &[(&str, Lang)] = &[
    ("c",      Lang { ext: "c",   probe: &["cc", "--version"],    compile: Some(&["cc", "{src}", "-o", "{out}"]),    run: &["{out}"] }),
    ("cpp",    Lang { ext: "cpp", probe: &["c++", "--version"],   compile: Some(&["c++", "{src}", "-o", "{out}"]),   run: &["{out}"] }),
    ("rust",   Lang { ext: "rs",  probe: &["rustc", "--version"], compile: Some(&["rustc", "{src}", "-o", "{out}"]), run: &["{out}"] }),
    ("go",     Lang { ext: "go",  probe: &["go", "version"],      compile: None, run: &["go", "run", "{src}"] }),
    ("python", Lang { ext: "py",  probe: &[PY, "--version"],      compile: None, run: &[PY, "{src}"] }),
    ("java",   Lang { ext: "java", probe: &["java", "--version"], compile: None, run: &["java", "{src}"] }),
    ("node",   Lang { ext: "js",  probe: &["node", "--version"],  compile: None, run: &["node", "{src}"] }),
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

fn lang_for(name: &str) -> Option<&'static Lang> {
    LANGS.iter().find(|(n, _)| *n == name).map(|(_, l)| l)
}

async fn exec(args: Vec<String>, cwd: &Path, ch: &Channel<RunEvent>) -> Result<i32, String> {
    let mut child = Command::new(&args[0])
        .args(&args[1..])
        .current_dir(cwd)
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
    let status = tokio::time::timeout(Duration::from_secs(10), child.wait())
        .await
        .map_err(|_| "timed out after 10s".to_string())?
        .map_err(|e| e.to_string())?;
    let _ = tokio::join!(t1, t2);
    Ok(status.code().unwrap_or(-1))
}

#[tauri::command]
async fn run_code(lang: String, code: String, on_event: Channel<RunEvent>) -> Result<(), String> {
    let l = lang_for(&lang).ok_or("unsupported language")?;
    let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let src = dir.path().join(format!("main.{}", l.ext));
    let out = dir.path().join(if cfg!(windows) { "main_out.exe" } else { "main_out" });
    let code = if lang == "java" && code.contains("Trace.") { format!("{code}\n{JAVA_TRACE}") } else { code };
    std::fs::write(&src, code).map_err(|e| e.to_string())?;
    let sub = |s: &&str| s.replace("{src}", src.to_str().unwrap()).replace("{out}", out.to_str().unwrap());

    if let Some(c) = l.compile {
        let rc = exec(c.iter().map(sub).collect(), dir.path(), &on_event).await?;
        if rc != 0 { let _ = on_event.send(RunEvent::Exit(rc)); return Ok(()); }
    }
    let rc = exec(l.run.iter().map(sub).collect(), dir.path(), &on_event).await?;
    let _ = on_event.send(RunEvent::Exit(rc));
    Ok(())
}

#[tauri::command]
async fn check_toolchains() -> HashMap<String, bool> {
    let mut m = HashMap::new();
    for (name, l) in LANGS {
        let ok = Command::new(l.probe[0]).args(&l.probe[1..])
            .stdout(Stdio::null()).stderr(Stdio::null())
            .status().await.map(|s| s.success()).unwrap_or(false);
        m.insert(name.to_string(), ok);
    }
    m
}

#[tauri::command]
fn read_deck(path: String) -> Result<String, String> { std::fs::read_to_string(path).map_err(|e| e.to_string()) }

#[tauri::command]
fn write_deck(path: String, content: String) -> Result<(), String> { std::fs::write(path, content).map_err(|e| e.to_string()) }

// ---- pictures: the Visual view keeps every image in an `assets` folder next to the deck ----

const IMG_EXT: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
const MAX_IMAGE: u64 = 64 * 1024 * 1024;

fn is_image(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).map(|e| IMG_EXT.contains(&e.to_ascii_lowercase().as_str())).unwrap_or(false)
}
fn assets_dir(deck: &str) -> Result<PathBuf, String> {
    Path::new(deck).parent().map(|d| d.join("assets")).ok_or_else(|| "the deck has no folder".to_string())
}

/// Raw bytes of an image file, handed to the webview as an ArrayBuffer (no JSON/base64 detour).
#[tauri::command]
fn read_binary(path: String) -> Result<tauri::ipc::Response, String> {
    let p = PathBuf::from(&path);
    if !is_image(&p) { return Err("not an image file".into()); }
    let len = std::fs::metadata(&p).map_err(|e| e.to_string())?.len();
    if len > MAX_IMAGE { return Err("image is larger than 64 MB".into()); }
    std::fs::read(&p).map(tauri::ipc::Response::new).map_err(|e| e.to_string())
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

/// Path of an .itsd file passed on the command line (double-click / "Open with").
#[tauri::command]
fn launch_file() -> Option<String> {
    std::env::args().skip(1).find(|a| a.ends_with(".itsd"))
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

pub fn run() {
    fix_path();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_code, check_toolchains, read_deck, write_deck, launch_file, read_binary, import_asset, list_assets])
        .run(tauri::generate_context!())
        .expect("error while running ITSD");
}
