import type { BackendError } from "./api";

export interface InstallEnvironment {
  platform: string;
  architecture: string;
  homeDir: string | null;
  configPath: string;
  nodeFound: boolean;
  nodeVersion: string | null;
  nodePath: string | null;
  npmFound: boolean;
  npmVersion: string | null;
  openclawFound: boolean;
  openclawPath: string | null;
  openclawVersion: string | null;
}

export interface InstallOpenClawData {
  cliInstalled: boolean;
  gatewayServiceInstalled: boolean;
  gatewayServiceDeferred?: boolean;
  executablePath?: string | null;
  configPath: string;
  installOutput?: ShellCommandOutput;
  serviceInstallOutput?: ShellCommandOutput | null;
  gatewayInstallIssue?: InstallIssue | null;
  notes: string[];
}

export interface ShellCommandOutput {
  program: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  durationMs: number;
}

export type InstallPhaseId = "prerequisite" | "install-cli" | "install-gateway" | "verify";

export type InstallPhaseStatus = "success" | "warning" | "failure" | "pending" | "running";

export interface InstallPhase {
  id: InstallPhaseId;
  title: string;
  status: InstallPhaseStatus;
  detail: string;
  suggestion: string;
  code?: string;
}

export type InstallProgressTone = "idle" | "running" | "success" | "warning" | "failure" | "blocked";

export interface InstallProgressModel {
  visible: boolean;
  percent: number;
  tone: InstallProgressTone;
  activePhaseId: InstallPhaseId | null;
  headline: string;
  detail: string;
  hint: string;
}

export type InstallTelemetryState = "running" | "success" | "failure" | "warning";

export interface InstallTelemetry {
  activePhaseId: InstallPhaseId;
  phaseState: InstallTelemetryState;
  phaseStatus: InstallPhaseStatus;
  detail: string | null;
  latestLogLine: string | null;
}

export type InstallFailureKind =
  | "missing-npm"
  | "permission-denied"
  | "network-failure"
  | "command-timeout"
  | "gateway-install-failed"
  | "unknown"
  | string;

export interface InstallIssue {
  stage: InstallPhaseId;
  failureKind: InstallFailureKind;
  code: string;
  message: string;
  suggestion: string;
  step: string;
  exitCode?: number | null;
  sample?: string | null;
}

export interface InstallActionResult {
  status: "success" | "warning" | "failure" | "error";
  stage: InstallPhaseId;
  detail: string;
  suggestion: string;
  code?: string;
  phases: InstallPhase[];
  issue?: InstallIssue;
  data?: InstallOpenClawData;
}

export interface InstallEnvResult {
  ok: boolean;
  data?: InstallEnvironment;
  error?: BackendError;
}

export interface TerminalInstallData {
  launched: boolean;
  message: string;
}
