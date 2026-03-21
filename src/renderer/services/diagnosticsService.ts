import {
  LOG_SOURCE_OPTIONS,
  type DiagnosticSummary,
  type ExportDiagnosticsData,
  type LogSource,
} from "../types/logs";

export type DiagnosticsExportFormat = "text" | "bundle";

export function buildDiagnosticSummaryText(payload: DiagnosticSummary, lines: string[]): string {
  const sourceLabel = LOG_SOURCE_OPTIONS.find((item) => item.value === payload.source)?.label ?? payload.source;
  const summaryHeader = [
    "ClawDesk 诊断摘要",
    `时间: ${new Date(payload.generatedAt).toLocaleString()}`,
    `日志类型: ${sourceLabel}`,
    `关键字过滤: ${payload.keyword || "(无)"}`,
    `总行数: ${payload.totalLines}`,
    `可见行数: ${payload.visibleLines}`,
  ];

  const summaryBody =
    payload.summaries.length === 0
      ? ["未提炼出明确错误摘要。"]
      : payload.summaries.flatMap((item, index) => {
          const samples = item.samples.map((sample) => `    - ${sample}`);
          return [
            `${index + 1}. [${item.severity.toUpperCase()}] ${item.title}${item.code ? ` (${item.code})` : ""}`,
            `   说明: ${item.message}`,
            `   建议: ${item.suggestion}`,
            `   命中次数: ${item.count}`,
            ...samples,
          ];
        });

  const tail = ["", "---- 原始日志（前 120 行） ----", ...lines.slice(0, 120)];

  return [...summaryHeader, "", ...summaryBody, ...tail].join("\n");
}

export function buildDiagnosticsDownloadName(
  source: LogSource,
  format: DiagnosticsExportFormat,
  timestamp = Date.now(),
): string {
  const extension = format === "bundle" ? "zip" : "txt";
  return `clawdesk-diagnostics-${source}-${timestamp}.${extension}`;
}

export function buildExportFeedback(
  format: DiagnosticsExportFormat,
  data?: ExportDiagnosticsData,
): string {
  const path = data?.filePath;
  const count = data?.includedFiles?.length ?? 0;
  if (!path) {
    return format === "bundle" ? "诊断包已导出。" : "诊断信息已导出。";
  }
  return format === "bundle"
    ? count > 0
      ? `诊断包已导出到 ${path}（共 ${count} 个文件）`
      : `诊断包已导出到 ${path}`
    : `诊断信息已导出到 ${path}`;
}
