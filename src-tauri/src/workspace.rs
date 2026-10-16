// The ITSD folder system.
//
//   install folder   where the MSI put the program (Program Files\ITSD): the exe plus `templates\` and `example\`, read-only.
//   workspace        the author's own folder, `Documents\ITSD` unless changed in Settings: Decks, Templates, Sounds, Styles (and a .trash).
//
// Everything here is plain std (no Tauri types) so it can be tested on its own; lib.rs wraps it in commands.
use serde::Serialize;
use std::{fs, io, path::{Component, Path, PathBuf}, time::UNIX_EPOCH};

pub const FOLDERS: &[&str] = &["Decks", "Templates", "Sounds", "Styles"];

#[derive(Serialize, Clone, Debug)]
pub struct Entry { pub name: String, pub path: String, pub dir: bool, pub modified: u64, pub size: u64 }

fn entry(p: &Path) -> Option<Entry> {
    let m = fs::metadata(p).ok()?;
    Some(Entry {
        name: p.file_name()?.to_string_lossy().into_owned(), path: p.to_string_lossy().into_owned(), dir: m.is_dir(), size: m.len(),
        modified: m.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0),
    })
}

/// Copy `from` into `to`, never overwriting a file that is already there. Returns how many files were copied.
pub fn copy_missing(from: &Path, to: &Path) -> io::Result<usize> {
    if !from.is_dir() { return Ok(0); }
    fs::create_dir_all(to)?;
    let mut n = 0;
    for e in fs::read_dir(from)?.flatten() {
        let (src, dst) = (e.path(), to.join(e.file_name()));
        if src.is_dir() { n += copy_missing(&src, &dst)?; }
        else if !dst.exists() { fs::copy(&src, &dst)?; n += 1; }
    }
    Ok(n)
}

/// Create the workspace folders and fill them from the install folder (templates, the example stylesheet). Safe to run on every start.
pub fn init(root: &Path, install: Option<&Path>) -> io::Result<()> {
    for f in FOLDERS { fs::create_dir_all(root.join(f))?; }
    if let Some(i) = install {
        copy_missing(&i.join("templates"), &root.join("Templates"))?;
        let css = i.join("example").join("exampletrace.css");
        let dst = root.join("Styles").join("exampletrace.css");
        if css.is_file() && !dst.exists() { fs::copy(css, dst)?; }
    }
    let note = root.join("Sounds").join("README.txt");
    if !note.exists() { fs::write(note, "Put sound effects here (wav, mp3, ogg, m4a, flac, aac, opus, webm).\nSettings > Sound folder points at this folder by default; a deck can then play any file by its name.\n")?; }
    Ok(())
}

