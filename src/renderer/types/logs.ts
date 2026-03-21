import type { BackendError, CommandResult } from "./api";

export type LogSource = "install" | "startup" | "gateway";

export type ErrorSeverity = "high" | "medium" | "low";

export interface ReadLogsData {
  source?: string;
  lines?: string[];
  content?: string;
  path?: string;
  truncated?: boolean;
  exists?: boolean;
}

export interface ExportDiagnosticsData {
  filePath?: string;
  format?: "text" | "bundle";
  includedFiles?: string[];
}

export interface ErrorHint {
  id: string;
  title: string;
  message: string;
  suggestion: string;
  severity: ErrorSeverity;
  code?: string;
}

export interface ErrorSummaryItem extends ErrorHint {
  count: number;
  samples: string[];
}

export interface DiagnosticSummary {
  generatedAt: string;
  source: LogSource;
  keyword: string;
  totalLines: number;
  visibleLines: number;
  summaries: ErrorSummaryItem[];
}

export interface LogSourceOption {
  value: LogSource;
  label: string;
}

export const LOG_SOURCE_OPTIONS: LogSourceOption[] = [
  { value: "install", label: "安装日志" },
  { value: "startup", label: "启动日志" },
  { value: "gateway", label: "Gateway 日志" },
];

export type { BackendError, CommandResult };
