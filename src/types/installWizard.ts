import type { InstallActionResult, InstallEnvironment } from "./install";

export type PlatformKey = "windows" | "macos" | "linux" | "unknown";

export interface PlatformGuidanceCard {
  platform: PlatformKey;
  title: string;
  installSource: string;
  pathHint: string;
  troubleshooting: string;
  isCurrent: boolean;
}

export interface InstallWizardStep {
  id: "environment" | "install" | "config" | "service" | "dashboard";
  title: string;
  description: string;
  route: string;
  actionLabel: string;
  status: "complete" | "current" | "blocked";
}

export interface InstallWizardModel {
  headline: string;
  summary: string;
  primaryRoute: string;
  primaryLabel: string;
  steps: InstallWizardStep[];
}

export interface BuildInstallWizardArgs {
  environment: InstallEnvironment | null;
  installResult: InstallActionResult | null;
  configReady?: boolean;
  serviceReady?: boolean;
}