/// One folder's contents: folders first, then files, each A-Z. Hidden names (starting with a dot) are left out.
pub fn list_dir(dir: &Path) -> Vec<Entry> {
    let mut v: Vec<Entry> = fs::read_dir(dir).into_iter().flatten().flatten().filter(|e| !e.file_name().to_string_lossy().starts_with('.')).filter_map(|e| entry(&e.path())).collect();
    v.sort_by(|a, b| b.dir.cmp(&a.dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    v
}

/// Which of these paths still exist (None when missing), in the same order.
pub fn stat_paths(paths: &[String]) -> Vec<Option<Entry>> { paths.iter().map(|p| entry(Path::new(p))).collect() }

/// A path is inside `root` when it starts with it and has no `..` in it (so `root\Decks\..\..\Windows` is refused).
pub fn inside(root: &Path, p: &Path) -> bool { p.starts_with(root) && !p.components().any(|c| matches!(c, Component::ParentDir)) }

/// `name`, or `name (2)`, `name (3)`... when that already exists in `dir`. The extension stays at the end.
pub fn unique(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() { return first; }
    let (stem, ext) = match name.rfind('.') { Some(i) if i > 0 => (&name[..i], &name[i..]), _ => (name, "") };
    (2..).map(|n| dir.join(format!("{stem} ({n}){ext}"))).find(|p| !p.exists()).unwrap()
}

fn bad_name(n: &str) -> bool { n.is_empty() || n.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) || n == "." || n == ".." }

/// The changes the Dashboard can make, all confined to the workspace. Returns the resulting path (for new, copy, rename), "" for trash.
pub fn file_op(root: &Path, op: &str, path: &str, arg: &str) -> Result<String, String> {
    let p = PathBuf::from(path);
    if !inside(root, &p) || p == root { return Err("That is outside your ITSD folder".into()); }
    let parent = p.parent().ok_or("No folder")?;
    match op {
        "mkdir" => { if bad_name(arg) { return Err("That name can't be used".into()); } let d = unique(&p, arg); fs::create_dir_all(&d).map_err(|e| e.to_string())?; Ok(d.to_string_lossy().into_owned()) }
        "rename" => {
            if bad_name(arg) { return Err("That name can't be used".into()); }
            let to = parent.join(arg); if to.exists() { return Err("Something with that name is already there".into()); }
            fs::rename(&p, &to).map_err(|e| e.to_string())?; Ok(to.to_string_lossy().into_owned())
        }
        "copy" => {
            if !p.is_file() { return Err("Only files can be copied".into()); }
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            let (stem, ext) = match name.rfind('.') { Some(i) if i > 0 => (name[..i].to_string(), name[i..].to_string()), _ => (name.clone(), String::new()) };
            let to = unique(parent, &format!("{stem} copy{ext}")); fs::copy(&p, &to).map_err(|e| e.to_string())?; Ok(to.to_string_lossy().into_owned())
        }
        "trash" => { // moved into .trash inside the workspace, never deleted
            let t = root.join(".trash"); fs::create_dir_all(&t).map_err(|e| e.to_string())?;
            let to = unique(&t, &p.file_name().unwrap().to_string_lossy()); fs::rename(&p, &to).map_err(|e| e.to_string())?; Ok(String::new())
        }
        _ => Err(format!("Unknown action {op}")),
    }
}

/// A new deck from a template file: copied into `dir` under a free name. Anywhere readable is allowed as the source (the install folder's templates).
pub fn from_template(src: &Path, dir: &Path, name: &str) -> Result<String, String> {
    if bad_name(name) { return Err("That name can't be used".into()); }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let to = unique(dir, &format!("{}.itsd", name.trim_end_matches(".itsd")));
    fs::copy(src, &to).map_err(|e| e.to_string())?; Ok(to.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tmp(n: &str) -> PathBuf { let d = std::env::temp_dir().join(format!("itsd-ws-{n}-{}", std::process::id())); let _ = fs::remove_dir_all(&d); fs::create_dir_all(&d).unwrap(); d }
    #[test] fn init_and_templates() {
        let base = tmp("a"); let inst = base.join("install"); fs::create_dir_all(inst.join("templates")).unwrap(); fs::create_dir_all(inst.join("example")).unwrap();
        fs::write(inst.join("templates").join("T.itsd"), "# t").unwrap(); fs::write(inst.join("example").join("exampletrace.css"), "/*x*/").unwrap();
        let root = base.join("ws"); init(&root, Some(&inst)).unwrap();
        for f in FOLDERS { assert!(root.join(f).is_dir()); }
        assert!(root.join("Templates/T.itsd").is_file() && root.join("Styles/exampletrace.css").is_file() && root.join("Sounds/README.txt").is_file());
        fs::write(root.join("Templates/T.itsd"), "# mine").unwrap(); init(&root, Some(&inst)).unwrap(); // does not overwrite the author's edit
        assert_eq!(fs::read_to_string(root.join("Templates/T.itsd")).unwrap(), "# mine");
    }
    #[test] fn ops_stay_inside() {
        let root = tmp("b"); init(&root, None).unwrap();
        let d = root.join("Decks"); fs::write(d.join("a.itsd"), "x").unwrap();
        assert!(file_op(&root, "rename", root.join("Decks/../../x").to_str().unwrap(), "y").is_err());
        assert!(file_op(&root, "trash", root.to_str().unwrap(), "").is_err());
        assert!(file_op(&root, "rename", d.join("a.itsd").to_str().unwrap(), "../evil.itsd").is_err());
        let c = file_op(&root, "copy", d.join("a.itsd").to_str().unwrap(), "").unwrap(); assert!(c.ends_with("a copy.itsd"));
        let c2 = file_op(&root, "copy", d.join("a.itsd").to_str().unwrap(), "").unwrap(); assert!(c2.ends_with("a copy (2).itsd"));
        let r = file_op(&root, "rename", &c, "b.itsd").unwrap(); assert!(Path::new(&r).is_file());
        file_op(&root, "trash", &r, "").unwrap(); assert!(!Path::new(&r).exists() && root.join(".trash/b.itsd").is_file());
        let m = file_op(&root, "mkdir", d.to_str().unwrap(), "Talks").unwrap(); assert!(Path::new(&m).is_dir());
        let l = list_dir(&d); assert!(l[0].dir && l.iter().any(|e| e.name == "a.itsd"));
        assert!(stat_paths(&[d.join("a.itsd").to_string_lossy().into_owned(), "nope".into()])[1].is_none());
        assert!(from_template(&d.join("a.itsd"), &d, "a").unwrap().ends_with("a (2).itsd"));
    }
}
