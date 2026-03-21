import { defaultOpenclawConfigPath } from "../adapters/platform.js";
import { runCommand, runInVisibleTerminal } from "../adapters/shell.js";
import type { ShellOutput } from "../adapters/shell.js";
import { ensureOpenclawAvailable, invalidateDetectEnvCache } from "./env-service.js";
import { classifyInstallError, classifyInstallOutput, installErrorFromError, installErrorFromOutput } from "./install-issue.js";
import type { InstallIssue } from "./install-issue.js";
import { appendLogLine, LogSource } from "./log-service.js";
import { AppError } from "../models/error.js";

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const GATEWAY_INSTALL_TIMEOUT_MS = 60 * 1000;

export interface InstallOpenClawData {
  cliInstalled: boolean;
  gatewayServiceInstalled: boolean;
  executablePath?: string;
  configPath: string;
  installOutput: ShellOutput;
  serviceInstallOutput?: ShellOutput;
  gatewayInstallIssue?: InstallIssue;
  notes: string[];
}

export interface TerminalInstallData {
  launched: boolean;
  message: string;
}

export async function installOpenclaw(): Promise<InstallOpenClawData> {
  writeInstallLog(`[info] ${new Date().toISOString()} install_openclaw started`);
  writePhaseEvent("install-cli", "running", "Installing OpenClaw CLI via the official installer script.");

  const { program, args, step } = buildOfficialInstallCommand();
  let installOutput: ShellOutput;
  try {
    installOutput = await runCommand(program, args, INSTALL_TIMEOUT_MS);
  } catch (error) {
    const appErr = error instanceof Error ? error : new Error(String(error));
    writeErrorToLog(step, appErr as AppError);
    writePhaseEvent("install-cli", "failure", "OpenClaw CLI install command could not be started successfully.");
    throw installErrorFromError("install-cli", step, appErr as AppError);
  }

  writeShellOutputToLog(step, installOutput);

  if ((installOutput.exitCode ?? 1) !== 0) {
    writePhaseEvent("install-cli", "failure", "OpenClaw CLI install command returned a non-zero exit code.");
    throw installErrorFromOutput("install-cli", step, installOutput);
  }

  writePhaseEvent("install-cli", "success", "OpenClaw CLI install finished.");
  await invalidateDetectEnvCache();

  let executablePath: string;
  try {
    executablePath = await ensureOpenclawAvailable();
  } catch (error) {
    const appErr = error instanceof Error ? error : new Error(String(error));
    writeErrorToLog("resolve openclaw executable path", appErr as AppError);
    writePhaseEvent("verify", "failure", "OpenClaw executable path could not be resolved after installation.");
    throw installErrorFromError("verify", "resolve openclaw executable path", appErr as AppError);
  }

  writePhaseEvent("install-gateway", "running", "Installing Gateway managed service.");
  const gatewayStep = "openclaw gateway install --json";

  let serviceInstallOutput: ShellOutput | undefined;
  let gatewayInstallIssue: InstallIssue | undefined;

  try {
    const gatewayOutput = await runCommand(executablePath, ["gateway", "install", "--json"], GATEWAY_INSTALL_TIMEOUT_MS);
    writeShellOutputToLog(gatewayStep, gatewayOutput);
    serviceInstallOutput = gatewayOutput;

    if ((gatewayOutput.exitCode ?? 1) === 0) {
      writePhaseEvent("install-gateway", "success", "Gateway managed install finished.");
    } else {
      writePhaseEvent("install-gateway", "failure", "Gateway managed install returned a non-zero exit code.");
      gatewayInstallIssue = classifyInstallOutput("install-gateway", gatewayStep, gatewayOutput);
    }
  } catch (error) {
    const appErr = error instanceof Error ? error : new Error(String(error));
    writeErrorToLog(gatewayStep, appErr as AppError);
    writePhaseEvent("install-gateway", "failure", "Gateway managed install command failed before completion.");
    gatewayInstallIssue = classifyInstallError("install-gateway", gatewayStep, appErr as AppError);
  }

  const gatewayServiceInstalled = !gatewayInstallIssue;
  const notes: string[] = [];
  if (gatewayInstallIssue) {
    notes.push(gatewayInstallIssue.message);
    notes.push(gatewayInstallIssue.suggestion);
  } else {
    writePhaseEvent("verify", "running", "Validating final install result.");
  }

  writeInstallLog(
    `[info] ${new Date().toISOString()} install_openclaw completed cliInstalled=true gatewayServiceInstalled=${gatewayServiceInstalled}`,
  );
  if (gatewayServiceInstalled) {
    writePhaseEvent("verify", "success", "Install flow completed.");
  }

  return {
    cliInstalled: true,
    gatewayServiceInstalled,
    executablePath,
    configPath: defaultOpenclawConfigPath(),
    installOutput,
    serviceInstallOutput,
    gatewayInstallIssue,
    notes,
  };
}

