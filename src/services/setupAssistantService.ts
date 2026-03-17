import type { GuidedSetupModel } from "../types/guidedSetup";
import type { OverviewStatus } from "../types/status";
import { buildRunbookModel } from "./runbookService";

export function buildSetupAssistantModel(status: OverviewStatus): GuidedSetupModel {
  const runbook = buildRunbookModel(status);
  return {
    headline: runbook.headline,
    summary: runbook.summary,
    primaryRoute: runbook.primaryRoute,
    primaryLabel: runbook.primaryLabel,
    lastCheckedAt: runbook.lastCheckedAt,
    launchChecks: runbook.launchChecks,
    steps: runbook.steps,
  };
}
