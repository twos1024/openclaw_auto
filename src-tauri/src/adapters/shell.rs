use std::collections::HashSet;
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

use crate::adapters::platform;
use crate::models::error::{AppError, ErrorCode};

// ─── Active child PID registry ──────────────────────────────────────────────
// Tracks PIDs of in-flight child processes so that we can kill their entire
// process trees on application exit.  On Windows, `kill_on_drop` only
// terminates the direct child (cmd.exe) — grandchildren (node.exe) survive.

static ACTIVE_CHILD_PIDS: OnceLock<Mutex<HashSet<u32>>> = OnceLock::new();

fn active_child_pids() -> &'static Mutex<HashSet<u32>> {
    ACTIVE_CHILD_PIDS.get_or_init(|| Mutex::new(HashSet::new()))
}

async fn register_child_pid(pid: u32) {
    active_child_pids().lock().await.insert(pid);
}

async fn unregister_child_pid(pid: u32) {
    active_child_pids().lock().await.remove(&pid);
}

/// Kill all tracked child process trees.  Called once during application
/// shutdown to prevent orphan `node.exe` processes on Windows.
pub async fn kill_all_active_children() {
    let pids: Vec<u32> = {
        let mut set = active_child_pids().lock().await;
        let pids: Vec<u32> = set.drain().collect();
        pids
    };

    #[cfg(windows)]
    for pid in pids {
        kill_process_tree_windows(pid);
    }

    #[cfg(not(windows))]
    let _ = pids;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellOutput {
    pub program: String,
    pub args: Vec<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
}

pub async fn run_command(
    program: &str,
    args: &[String],
    timeout_ms: u64,
) -> Result<ShellOutput, AppError> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // On Windows, prevent spawned processes from opening visible console
    // windows.  Tauri is a GUI application, so child processes must not
    // flash terminal windows to the user.
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(path_env) = platform::normalized_path_env() {
        command.env("PATH", path_env);
    }

    // Limit the V8 heap of spawned Node.js processes to prevent
    // memory exhaustion on Windows, where each `openclaw.cmd` invocation
    // starts a full `node.exe` instance.  CLI commands (status, version)
    // need far less than the default ~1.4 GB heap.  Only set this when
    // the caller has not already configured NODE_OPTIONS.
    if std::env::var_os("NODE_OPTIONS").is_none() {
        command.env("NODE_OPTIONS", "--max-old-space-size=256");
    }

    let started_at = Instant::now();
    let child = command.spawn().map_err(|error| {
        AppError::new(
            ErrorCode::ShellSpawnFailed,
            format!("Failed to spawn command: {program}"),
            "Check whether the binary exists and is executable.",
        )
        .with_details(json!({
            "program": program,
            "args": args,
            "os_error": error.to_string()
        }))
    })?;

    // Capture the PID now — wait_with_output() consumes the Child, so we
    // must read the PID before handing ownership to the timeout future.
    let child_pid = child.id();

    // Track the PID so we can kill the entire process tree on app exit.
    if let Some(pid) = child_pid {
        register_child_pid(pid).await;
    }

    let timeout_result = timeout(Duration::from_millis(timeout_ms), child.wait_with_output()).await;

    // Unregister the PID now that the child has finished (or timed out).
    if let Some(pid) = child_pid {
        unregister_child_pid(pid).await;
    }

    match timeout_result {
        Err(_elapsed) => {
            // kill_on_drop kills the direct child process, but on Windows
            // grandchild processes (e.g. node spawned by npm.cmd) are NOT in
            // the same job object and survive.  Use taskkill /T to terminate
            // the entire process tree so no orphan processes are left behind.
            #[cfg(windows)]
            if let Some(pid) = child_pid {
                kill_process_tree_windows(pid);
            }

            Err(AppError::new(
                ErrorCode::ShellTimeout,
                format!("Command timed out after {timeout_ms}ms."),
                "Increase timeout or inspect whether the command is blocked.",
            )
            .with_details(json!({
                "program": program,
                "args": args,
                "timeout_ms": timeout_ms
            })))
        }

        Ok(Err(wait_error)) => Err(AppError::new(
            ErrorCode::ShellWaitFailed,
            "Failed while waiting for command output.",
            "Retry the action and check system process limits.",
        )
        .with_details(json!({
            "program": program,
            "args": args,
            "os_error": wait_error.to_string()
        }))),

        Ok(Ok(output)) => Ok(ShellOutput {
            program: program.to_string(),
            args: args.to_vec(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code(),
            duration_ms: started_at.elapsed().as_millis(),
        }),
    }
}

/// Opens a new, persistent terminal window and runs the given command inside
/// it.  The window stays open after the command finishes so the user can read
/// the output and close it manually.  Returns immediately — the caller does
/// NOT wait for the command to complete.
///
/// Use this for long-running install operations where the user benefits from
/// seeing live progress instead of polling a hidden background process.
pub async fn run_in_visible_terminal(
    program: &str,
    args: &[String],
    title: &str,
) -> Result<(), AppError> {
    let cmd_str = build_command_string(program, args);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Write a small .bat launcher to the temp directory.  Inlining the
        // script directly in the `start` argument list is unreliable due to
        // cmd.exe quoting rules; a dedicated file avoids all escaping issues.
        let bat_content = build_bat_script(title, &cmd_str);
        let bat_path =
            std::env::temp_dir().join(format!("clawdesk-launcher-{}.bat", std::process::id()));

        tokio::fs::write(&bat_path, bat_content.as_bytes())
            .await
            .map_err(|e| {
                AppError::new(
                    ErrorCode::ShellSpawnFailed,
                    "Failed to write install launcher script to temp directory.",
                    "Check that the system temp directory is writable and retry.",
                )
                .with_details(json!({
                    "path": bat_path.to_string_lossy(),
                    "os_error": e.to_string()
                }))
            })?;

        // `start "title" file.bat` opens a new console window running the bat.
        // The outer cmd.exe is hidden (CREATE_NO_WINDOW) — only the launched
        // window is visible.
        let bat_str = bat_path.to_string_lossy().to_string();
        std::process::Command::new("cmd")
            .args(["/c", "start", &format!("\"{title}\""), &bat_str])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| {
                AppError::new(
                    ErrorCode::ShellSpawnFailed,
                    format!("Failed to open terminal window for: {program}"),
                    "Check whether cmd.exe is available on the system PATH.",
                )
                .with_details(json!({
                    "program": program,
                    "os_error": e.to_string()
                }))
            })?;
    }

    #[cfg(target_os = "macos")]
    {
        // Use osascript to open Terminal.app with the command.  The `read`
        // at the end keeps the shell session open after completion.
        let inner = format!(
            "echo ''; echo '  {title}'; echo '  ===================='; echo ''; \
             {cmd_str}; exitcode=$?; echo ''; \
             if [ \"$exitcode\" = \"0\" ]; then \
               echo '  [OK] Completed successfully.'; \
             else \
               echo \"  [FAILED] Exit code $exitcode. Check output above.\"; \
             fi; echo ''; read -p '  Press Enter to close...' _x"
        );
        let script = format!(
            "tell application \"Terminal\"\n  activate\n  do script \"{}\"\nend tell",
            inner.replace('"', "\\\"")
        );
        std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| {
                AppError::new(
                    ErrorCode::ShellSpawnFailed,
                    format!("Failed to open Terminal.app for: {program}"),
                    "Check whether Terminal.app is accessible on this system.",
                )
                .with_details(json!({ "program": program, "os_error": e.to_string() }))
            })?;
    }

    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let shell_cmd = format!(
            "echo ''; echo '  {title}'; echo '  ===================='; echo ''; \
             {cmd_str}; exitcode=$?; echo ''; \
             if [ \"$exitcode\" = \"0\" ]; then \
               echo '  [OK] Completed successfully.'; \
             else \
               echo \"  [FAILED] Exit code $exitcode. Check output above.\"; \
             fi; echo ''; read -p '  Press Enter to close...' _x"
        );

        if !try_launch_linux_terminal(title, &shell_cmd) {
            return Err(AppError::new(
                ErrorCode::ShellSpawnFailed,
                format!("No terminal emulator found to run: {program}"),
                "Install a terminal emulator (xterm, gnome-terminal, konsole) and retry.",
            )
            .with_details(json!({ "program": program })));
        }
    }

    Ok(())
}

