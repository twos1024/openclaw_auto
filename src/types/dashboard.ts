export type DashboardEmbedPhase = "loading" | "loaded" | "timeout" | "blocked";

export interface DashboardEmbedPresentation {
  title: string;
  detail: string;
  suggestion: string;
}

export type DashboardProbeState =
  | "idle"
  | "probing"
  | "reachable"
  | "timeout"
  | "unreachable"
  | "invalid-address";

export interface DashboardProbeResult {
  address: string;
  reachable: boolean;
  result: DashboardProbeState;
  httpStatus: number | null;
  responseTimeMs: number | null;
  detail: string;
}

export type DashboardDiagnosticsTone = "healthy" | "warning" | "error" | "neutral";

export interface DashboardDiagnosticsItem {
  id: "embed" | "gateway" | "probe" | "external-open";
  title: string;
  tone: DashboardDiagnosticsTone;
  detail: string;
  meta?: string;
}

export interface DashboardDiagnosticsModel {
  items: DashboardDiagnosticsItem[];
  platformNote: string;
}
