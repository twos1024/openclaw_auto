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

export interface GuidedSetupModel {
  headline: string;
  summary: string;
  primaryRoute: string;
  primaryLabel: string;
  steps: GuidedSetupStep[];
}
