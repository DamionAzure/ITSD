use serde::Serialize;
use std::{collections::HashMap, path::{Path, PathBuf}, process::Stdio, time::Duration};
use tauri::{ipc::Channel, AppHandle, Manager};
mod workspace;
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

/// Path of an .itsd file passed on the command line (double-click / "Open with").
#[tauri::command]
fn launch_file() -> Option<String> {
    std::env::args().skip(1).find(|a| a.ends_with(".itsd"))
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
        .invoke_handler(tauri::generate_handler![run_code, format_code, check_toolchains, read_deck, write_deck, launch_file, read_binary, write_binary, import_asset, import_font, list_assets, list_system_fonts, read_sound, list_sounds, allow_media, import_media, workspace_init, workspace_list, workspace_stat, workspace_op, workspace_new, workspace_reveal])
        .run(tauri::generate_context!())
        .expect("error while running ITSD");
}