// ─── helpers ────────────────────────────────────────────────────────────────

/// Serialize program + args into a single command string suitable for
/// embedding in shell scripts.  Parts containing spaces are quoted.
fn build_command_string(program: &str, args: &[String]) -> String {
    std::iter::once(program)
        .chain(args.iter().map(String::as_str))
        .map(|part| {
            if part.contains(' ') || part.is_empty() {
                format!("\"{}\"", part.replace('"', "\\\""))
            } else {
                part.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(windows)]
fn build_bat_script(title: &str, cmd_str: &str) -> String {
    // On Windows, .cmd batch files must be invoked with `call` from inside
    // another batch script, otherwise control never returns to the caller.
    let invoke = if cmd_str
        .split_whitespace()
        .next()
        .map(|p| p.to_ascii_lowercase().ends_with(".cmd"))
        .unwrap_or(false)
    {
        format!("call {cmd_str}")
    } else {
        cmd_str.to_string()
    };

    format!(
        "@echo off\r\n\
         title {title}\r\n\
         echo.\r\n\
         echo   {title}\r\n\
         echo   ====================\r\n\
         echo.\r\n\
         echo   Running: {cmd_str}\r\n\
         echo.\r\n\
         {invoke}\r\n\
         if %errorlevel% equ 0 (\r\n\
             echo.\r\n\
             echo   [OK] Completed successfully.\r\n\
         ) else (\r\n\
             echo.\r\n\
             echo   [FAILED] Command returned exit code %errorlevel%.\r\n\
             echo   Check the output above for details.\r\n\
         )\r\n\
         echo.\r\n\
         pause\r\n"
    )
}

/// On Windows, forcibly terminate the entire process tree rooted at `pid`.
/// This supplements `kill_on_drop` which only kills the direct child process —
/// grandchildren spawned by npm / node are NOT automatically terminated.
#[cfg(windows)]
fn kill_process_tree_windows(pid: u32) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    // Ignore the result — the process may have already exited by the time we
    // reach here, and taskkill will return a non-zero exit code in that case.
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

/// Try common Linux terminal emulators in priority order.  Returns `true` if
/// at least one launcher succeeded.
#[cfg(all(not(windows), not(target_os = "macos")))]
fn try_launch_linux_terminal(title: &str, shell_cmd: &str) -> bool {
    // gnome-terminal uses `--` to separate its args from the command args.
    if std::process::Command::new("gnome-terminal")
        .args(["--", "bash", "-c", shell_cmd])
        .spawn()
        .is_ok()
    {
        return true;
    }

    // Most other emulators accept `-e` followed by the shell invocation.
    for term in &["x-terminal-emulator", "xterm", "konsole", "xfce4-terminal"] {
        if std::process::Command::new(term)
            .args(["-title", title, "-e", "bash", "-c", shell_cmd])
            .spawn()
            .is_ok()
        {
            return true;
        }
    }

    false
}
