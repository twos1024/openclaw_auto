use std::env;
use std::path::PathBuf;

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

    if cfg!(windows) {
        if let Some(app_data) = env::var("APPDATA").ok().or_else(|| {
            env::var("USERPROFILE")
                .ok()
                .map(|p| format!("{p}\\AppData\\Roaming"))
        }) {
            candidates.push(PathBuf::from(&app_data).join("npm").join("openclaw.cmd"));
            candidates.push(PathBuf::from(app_data).join("npm").join("openclaw"));
        }
    } else {
        if let Ok(home) = env::var("HOME") {
            candidates.push(
                PathBuf::from(&home)
                    .join(".npm-global")
                    .join("bin")
                    .join("openclaw"),
            );
            candidates.push(
                PathBuf::from(&home)
                    .join(".local")
                    .join("bin")
                    .join("openclaw"),
            );
        }

        candidates.push(PathBuf::from("/usr/local/bin/openclaw"));
        candidates.push(PathBuf::from("/opt/homebrew/bin/openclaw"));
    }

    candidates
}

pub fn resolve_binary_path() -> Option<PathBuf> {
    binary_candidates().into_iter().find(|path| path.exists())
}
