//! Embeds the application icon and version metadata into the launcher binary.
//!
//! `rc.exe` is not always on PATH (it ships with the Windows SDK), so look for it
//! in the usual locations and prepend it before handing over to `winres`.

use std::env;
use std::path::{Path, PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=../packaging/icon.ico");
    println!("cargo:rerun-if-changed=build.rs");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    if let Some(dir) = find_rc() {
        let path = env::var("PATH").unwrap_or_default();
        env::set_var("PATH", format!("{};{}", dir.display(), path));
    }

    let version = env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0".into());
    let mut res = winres::WindowsResource::new();
    res.set_icon("../packaging/icon.ico");
    res.set("FileDescription", "VIA-Offline-KS launcher");
    res.set("ProductName", "VIA-Offline-KS");
    res.set("OriginalFilename", "VIA-Offline-KS.exe");
    res.set("LegalCopyright", "GPL-3.0 · K Star Studio");
    res.set("FileVersion", &format!("{version}.0"));
    res.set("ProductVersion", &format!("{version}.0"));
    if let Err(error) = res.compile() {
        // A missing icon must not break the build; the exe just keeps the default one.
        println!("cargo:warning=could not embed Windows resources: {error}");
    }
}

fn find_rc() -> Option<PathBuf> {
    if let Ok(explicit) = env::var("RC_PATH") {
        let path = PathBuf::from(explicit);
        if let Some(dir) = path.parent() {
            return Some(dir.to_path_buf());
        }
    }
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        let Ok(root) = env::var(var) else { continue };
        let kits = Path::new(&root).join("Windows Kits").join("10").join("bin");
        if let Some(found) = newest_child_with(&kits, Path::new("x64").join("rc.exe")) {
            return found.parent().map(|p| p.to_path_buf());
        }
    }
    let path = env::var_os("PATH")?;
    env::split_paths(&path)
        .find(|dir| dir.join("rc.exe").is_file())
}

fn newest_child_with(dir: &Path, rel: impl AsRef<Path>) -> Option<PathBuf> {
    let mut versions: Vec<PathBuf> = std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.join(rel.as_ref()).is_file())
        .collect();
    versions.sort();
    versions.pop().map(|dir| dir.join(rel.as_ref()))
}
