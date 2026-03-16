export type DashboardEmbedPhase = "loading" | "loaded" | "timeout" | "blocked";

export interface DashboardEmbedPresentation {
  title: string;
  detail: string;
  suggestion: string;
}
