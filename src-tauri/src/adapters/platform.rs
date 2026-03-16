use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimePlatform {
    Windows,
    MacOS,
    Other,
}

pub fn current_platform() -> RuntimePlatform {
    match env::consts::OS {
        "windows" => RuntimePlatform::Windows,
        "macos" => RuntimePlatform::MacOS,
        _ => RuntimePlatform::Other,
    }
}

pub fn default_openclaw_config_path() -> PathBuf {
    if let Ok(path) = env::var("OPENCLAW_CONFIG_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    let home = env::var("HOME")
        .ok()
        .or_else(|| env::var("USERPROFILE").ok())
        .unwrap_or_else(|| ".".to_string());
    let official_path = PathBuf::from(&home).join(".openclaw").join("openclaw.json");
    if official_path.exists() {
        return official_path;
    }

    let legacy_path = match current_platform() {
        RuntimePlatform::Windows => {
            let app_data = env::var("APPDATA")
                .ok()
                .or_else(|| {
                    env::var("USERPROFILE")
                        .ok()
                        .map(|p| format!("{p}\\AppData\\Roaming"))
                })
                .unwrap_or_else(|| ".".to_string());
            PathBuf::from(app_data).join("OpenClaw").join("config.json")
        }
        RuntimePlatform::MacOS => PathBuf::from(&home)
            .join("Library")
            .join("Application Support")
            .join("OpenClaw")
            .join("config.json"),
        RuntimePlatform::Other => PathBuf::from(&home)
            .join(".config")
            .join("openclaw")
            .join("config.json"),
    };

    if legacy_path.exists() {
        return legacy_path;
    }

    official_path
}

pub fn clawdesk_app_dir() -> PathBuf {
    match current_platform() {
        RuntimePlatform::Windows => {
            let app_data = env::var("APPDATA")
                .ok()
                .or_else(|| {
                    env::var("USERPROFILE")
                        .ok()
                        .map(|p| format!("{p}\\AppData\\Roaming"))
                })
                .unwrap_or_else(|| ".".to_string());
            PathBuf::from(app_data).join("ClawDesk")
        }
        RuntimePlatform::MacOS => {
            let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("ClawDesk")
        }
        RuntimePlatform::Other => {
            let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join(".config").join("clawdesk")
        }
    }
}

pub fn clawdesk_log_dir() -> PathBuf {
    clawdesk_app_dir().join("logs")
}

pub fn clawdesk_diagnostics_dir() -> PathBuf {
    clawdesk_app_dir().join("diagnostics")
}

pub fn default_gateway_port() -> u16 {
    18789
}

pub fn locator_command(binary_name: &str) -> (String, Vec<String>) {
    match current_platform() {
        RuntimePlatform::Windows => ("where".to_string(), vec![binary_name.to_string()]),
        RuntimePlatform::MacOS | RuntimePlatform::Other => {
            ("which".to_string(), vec![binary_name.to_string()])
        }
    }
}

pub fn display_platform() -> &'static str {
    match current_platform() {
        RuntimePlatform::Windows => "windows",
        RuntimePlatform::MacOS => "macos",
        RuntimePlatform::Other => "other",
    }
}
