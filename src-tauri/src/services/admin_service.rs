use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminStatusData {
    pub is_elevated: bool,
    pub platform: String,
    pub elevation_required: bool,
    pub detail: String,
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelaunchResult {
    pub launched: bool,
    pub message: String,
}

/// Check if the current process is running with administrator / root privileges.
pub fn check_admin_status() -> AdminStatusData {
    #[cfg(windows)]
    {
        let elevated = is_elevated_windows();
        AdminStatusData {
            is_elevated: elevated,
            platform: "windows".to_string(),
            elevation_required: true,
            detail: if elevated {
                "ClawDesk 正在以管理员权限运行。".to_string()
            } else {
                "ClawDesk 未以管理员权限运行。部分功能（如安装 Gateway 系统服务）需要管理员权限。"
                    .to_string()
            },
            suggestion: if elevated {
                "权限已满足，可以正常使用所有功能。".to_string()
            } else {
                "请右键点击 ClawDesk 图标，选择「以管理员身份运行」，或点击「提升权限」按钮重新启动。".to_string()
            },
        }
    }

    #[cfg(not(windows))]
    {
        AdminStatusData {
            is_elevated: true,
            platform: std::env::consts::OS.to_string(),
            elevation_required: false,
            detail: "当前平台无需管理员权限检查。".to_string(),
            suggestion: "可以正常使用所有功能。".to_string(),
        }
    }
}

/// Re-launch the current executable with administrator privileges (Windows only).
/// Returns immediately after spawning the elevated process — the caller should
/// exit the current process after calling this.
pub fn relaunch_as_admin() -> RelaunchResult {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let current_exe = match std::env::current_exe() {
            Ok(path) => path,
            Err(error) => {
                return RelaunchResult {
                    launched: false,
                    message: format!("无法获取当前可执行文件路径：{error}"),
                }
            }
        };

        // Use PowerShell Start-Process with -Verb RunAs to trigger UAC elevation.
        let exe_str = current_exe.to_string_lossy().to_string();
        let ps_command = format!("Start-Process -FilePath '{}' -Verb RunAs", exe_str);

        let result = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_command])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        match result {
            Ok(_) => RelaunchResult {
                launched: true,
                message: "已请求以管理员权限重新启动 ClawDesk，当前窗口将自动关闭。".to_string(),
            },
            Err(error) => RelaunchResult {
                launched: false,
                message: format!("提权重启失败：{error}。请手动右键选择「以管理员身份运行」。"),
            },
        }
    }

    #[cfg(not(windows))]
    {
        RelaunchResult {
            launched: false,
            message: "当前平台不需要提升管理员权限。".to_string(),
        }
    }
}

// ─── Windows helpers ─────────────────────────────────────────────────────────

#[cfg(windows)]
fn is_elevated_windows() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // `net session` succeeds only when running as an administrator on Windows.
    // It is a well-known admin check that doesn't require any native API crate.
    std::process::Command::new("net")
        .arg("session")
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}
