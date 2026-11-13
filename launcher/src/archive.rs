//! On-disk format of the single-file launcher.
//!
//! ```text
//! [ launcher.exe ][ xz payload ][ trailer ]
//! ```
//!
//! The payload is an LZMA2/xz stream of entries, each encoded as
//! `[u16 path length][path][u64 file size][bytes]`. The trailer (36 bytes) is
//! written last so a truncated download can never look like a valid build.

use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

pub const MAGIC: &[u8; 8] = b"VIAPAYL2";
pub const FORMAT: u32 = 2;
pub const TRAILER_LEN: u64 = 8 + 4 + 8 + 8 + 8;

#[derive(Debug, Clone, Copy)]
pub struct Trailer {
    pub offset: u64,
    pub len: u64,
    pub unpacked: u64,
}

pub fn write_trailer(out: &mut File, trailer: Trailer) -> io::Result<()> {
    let mut buf = [0u8; TRAILER_LEN as usize];
    buf[0..8].copy_from_slice(MAGIC);
    buf[8..12].copy_from_slice(&FORMAT.to_le_bytes());
    buf[12..20].copy_from_slice(&trailer.offset.to_le_bytes());
    buf[20..28].copy_from_slice(&trailer.len.to_le_bytes());
    buf[28..36].copy_from_slice(&trailer.unpacked.to_le_bytes());
    out.write_all(&buf)
}

pub fn read_trailer(file: &mut File) -> io::Result<Trailer> {
    let size = file.metadata()?.len();
    if size < TRAILER_LEN {
        return Err(bad("file is too small to be a launcher build"));
    }
    file.seek(SeekFrom::End(-(TRAILER_LEN as i64)))?;
    let mut buf = [0u8; TRAILER_LEN as usize];
    file.read_exact(&mut buf)?;

    if &buf[0..8] != MAGIC {
        return Err(bad("missing launcher trailer"));
    }
    let format = u32::from_le_bytes(buf[8..12].try_into().unwrap());
    if format != FORMAT {
        return Err(bad(&format!("unsupported payload format {format}")));
    }
    let offset = u64::from_le_bytes(buf[12..20].try_into().unwrap());
    let len = u64::from_le_bytes(buf[20..28].try_into().unwrap());
    let unpacked = u64::from_le_bytes(buf[28..36].try_into().unwrap());
    if offset + len + TRAILER_LEN != size {
        return Err(bad("payload trailer does not match the file size (truncated?)"));
    }
    Ok(Trailer {
        offset,
        len,
        unpacked,
    })
}

/// Cache key: payload length plus a sample from both ends of the payload.
pub fn payload_key(file: &mut File, trailer: Trailer) -> io::Result<String> {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    let mut eat = |bytes: &[u8]| {
        for byte in bytes {
            hash ^= *byte as u64;
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
    };
    eat(&trailer.len.to_le_bytes());
    eat(&trailer.unpacked.to_le_bytes());

    let mut buf = [0u8; 4096];
    for offset in [trailer.offset, trailer.offset + trailer.len / 2] {
        file.seek(SeekFrom::Start(offset))?;
        let n = file.read(&mut buf)?;
        eat(&buf[..n]);
    }
    Ok(format!("{hash:016x}"))
}

/// A read-only window over the payload region of the launcher file.
pub struct Region {
    file: File,
    start: u64,
    len: u64,
    pos: u64,
}

impl Region {
    pub fn new(file: File, start: u64, len: u64) -> Self {
        Self {
            file,
            start,
            len,
            pos: 0,
        }
    }
}

impl Read for Region {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        if self.pos >= self.len || buf.is_empty() {
            return Ok(0);
        }
        let want = buf.len().min((self.len - self.pos) as usize);
        self.file.seek(SeekFrom::Start(self.start + self.pos))?;
        let read = self.file.read(&mut buf[..want])?;
        self.pos += read as u64;
        Ok(read)
    }
}

impl Seek for Region {
    fn seek(&mut self, from: SeekFrom) -> io::Result<u64> {
        let next = match from {
            SeekFrom::Start(offset) => offset as i128,
            SeekFrom::End(offset) => self.len as i128 + offset as i128,
            SeekFrom::Current(offset) => self.pos as i128 + offset as i128,
        };
        if !(0..=self.len as i128).contains(&next) {
            return Err(bad("seek outside of the payload"));
        }
        self.pos = next as u64;
        Ok(self.pos)
    }
}

pub fn write_entry_header<W: Write>(out: &mut W, path: &str, size: u64) -> io::Result<()> {
    let bytes = path.as_bytes();
    let len = u16::try_from(bytes.len()).map_err(|_| bad("path too long"))?;
    out.write_all(&len.to_le_bytes())?;
    out.write_all(bytes)?;
    out.write_all(&size.to_le_bytes())
}

/// Reads the next entry header, or `None` at a clean end of stream.
pub fn read_entry_header<R: Read>(input: &mut R) -> io::Result<Option<(PathBuf, u64)>> {
    let mut len_buf = [0u8; 2];
    if !read_maybe(input, &mut len_buf)? {
        return Ok(None);
    }
    let mut path_buf = vec![0u8; u16::from_le_bytes(len_buf) as usize];
    input.read_exact(&mut path_buf)?;
    let path = safe_relative(&path_buf)?;

    let mut size_buf = [0u8; 8];
    input.read_exact(&mut size_buf)?;
    Ok(Some((path, u64::from_le_bytes(size_buf))))
}

fn read_maybe<R: Read>(input: &mut R, buf: &mut [u8]) -> io::Result<bool> {
    let mut filled = 0;
    while filled < buf.len() {
        match input.read(&mut buf[filled..])? {
            0 => return Ok(filled != 0),
            n => filled += n,
        }
    }
    Ok(true)
}

/// Reject absolute paths, `..`, drive letters and NTFS stream separators so a
/// tampered payload cannot write outside the cache directory.
pub fn safe_relative(raw: &[u8]) -> io::Result<PathBuf> {
    let text = std::str::from_utf8(raw)
        .map_err(|_| bad("payload contains a non UTF-8 path"))?;
    if text.is_empty() || text.contains(':') || text.contains("..") {
        return Err(bad(&format!("unsafe path in payload: {text:?}")));
    }
    let path = Path::new(text);
    if path.is_absolute() {
        return Err(bad(&format!("absolute path in payload: {text:?}")));
    }
    for component in path.components() {
        if !matches!(component, std::path::Component::Normal(_)) {
            return Err(bad(&format!("unexpected path component: {text:?}")));
        }
    }
    Ok(path.to_path_buf())
}

pub fn bad(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.to_string())
}
