import type {
  InstallPhaseId,
  InstallPhaseStatus,
  InstallTelemetry,
  InstallTelemetryState,
} from "../types/install";

const phaseEventPattern =
  /^\[phase\]\s+stage=(?<stage>[a-z-]+)\s+state=(?<state>[a-z]+)(?:\s+detail=(?<detail>.+))?$/u;

function isInstallPhaseId(value: string): value is InstallPhaseId {
  return value === "prerequisite" || value === "install-cli" || value === "install-gateway" || value === "verify";
}

function isTelemetryState(value: string): value is InstallTelemetryState {
  return value === "running" || value === "success" || value === "failure" || value === "warning";
}

function sanitizeLogLine(line: string): string {
  return line.replace(/^\[(?:stdout|stderr|info|error|error-details)\]\s*/u, "").trim();
}

function toPhaseStatus(state: InstallTelemetryState): InstallPhaseStatus {
  if (state === "warning") return "warning";
  return state;
}

export function parseInstallTelemetry(lines: string[]): InstallTelemetry | null {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  let latestEvent:
    | {
        activePhaseId: InstallPhaseId;
        phaseState: InstallTelemetryState;
        detail: string | null;
      }
    | null = null;
  let latestLogLine: string | null = null;
  let latestEventIndex = -1;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = String(lines[index] ?? "").trim();
    if (!line) continue;

    const match = phaseEventPattern.exec(line);
    if (match?.groups) {
      const stage = match.groups.stage;
      const state = match.groups.state;
      if (isInstallPhaseId(stage) && isTelemetryState(state)) {
        latestEvent = {
          activePhaseId: stage,
          phaseState: state,
          detail: match.groups.detail?.trim() ?? null,
        };
        latestEventIndex = index;
        break;
      }
      continue;
    }
  }

  if (!latestEvent) {
    return null;
  }

  for (let index = latestEventIndex - 1; index >= 0; index -= 1) {
    const rawLine = String(lines[index] ?? "").trim();
    if (phaseEventPattern.test(rawLine)) {
      continue;
    }
    const sanitized = sanitizeLogLine(rawLine);
    if (sanitized) {
      latestLogLine = sanitized;
      break;
    }
  }

  return {
    activePhaseId: latestEvent.activePhaseId,
    phaseState: latestEvent.phaseState,
    phaseStatus: toPhaseStatus(latestEvent.phaseState),
    detail: latestEvent.detail,
    latestLogLine,
  };
}
