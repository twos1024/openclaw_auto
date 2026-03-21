import { spawn, execFileSync } from "child_process";

export interface AdminStatusData {
  isElevated: boolean;
  platform: string;
  elevationRequired: boolean;
  detail: string;
  suggestion: string;
}

export interface RelaunchResult {
  launched: boolean;
  message: string;
}

export function checkAdminStatus(): AdminStatusData {
  if (process.platform === "win32") {
    const elevated = isElevatedWindows();
    return {
      isElevated: elevated,
      platform: "windows",
      elevationRequired: true,
      detail: elevated
        ? "ClawDesk 正在以管理员权限运行。"
        : "ClawDesk 未以管理员权限运行。部分功能（如安装 Gateway 系统服务）需要管理员权限。",
      suggestion: elevated
        ? "权限已满足，可以正常使用所有功能。"
        : "请右键点击 ClawDesk 图标，选择「以管理员身份运行」，或点击「提升权限」按钮重新启动。",
    };
  }

  return {
    isElevated: true,
    platform: process.platform,
    elevationRequired: false,
    detail: "当前平台无需管理员权限检查。",
    suggestion: "可以正常使用所有功能。",
  };
}

export function relaunchAsAdmin(): RelaunchResult {
  if (process.platform === "win32") {
    try {
      const exePath = process.execPath;
      spawn("cmd", ["/c", `runas /user:Administrator "${exePath}"`], {
        detached: true,
        shell: false,
        windowsHide: true,
      }).unref();
      return { launched: true, message: "Elevated process launched successfully." };
    } catch (e: unknown) {
      return { launched: false, message: `Failed to relaunch as admin: ${(e as Error)?.message ?? String(e)}` };
    }
  }
  // Non-Windows: no elevation needed
  return { launched: false, message: "Elevation is only supported on Windows." };
}

function isElevatedWindows(): boolean {
  try {
    // `net session` returns 0 if elevated, non-zero if not
    execFileSync("net", ["session"], { windowsHide: true, stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
