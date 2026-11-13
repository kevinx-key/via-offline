//! Normal launch: reuse the extracted copy, or extract once and start it.

use std::env;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, TryRecvError};
use std::sync::Arc;
use std::time::{Duration, Instant};

use lzma_rust2::XzReaderMt;

use crate::archive::{self, Region};
use crate::splash::Splash;

const APP_EXE: &str = "VIA-Offline-KS.exe";
const MARKER: &str = ".ok";
const MB: u64 = 1024 * 1024;

pub fn run() -> Result<(), String> {
    let started = Instant::now();
    let exe = env::current_exe().map_err(|e| format!("cannot locate the launcher: {e}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "launcher has no parent directory".to_string())?
        .to_path_buf();

    let mut payload =
        File::open(&exe).map_err(|e| format!("cannot open the launcher file: {e}"))?;
    let trailer = archive::read_trailer(&mut payload)
        .map_err(|e| format!("this file is not a complete build ({e}), please download it again"))?;
    let key = archive::payload_key(&mut payload, trailer)
        .map_err(|e| format!("cannot read the payload: {e}"))?;

    // Settings must survive upgrades, so they never live inside `runtime\<key>`.
    let root = app_root(&exe_dir);
    let cache = root.join("runtime").join(&key);

    let mut extracted = false;
    let mut extract_ms = 0u128;
    if !is_ready(&cache) {
        let begin = Instant::now();
        extract(&payload, trailer, &root, &key)?;
        extract_ms = begin.elapsed().as_millis();
        extracted = true;
    }

    let app = cache.join(APP_EXE);
    if !app.exists() {
        return Err(format!(
            "the extracted application is incomplete: {} is missing",
            app.display()
        ));
    }

    let spawned = Instant::now();
    Command::new(&app)
        .args(env::args_os().skip(1))
        .current_dir(&cache)
        .env("PORTABLE_EXECUTABLE_DIR", &root)
        .spawn()
        .map_err(|e| format!("cannot start {}: {e}", app.display()))?;

    if let Some(path) = env::var_os("VIA_LAUNCH_TIMING") {
        let report = format!(
            "{{\n  \"extracted\": {extracted},\n  \"extractMs\": {extract_ms},\n  \"cacheDir\": {:?},\n  \"payloadKey\": \"{key}\",\n  \"spawnMs\": {},\n  \"totalMs\": {}\n}}\n",
            cache.display().to_string(),
            spawned.elapsed().as_millis(),
            started.elapsed().as_millis(),
        );
        let _ = fs::write(PathBuf::from(path), report);
    }

    prune_older_versions(&root.join("runtime"), &key);
    Ok(())
}

fn extract(payload: &File, trailer: archive::Trailer, root: &Path, key: &str) -> Result<(), String> {
    let runtime = root.join("runtime");
    fs::create_dir_all(&runtime).map_err(|e| format!("cannot create {}: {e}", runtime.display()))?;
    let staging = runtime.join(format!(".staging-{}", std::process::id()));
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(|e| format!("cannot create staging dir: {e}"))?;

    let total = trailer.unpacked.max(1);
    let workers = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(2)
        .clamp(1, 8) as u32;

    let splash = Splash::show(
        "VIA 离线版 · K-STAR",
        &format!(
            "首次启动，正在展开 {} MB 组件…\n只需等待这一次，之后直接打开。",
            total / MB
        ),
    );

    let progress = Arc::new(AtomicU64::new(0));
    let (sender, receiver) = mpsc::channel::<Result<(), String>>();
    {
        let file = payload
            .try_clone()
            .map_err(|e| format!("cannot read the payload: {e}"))?;
        let staging = staging.clone();
        let progress = Arc::clone(&progress);
        std::thread::spawn(move || {
            let result = extract_into(file, trailer, &staging, workers, progress);
            let _ = sender.send(result);
        });
    }

    let begin = Instant::now();
    let outcome = loop {
        if let Some(splash) = splash.as_ref() {
            splash.pump();
            let done = progress.load(Ordering::Relaxed).min(total);
            splash.set_status(&format!(
                "{} / {} MB  ({}%)",
                done / MB,
                total / MB,
                100 * done / total
            ));
        }
        match receiver.try_recv() {
            Ok(result) => break result,
            Err(TryRecvError::Empty) => std::thread::sleep(Duration::from_millis(40)),
            Err(TryRecvError::Disconnected) => break Err("extraction stopped unexpectedly".into()),
        }
    };

    if let Some(splash) = splash {
        splash.close();
    }
    outcome?;

    let cache = runtime.join(key);
    if cache.exists() {
        let _ = fs::remove_dir_all(&cache);
    }
    fs::rename(&staging, &cache).map_err(|e| format!("cannot move the files into place: {e}"))?;
    fs::write(cache.join(MARKER), key).map_err(|e| format!("cannot write the cache marker: {e}"))?;
    eprintln!(
        "extracted {} MB in {:.1}s",
        total / MB,
        begin.elapsed().as_secs_f32()
    );
    Ok(())
}

fn extract_into(
    file: File,
    trailer: archive::Trailer,
    staging: &Path,
    workers: u32,
    progress: Arc<AtomicU64>,
) -> Result<(), String> {
    let region = Region::new(file, trailer.offset, trailer.len);
    let mut reader = XzReaderMt::new(region, false, workers)
        .map_err(|e| format!("cannot open the payload stream: {e}"))?;

    while let Some((relative, size)) = archive::read_entry_header(&mut reader)
        .map_err(|e| format!("cannot read the payload: {e}"))?
    {
        let target = staging.join(&relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
        }
        let mut out =
            File::create(&target).map_err(|e| format!("cannot create {}: {e}", target.display()))?;
        let copied = io::copy(&mut (&mut reader).take(size), &mut out)
            .map_err(|e| format!("cannot write {}: {e}", target.display()))?;
        if copied != size {
            return Err(format!("{} is truncated in the payload", target.display()));
        }
        progress.fetch_add(size, Ordering::Relaxed);
    }
    Ok(())
}

fn is_ready(cache: &Path) -> bool {
    cache.join(MARKER).is_file() && cache.join(APP_EXE).is_file()
}

/// Portable root: next to the .exe when writable, else the per-user folder.
fn app_root(exe_dir: &Path) -> PathBuf {
    if is_writable(exe_dir) {
        return exe_dir.to_path_buf();
    }
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);
    let fallback = base.join("VIA-Offline-KS");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

fn is_writable(dir: &Path) -> bool {
    let probe = dir.join(".via-write-probe");
    match fs::write(&probe, b"1") {
        Ok(_) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

fn prune_older_versions(runtime: &Path, keep: &str) {
    let Ok(entries) = fs::read_dir(runtime) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == keep || name.starts_with(".staging-") {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            let _ = fs::remove_dir_all(path);
        }
    }
}

/// Surface a failure to a user who double-clicked a windowless exe.
pub fn report_error(message: &str) {
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            let _ = fs::write(dir.join("launcher-error.log"), message);
        }
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
        let text: Vec<u16> = format!("VIA 离线版启动失败\n\n{message}")
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let title: Vec<u16> = "VIA-Offline-KS"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                text.as_ptr(),
                title.as_ptr(),
                MB_OK | MB_ICONERROR,
            );
        }
    }
    #[cfg(not(windows))]
    eprintln!("launcher error: {message}");
}
