use std::env;
use std::path::PathBuf;

use crate::adapters::platform;

pub fn binary_name() -> &'static str {
    if cfg!(windows) {
        "openclaw.cmd"
    } else {
        "openclaw"
    }
}

pub fn npm_program() -> &'static str {
    if cfg!(windows) {
        "npm.cmd"
    } else {
        "npm"
    }
}

pub fn binary_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(current_dir) = env::current_dir() {
        candidates.push(current_dir.join(binary_name()));
    }

    for dir in platform::desktop_runtime_bin_dirs() {
        candidates.push(dir.join(binary_name()));
        // On Windows, only look for .cmd/.exe wrappers.  The bare "openclaw"
        // file (a Unix shell script) is not directly executable and trying to
        // spawn it causes OS error 193 ("%1 is not a valid Win32 application").
        if cfg!(windows) {
            candidates.push(dir.join("openclaw.exe"));
        }
    }

    candidates
}

pub fn resolve_binary_path() -> Option<PathBuf> {
    binary_candidates().into_iter().find(|path| path.exists())
}
