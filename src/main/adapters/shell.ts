import { execFile, execFileSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { AppError, ErrorCode } from "../models/error.js";
import { normalizedPathEnv } from "./platform.js";

export interface ShellOutput {
  program: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export async function runCommand(
  program: string,
  args: string[],
  timeoutMs: number,
): Promise<ShellOutput> {
  const startedAt = Date.now();

  const pathEnv = normalizedPathEnv();
  const env = pathEnv
    ? { ...process.env, PATH: pathEnv }
    : { ...process.env };

  return new Promise<ShellOutput>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      // On Windows, kill the process tree to avoid orphan node/npm processes
      if (process.platform === "win32" && child.pid) {
        try {
          execFileSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
            windowsHide: true,
            timeout: 5000,
          });
        } catch {
          // ignore — process may have already exited
        }
      }
    }, timeoutMs);

    const child = execFile(
      program,
      args,
      {
        env,
        windowsHide: true,
        timeout: 0, // we manage timeout ourselves
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      },
      (error, stdout, stderr) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startedAt;

        if (controller.signal.aborted) {
          reject(
            new AppError(
              ErrorCode.ShellTimeout,
              `Command timed out after ${timeoutMs}ms.`,
              "Increase timeout or inspect whether the command is blocked.",
              { program, args, timeoutMs },
            ),
          );
          return;
        }

        if (error && !stdout && !stderr) {
          // Spawn failure (ENOENT, EACCES, etc.) — no output captured
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            reject(
              new AppError(
                ErrorCode.ShellSpawnFailed,
                `Failed to spawn command: ${program}`,
                "Check whether the binary exists and is executable.",
                { program, args, osError: error.message },
              ),
            );
            return;
          }
        }

        // execFile treats non-zero exit as an error but still provides stdout/stderr
        const exitCode =
          error && (error as NodeJS.ErrnoException & { code?: number }).code !== undefined &&
          typeof (error as NodeJS.ErrnoException & { exitCode?: number }).exitCode === "number"
            ? (error as NodeJS.ErrnoException & { exitCode?: number }).exitCode ?? null
            : error
              ? 1
              : 0;

        resolve({
          program,
          args,
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode,
          durationMs,
        });
      },
    );
  });
}

/** Opens a new, visible terminal window and runs a command in it. Returns immediately. */
export async function runInVisibleTerminal(
  program: string,
  args: string[],
  title: string,
): Promise<void> {
  const cmdStr = buildCommandString(program, args);

  if (process.platform === "win32") {
    const batContent = buildBatScript(title, cmdStr);
    const batPath = path.join(os.tmpdir(), `clawdesk-launcher-${process.pid}-${Date.now()}.bat`);
    fs.writeFileSync(batPath, batContent, "utf8");

    spawn("cmd", ["/c", "start", `"${title}"`, batPath], {
      detached: true,
      windowsHide: false, // the launched window should be visible
      shell: false,
    }).unref();
  } else if (process.platform === "darwin") {
    const inner =
      `echo ''; echo '  ${title}'; echo '  ===================='; echo ''; ` +
      `${cmdStr}; exitcode=$?; echo ''; ` +
      `if [ "$exitcode" = "0" ]; then echo '  [OK] Completed successfully.'; ` +
      `else echo "  [FAILED] Exit code $exitcode. Check output above."; fi; ` +
      `echo ''; read -p '  Press Enter to close...' _x`;
    const script = `tell application "Terminal"\n  activate\n  do script "${inner.replace(/"/g, '\\"')}"\nend tell`;
    spawn("osascript", ["-e", script], { detached: true }).unref();
  } else {
    // Linux — try common terminal emulators
    const shellCmd =
      `echo ''; echo '  ${title}'; echo '  ===================='; echo ''; ` +
      `${cmdStr}; exitcode=$?; echo ''; ` +
      `if [ "$exitcode" = "0" ]; then echo '  [OK] Completed successfully.'; ` +
      `else echo "  [FAILED] Exit code $exitcode."; fi; ` +
      `echo ''; read -p '  Press Enter to close...' _x`;

    const launched = tryLaunchLinuxTerminal(title, shellCmd);
    if (!launched) {
      throw new AppError(
        ErrorCode.ShellSpawnFailed,
        `No terminal emulator found to run: ${program}`,
        "Install a terminal emulator (xterm, gnome-terminal, konsole) and retry.",
        { program },
      );
    }
  }
}

function buildCommandString(program: string, args: string[]): string {
  return [program, ...args]
    .map((part) => (part.includes(" ") || part === "" ? `"${part.replace(/"/g, '\\"')}"` : part))
    .join(" ");
}

function buildBatScript(title: string, cmdStr: string): string {
  const invoke = cmdStr.toLowerCase().split(/\s/)[0]?.endsWith(".cmd")
    ? `call ${cmdStr}`
    : cmdStr;
  return (
    `@echo off\r\n` +
    `title ${title}\r\n` +
    `echo.\r\n` +
    `echo   ${title}\r\n` +
    `echo   ====================\r\n` +
    `echo.\r\n` +
    `echo   Running: ${cmdStr}\r\n` +
    `echo.\r\n` +
    `${invoke}\r\n` +
    `if %errorlevel% equ 0 (\r\n` +
    `    echo.\r\n` +
    `    echo   [OK] Completed successfully.\r\n` +
    `) else (\r\n` +
    `    echo.\r\n` +
    `    echo   [FAILED] Command returned exit code %errorlevel%.\r\n` +
    `    echo   Check the output above for details.\r\n` +
    `)\r\n` +
    `echo.\r\n` +
    `pause\r\n`
  );
}

function tryLaunchLinuxTerminal(title: string, shellCmd: string): boolean {
  try {
    spawn("gnome-terminal", ["--", "bash", "-c", shellCmd], { detached: true }).unref();
    return true;
  } catch {
    // try others
  }

  for (const term of ["x-terminal-emulator", "xterm", "konsole", "xfce4-terminal"]) {
    try {
      spawn(term, ["-title", title, "-e", "bash", "-c", shellCmd], {
        detached: true,
      }).unref();
      return true;
    } catch {
      // try next
    }
  }
  return false;
}
