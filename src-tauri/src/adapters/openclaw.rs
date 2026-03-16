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
        if cfg!(windows) {
            candidates.push(dir.join("openclaw"));
        }
    }

    candidates
}

pub fn resolve_binary_path() -> Option<PathBuf> {
    binary_candidates().into_iter().find(|path| path.exists())
}
