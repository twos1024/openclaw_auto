use std::env;
use std::path::PathBuf;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimePlatform {
    Windows,
    MacOS,
    Linux,
    Unknown,
}

pub fn current_platform() -> RuntimePlatform {
    match env::consts::OS {
        "windows" => RuntimePlatform::Windows,
        "macos" => RuntimePlatform::MacOS,
        "linux" => RuntimePlatform::Linux,
        _ => RuntimePlatform::Unknown,
    }
}

pub fn default_openclaw_config_path() -> PathBuf {
    if let Ok(path) = env::var("OPENCLAW_CONFIG_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    let home = home_dir();
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
        RuntimePlatform::Linux => xdg_config_home(&home).join("openclaw").join("config.json"),
        RuntimePlatform::Unknown => PathBuf::from(&home)
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
            let home = home_dir();
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("ClawDesk")
        }
        RuntimePlatform::Linux => {
            let home = home_dir();
            xdg_config_home(&home).join("clawdesk")
        }
        RuntimePlatform::Unknown => {
            let home = home_dir();
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
        RuntimePlatform::Windows => {
            // On Windows, npm creates both a bare shell script (not executable on
            // Windows) and a .cmd batch wrapper.  Searching for "openclaw.cmd"
            // avoids resolving to the non-executable shell script first.
            let target = format!("{binary_name}.cmd");
            ("where".to_string(), vec![target])
        }
        RuntimePlatform::MacOS | RuntimePlatform::Linux | RuntimePlatform::Unknown => {
            ("which".to_string(), vec![binary_name.to_string()])
        }
    }
}

pub fn display_platform() -> &'static str {
    match current_platform() {
        RuntimePlatform::Windows => "windows",
        RuntimePlatform::MacOS => "macos",
        RuntimePlatform::Linux => "linux",
        RuntimePlatform::Unknown => "unknown",
    }
}

pub fn desktop_runtime_bin_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let home = home_dir();

    if let Ok(prefix) = env::var("NPM_CONFIG_PREFIX") {
        let trimmed = prefix.trim();
        if !trimmed.is_empty() {
            dirs.push(PathBuf::from(trimmed).join("bin"));
        }
    }

    if let Ok(pnpm_home) = env::var("PNPM_HOME") {
        let trimmed = pnpm_home.trim();
        if !trimmed.is_empty() {
            dirs.push(PathBuf::from(trimmed));
        }
    }

    if let Ok(volta_home) = env::var("VOLTA_HOME") {
        let trimmed = volta_home.trim();
        if !trimmed.is_empty() {
            dirs.push(PathBuf::from(trimmed).join("bin"));
        }
    }

    if let Ok(xdg_bin_home) = env::var("XDG_BIN_HOME") {
        let trimmed = xdg_bin_home.trim();
        if !trimmed.is_empty() {
            dirs.push(PathBuf::from(trimmed));
        }
    }

    match current_platform() {
        RuntimePlatform::Windows => {
            if let Some(app_data) = env::var("APPDATA").ok().or_else(|| {
                env::var("USERPROFILE")
                    .ok()
                    .map(|p| format!("{p}\\AppData\\Roaming"))
            }) {
                dirs.push(PathBuf::from(app_data).join("npm"));
            }

            // WinGet-installed Node.js may place npm global binaries under %LOCALAPPDATA%\npm.
            if let Some(local_app_data) = env::var("LOCALAPPDATA").ok() {
                dirs.push(PathBuf::from(&local_app_data).join("npm"));
            }

            // Also include the Node.js installation directory itself (some setups
            // keep global bins next to the node binary, e.g. nvm-windows).
            // The result is cached for the process lifetime to avoid repeated
            // synchronous blocking I/O on every command invocation.
            if let Some(node_dir) = cached_node_bin_dir() {
                dirs.push(node_dir);
            }
        }
        RuntimePlatform::MacOS => {
            dirs.push(PathBuf::from(&home).join(".npm-global").join("bin"));
            dirs.push(PathBuf::from(&home).join(".local").join("bin"));
            dirs.push(PathBuf::from(&home).join(".volta").join("bin"));
            dirs.push(
                PathBuf::from(&home)
                    .join(".nvm")
                    .join("current")
                    .join("bin"),
            );
            dirs.push(PathBuf::from(&home).join(".asdf").join("shims"));
            dirs.push(PathBuf::from("/opt/homebrew/bin"));
            dirs.push(PathBuf::from("/usr/local/bin"));
            dirs.push(PathBuf::from("/usr/bin"));
            dirs.push(PathBuf::from("/bin"));
            dirs.push(PathBuf::from("/usr/sbin"));
            dirs.push(PathBuf::from("/sbin"));
        }
        RuntimePlatform::Linux => {
            dirs.push(PathBuf::from(&home).join(".npm-global").join("bin"));
            dirs.push(PathBuf::from(&home).join(".local").join("bin"));
            dirs.push(PathBuf::from(&home).join(".volta").join("bin"));
            dirs.push(
                PathBuf::from(&home)
                    .join(".nvm")
                    .join("current")
                    .join("bin"),
            );
            dirs.push(PathBuf::from(&home).join(".asdf").join("shims"));
            dirs.push(PathBuf::from("/usr/local/bin"));
            dirs.push(PathBuf::from("/usr/bin"));
            dirs.push(PathBuf::from("/bin"));
            dirs.push(PathBuf::from("/usr/local/sbin"));
            dirs.push(PathBuf::from("/usr/sbin"));
            dirs.push(PathBuf::from("/sbin"));
            dirs.push(PathBuf::from("/snap/bin"));
        }
        RuntimePlatform::Unknown => {
            dirs.push(PathBuf::from(&home).join(".local").join("bin"));
            dirs.push(PathBuf::from("/usr/local/bin"));
            dirs.push(PathBuf::from("/usr/bin"));
            dirs.push(PathBuf::from("/bin"));
        }
    }

    dedupe_paths(dirs)
}

