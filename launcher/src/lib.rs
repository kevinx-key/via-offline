//! Single-file launcher for VIA-Offline-KS.
//!
//! The shipped Windows build is one `.exe`:
//!
//! ```text
//! [ launcher ][ xz payload ][ trailer ]
//! ```
//!
//! On the first start the payload is unpacked to `runtime\<payload key>\` next to
//! the executable (or `%LOCALAPPDATA%\VIA-Offline-KS` when that folder is
//! read-only); later starts only spawn the already extracted application.
//!
//! `via-pack` turns a ready application directory into that single file, so the
//! build pipeline does not need 7-Zip or any other external tool.

pub mod archive;
pub mod pack;
pub mod run;
pub mod splash;
