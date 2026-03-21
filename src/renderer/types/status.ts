import type { BackendError } from "./api";

export type HealthLevel = "healthy" | "degraded" | "offline" | "unknown";

export interface StatusItem {
  id: string;
  title: string;
  level: HealthLevel;
  detail: string;
  updatedAt: string;
}

export interface OverviewSection extends StatusItem {
  route: string;
  ctaLabel: string;
  meta?: Array<{
    label: string;
    value: string;
  }>;
}

export interface OverviewOverall {
  level: HealthLevel;
  headline: string;
  summary: string;
  updatedAt: string;
}

export interface OverviewAction {
  id: string;
  label: string;
  route: string;
  description: string;
  kind?: "route" | "open-dashboard";
}

export interface OverviewStatus {
  appVersion: string;
  platform: string;
  dashboardUrl: string;
  mode: "live" | "preview" | "runtime-unavailable";
  overall: OverviewOverall;
  service: OverviewSection;
  runtime: OverviewSection;
  config: OverviewSection;
  install: OverviewSection;
  settings: OverviewSection;
  nextActions: OverviewAction[];
}

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: BackendError;
}
