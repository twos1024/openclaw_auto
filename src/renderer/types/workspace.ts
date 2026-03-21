import type { GuidedLaunchCheck, GuidedSetupStep } from "./guidedSetup";
import type { HealthLevel } from "./status";

export type WorkspaceBannerTone = "info" | "warning" | "error" | "success";
export type WorkspaceBannerMode = "live" | "preview" | "runtime-unavailable";

export interface WorkspaceBannerAction {
  label: string;
  route: string;
  description: string;
}

export interface WorkspaceBannerModel {
  mode: WorkspaceBannerMode;
  tone: WorkspaceBannerTone;
  headline: string;
  summary: string;
  primaryAction: WorkspaceBannerAction | null;
  meta: Array<{
    label: string;
    value: string;
  }>;
}

export interface RunbookBlocker {
  id: string;
  title: string;
  detail: string;
  level: HealthLevel;
  route: string;
  actionLabel: string;
}

export interface RunbookSupportAction {
  id: string;
  label: string;
  route: string;
  description: string;
}

export interface RunbookModel {
  headline: string;
  summary: string;
  primaryRoute: string;
  primaryLabel: string;
  lastCheckedAt: string;
  overallLevel: HealthLevel;
  launchChecks: GuidedLaunchCheck[];
  steps: GuidedSetupStep[];
  blockers: RunbookBlocker[];
  currentBlocker: RunbookBlocker | null;
  supportActions: RunbookSupportAction[];
  banner: WorkspaceBannerModel;
}
