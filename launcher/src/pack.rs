//! `via-pack --dir <app dir> --out <file>.exe [--level 9] [--block MB]`
//!
//! Builds the distributable single file: a copy of the launcher binary with the
//! compressed application directory appended.

use std::fs::{self, File};
use std::io::{self, Seek, Write};
use std::num::NonZeroU64;
use std::path::{Path, PathBuf};

use lzma_rust2::{CheckType, XzOptions, XzWriter};

use crate::archive::{self, Trailer};

const MB: u64 = 1024 * 1024;

pub fn run(args: &[String]) -> Result<(), String> {
    let mut dir: Option<PathBuf> = None;
    let mut out: Option<PathBuf> = None;
    let mut level: u32 = 9;
    let mut block_mb: u64 = 0;
    let mut stub: Option<PathBuf> = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--dir" => {
                dir = Some(PathBuf::from(args.get(i + 1).ok_or("--dir needs a value")?));
                i += 2;
            }
            "--out" => {
                out = Some(PathBuf::from(args.get(i + 1).ok_or("--out needs a value")?));
                i += 2;
            }
            "--level" => {
                level = args
                    .get(i + 1)
                    .ok_or("--level needs a value")?
                    .parse()
                    .map_err(|_| "--level must be a number between 0 and 9")?;
                i += 2;
            }
            "--block" => {
                block_mb = args
                    .get(i + 1)
                    .ok_or("--block needs a value")?
                    .parse()
                    .map_err(|_| "--block must be a size in MB (0 = one stream)")?;
                i += 2;
            }
            "--stub" => {
                stub = Some(PathBuf::from(
                    args.get(i + 1).ok_or("--stub needs a value")?,
                ));
                i += 2;
            }
            other => return Err(format!("unknown argument: {other}")),
        }
    }

    let dir = dir.ok_or("missing --dir")?;
    let out = out.ok_or("missing --out")?;
    if !dir.is_dir() {
        return Err(format!("--dir is not a directory: {}", dir.display()));
    }

    let files = collect(&dir)?;
    if files.is_empty() {
        return Err("nothing to pack".to_string());
    }

    // The stub is the `via-launcher` binary, not this packing tool.
    let stub = match stub {
        Some(path) => path,
        None => {
            let me = std::env::current_exe()
                .map_err(|e| format!("cannot locate this tool: {e}"))?;
            let sibling = me
                .parent()
                .ok_or("cannot locate the build directory")?
                .join("via-launcher.exe");
            if !sibling.is_file() {
                return Err(format!(
                    "cannot find the launcher binary at {}; pass --stub",
                    sibling.display()
                ));
            }
            sibling
        }
    };
    let mut destination =
        File::create(&out).map_err(|e| format!("cannot create {}: {e}", out.display()))?;
    let mut source =
        File::open(&stub).map_err(|e| format!("cannot read {}: {e}", stub.display()))?;
    io::copy(&mut source, &mut destination).map_err(|e| format!("cannot write stub: {e}"))?;
    let offset = destination
        .stream_position()
        .map_err(|e| format!("cannot query stub size: {e}"))?;

    let mut options = XzOptions::with_preset(level);
    options.set_check_sum_type(CheckType::Crc64);
    // Blocks would allow a parallel decode, but measurements showed the first
    // run is bound by the disk write, and splitting costs ~1.4 MB of ratio.
    if block_mb > 0 {
        options.set_block_size(NonZeroU64::new(block_mb * MB));
    }

    let mut unpacked: u64 = 0;
    {
        let mut xz = XzWriter::new(&mut destination, options)
            .map_err(|e| format!("cannot start compressor: {e}"))?;
        for (index, (relative, full)) in files.iter().enumerate() {
            let size = fs::metadata(full)
                .map_err(|e| format!("cannot stat {}: {e}", full.display()))?
                .len();
            archive::write_entry_header(&mut xz, relative, size)
                .map_err(|e| format!("cannot write entry header: {e}"))?;
            let mut file = File::open(full).map_err(|e| format!("cannot open: {e}"))?;
            let copied = io::copy(&mut file, &mut xz)
                .map_err(|e| format!("cannot pack {}: {e}", full.display()))?;
            if copied != size {
                return Err(format!("{} changed while packing", full.display()));
            }
            unpacked += size;
            if index % 200 == 0 {
                eprintln!(
                    "  packed {:>4}/{} files ({:.1} MB)",
                    index + 1,
                    files.len(),
                    unpacked as f64 / MB as f64
                );
            }
        }
        xz.finish()
            .map_err(|e| format!("cannot finish archive: {e}"))?;
    }

    let len = destination
        .stream_position()
        .map_err(|e| format!("cannot query payload size: {e}"))?
        - offset;
    archive::write_trailer(
        &mut destination,
        Trailer {
            offset,
            len,
            unpacked,
        },
    )
    .map_err(|e| format!("cannot write trailer: {e}"))?;
    destination
        .flush()
        .map_err(|e| format!("cannot flush output: {e}"))?;
    drop(destination);

    // Read the trailer back: a mistake here would only show up on a user's PC.
    let mut check = File::open(&out).map_err(|e| format!("cannot reopen {}: {e}", out.display()))?;
    let trailer = archive::read_trailer(&mut check)
        .map_err(|e| format!("written file is not a valid launcher: {e}"))?;

    println!(
        "packed {} files, {:.1} MB -> {:.1} MB payload (+ {} KB stub) = {:.1} MB total",
        files.len(),
        unpacked as f64 / MB as f64,
        trailer.len as f64 / MB as f64,
        offset / 1024,
        (trailer.offset + trailer.len + archive::TRAILER_LEN) as f64 / MB as f64,
    );
    Ok(())
}

fn collect(root: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    let mut found = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries =
            fs::read_dir(&dir).map_err(|e| format!("cannot read {}: {e}", dir.display()))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("cannot read directory entry: {e}"))?;
            let path = entry.path();
            let meta = entry
                .metadata()
                .map_err(|e| format!("cannot stat {}: {e}", path.display()))?;
            if meta.is_dir() {
                stack.push(path);
            } else if meta.is_file() {
                let relative = path
                    .strip_prefix(root)
                    .map_err(|_| "internal path error".to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                found.push((relative, path));
            }
        }
    }
    found.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(found)
}