pub fn normalized_path_env() -> Option<String> {
    let current = env::var_os("PATH");
    let mut ordered = desktop_runtime_bin_dirs();

    if let Some(path_os) = current {
        ordered.extend(env::split_paths(&path_os));
    }

    let existing = dedupe_paths(ordered)
        .into_iter()
        .filter(|path| path.exists())
        .collect::<Vec<_>>();

    if existing.is_empty() {
        return None;
    }

    env::join_paths(existing)
        .ok()
        .map(|joined| joined.to_string_lossy().to_string())
}

fn home_dir() -> String {
    env::var("HOME")
        .ok()
        .or_else(|| env::var("USERPROFILE").ok())
        .unwrap_or_else(|| ".".to_string())
}

fn xdg_config_home(home: &str) -> PathBuf {
    env::var("XDG_CONFIG_HOME")
        .ok()
        .map(|value| PathBuf::from(value.trim()))
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| PathBuf::from(home).join(".config"))
}

// Cached node binary directory — resolved once per process lifetime on Windows
// to avoid repeated synchronous I/O on every command invocation.
static NODE_BIN_DIR: OnceLock<Option<PathBuf>> = OnceLock::new();

#[cfg(windows)]
fn cached_node_bin_dir() -> Option<PathBuf> {
    NODE_BIN_DIR
        .get_or_init(|| {
            which_sync("node")
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        })
        .clone()
}

fn which_sync(binary: &str) -> Result<PathBuf, ()> {
    let mut command = std::process::Command::new(if cfg!(windows) { "where" } else { "which" });
    command
        .arg(binary)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    // Suppress the visible console window that would otherwise flash when
    // a GUI application spawns a console child process on Windows.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command.output().map_err(|_| ())?;
    if !output.status.success() {
        return Err(());
    }
    output
        .stdout
        .split(|&b| b == b'\n' || b == b'\r')
        .next()
        .filter(|line| !line.is_empty())
        .map(|line| PathBuf::from(String::from_utf8_lossy(line).trim().to_string()))
        .ok_or(())
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut unique = Vec::new();
    for path in paths {
        if path.as_os_str().is_empty() {
            continue;
        }

        if !unique.iter().any(|existing| existing == &path) {
            unique.push(path);
        }
    }
    unique
}
