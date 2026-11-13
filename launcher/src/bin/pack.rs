//! `via-pack --dir <unpacked app> --out <single file.exe> [--level 9]`
//!
//! Build-time tool. Kept as a separate console binary so progress is visible in
//! CI logs (the launcher itself is a windowless Windows binary).

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = via_launcher::pack::run(&args) {
        eprintln!("via-pack: {error}");
        std::process::exit(2);
    }
}
