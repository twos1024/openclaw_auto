export type GuidedSetupStepId = "install" | "config" | "service" | "dashboard";

export type GuidedSetupStepStatus = "complete" | "current" | "blocked" | "ready";

export interface GuidedSetupStep {
  id: GuidedSetupStepId;
  title: string;
  description: string;
  route: string;
  actionLabel: string;
  status: GuidedSetupStepStatus;
}

export interface GuidedLaunchCheck {
  id: "install" | "config" | "service";
  title: string;
  level: "healthy" | "degraded" | "offline" | "unknown";
  detail: string;
  route: string;
}

export interface GuidedSetupModel {
  headline: string;
  summary: string;
  primaryRoute: string;
  primaryLabel: string;
  lastCheckedAt: string;
  launchChecks: GuidedLaunchCheck[];
  steps: GuidedSetupStep[];
}