export async function installOpenclawWithTerminal(): Promise<TerminalInstallData> {
  writeInstallLog(`[info] ${new Date().toISOString()} install_openclaw_with_terminal started`);
  const { program, args } = buildOfficialInstallCommand();
  await runInVisibleTerminal(program, args, "OpenClaw Installer");
  writeInstallLog("[info] install terminal window launched successfully");
  return {
    launched: true,
    message: "Installation terminal opened. Check the terminal window for live progress and results.",
  };
}

// ---- helpers ----

function buildOfficialInstallCommand(): { program: string; args: string[]; step: string } {
  const noOnboard = (process.env["OPENCLAW_NO_ONBOARD"] ?? "").trim() !== "0"
    ? true : false;
  const version = (process.env["OPENCLAW_VERSION"] ?? "").trim() || "latest";

  if (process.platform === "win32") {
    const method = (process.env["OPENCLAW_INSTALL_METHOD"] ?? "").trim() || "npm";
    const flags: string[] = [];
    flags.push(`-Tag ${sanitizePsArg(version)}`);
    flags.push(`-InstallMethod ${sanitizePsArg(method)}`);
    if (noOnboard) flags.push("-NoOnboard");

    const command = `& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) ${flags.join(" ")}`;
    return {
      program: "powershell",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      step: "powershell install.ps1",
    };
  }

  // macOS / Linux / WSL
  const argParts: string[] = [];
  if (noOnboard) argParts.push("--no-onboard");
  argParts.push("--version", version, "--json");
  if (!noOnboard) argParts.push("--onboard");

  const argStr = argParts.map(shellQuoteBash).join(" ");
  const command = `curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- ${argStr}`;
  return { program: "bash", args: ["-lc", command], step: "bash install-cli.sh" };
}

function sanitizePsArg(value: string): string {
  const trimmed = value.trim();
  let out = "";
  for (const ch of trimmed) {
    if (/[a-zA-Z0-9\-_.]/.test(ch)) out += ch;
  }
  return out || "latest";
}

function shellQuoteBash(value: string): string {
  if (!value) return "''";
  if (!value.includes("'")) return `'${value}'`;
  return value.split("'").map((part) => `'${part}'`).join("'\\''");
}

function writeShellOutputToLog(step: string, output: ShellOutput): void {
  writeInstallLog(`[info] step=${step} exitCode=${output.exitCode ?? null} durationMs=${output.durationMs}`);
  for (const line of output.stdout.split("\n")) {
    if (line.trim()) writeInstallLog(`[stdout] ${line}`);
  }
  for (const line of output.stderr.split("\n")) {
    if (line.trim()) writeInstallLog(`[stderr] ${line}`);
  }
}

function writeErrorToLog(step: string, error: AppError): void {
  writeInstallLog(`[error] step=${step} code=${(error as { code?: string }).code ?? "E_INTERNAL"} message=${error.message}`);
  if ((error as { details?: unknown }).details !== undefined) {
    writeInstallLog(`[error-details] ${JSON.stringify((error as { details?: unknown }).details)}`);
  }
}

function writePhaseEvent(stage: string, state: string, detail: string): void {
  writeInstallLog(`[phase] stage=${stage} state=${state} detail=${detail}`);
}

function writeInstallLog(line: string): void {
  try {
    appendLogLine(LogSource.Install, line);
  } catch (err) {
    console.error("install log append failed:", err);
  }
}
