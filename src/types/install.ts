import type { BackendError } from "./api";

export interface InstallEnvironment {
  platform: string;
  architecture: string;
  homeDir: string | null;
  configPath: string;
  npmFound: boolean;
  npmVersion: string | null;
  openclawFound: boolean;
  openclawPath: string | null;
  openclawVersion: string | null;
}

export interface InstallOpenClawData {
  cliInstalled: boolean;
  gatewayServiceInstalled: boolean;
  executablePath?: string | null;
  configPath: string;
  installOutput?: ShellCommandOutput;
  serviceInstallOutput?: ShellCommandOutput | null;
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

export type InstallPhaseStatus = "success" | "warning" | "failure" | "pending";

export interface InstallPhase {
  id: InstallPhaseId;
  title: string;
  status: InstallPhaseStatus;
  detail: string;
  suggestion: string;
  code?: string;
}

export interface InstallActionResult {
  status: "success" | "warning" | "failure" | "error";
  stage: InstallPhaseId;
  detail: string;
  suggestion: string;
  code?: string;
  phases: InstallPhase[];
  data?: InstallOpenClawData;
}

export interface InstallEnvResult {
  ok: boolean;
  data?: InstallEnvironment;
  error?: BackendError;
}
