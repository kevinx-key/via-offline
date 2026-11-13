#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    if let Err(error) = via_launcher::run::run() {
        via_launcher::run::report_error(&error);
        std::process::exit(1);
    }
}
