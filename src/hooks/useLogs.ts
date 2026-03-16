import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LOG_SOURCE_OPTIONS,
  type DiagnosticSummary,
  type ErrorSummaryItem,
  type LogSource,
  type ReadLogsData,
} from "../types/logs";
import {
  buildDiagnosticSummaryText,
  buildDiagnosticsDownloadName,
  buildExportFeedback,
  type DiagnosticsExportFormat,
} from "../services/diagnosticsService";
import { settingsService } from "../services/settingsService";
import { invokeCommand, isTauriRuntime } from "../services/tauriClient";
import { extractErrorSummaries, mapErrorCode, mapStderr } from "../utils/errorMap";

export interface UseLogsResult {
  source: LogSource;
  sourceOptions: typeof LOG_SOURCE_OPTIONS;
  keyword: string;
  rawLines: string[];
  visibleLines: string[];
  summaries: ErrorSummaryItem[];
  isLoading: boolean;
  isExporting: boolean;
  isExportingBundle: boolean;
  isCopying: boolean;
  loadError: string | null;
  lastUpdatedAt: string | null;
  copyFeedback: string | null;
  exportFeedback: string | null;
  bundleFeedback: string | null;
  setSource: (source: LogSource) => void;
  setKeyword: (keyword: string) => void;
  refreshLogs: () => Promise<void>;
  copyDiagnosticSummary: () => Promise<void>;
  exportDiagnostics: () => Promise<void>;
  exportDiagnosticsBundle: () => Promise<void>;
}

function normalizeReadLogsData(data: unknown, fallbackSource: LogSource): string[] {
  if (!data || typeof data !== "object") {
    return [];
  }
  const obj = data as ReadLogsData;

  if (Array.isArray(obj.lines)) {
    return obj.lines.map((line) => String(line));
  }

  if (typeof obj.content === "string") {
    return obj.content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  }

  if (obj.source && obj.source !== fallbackSource) {
    return [];
  }

  return [];
}

function extractErrorTextFromBackend(error?: { code?: string; message?: string; suggestion?: string }): string {
  if (!error) return "读取日志失败，请检查后端命令是否可用。";

  const codeHint = mapErrorCode(error.code);
  if (codeHint) {
    return `${codeHint.title}：${codeHint.message} 建议：${codeHint.suggestion}`;
  }

  const stderrHint = mapStderr(error.message ?? "");
  if (stderrHint) {
    return `${stderrHint.title}：${stderrHint.message} 建议：${stderrHint.suggestion}`;
  }

  return `${error.message ?? "读取日志失败"}${error.suggestion ? `；建议：${error.suggestion}` : ""}`;
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function useLogs(initialSource: LogSource = "gateway"): UseLogsResult {
  const [source, setSource] = useState<LogSource>(initialSource);
  const [keyword, setKeyword] = useState<string>("");
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingBundle, setIsExportingBundle] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [bundleFeedback, setBundleFeedback] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lineLimit, setLineLimit] = useState<number>(1200);

  const visibleLines = useMemo(() => {
    if (!keyword.trim()) return rawLines;
    const query = keyword.toLowerCase();
    return rawLines.filter((line) => line.toLowerCase().includes(query));
  }, [keyword, rawLines]);

  const summaries = useMemo(() => extractErrorSummaries(visibleLines), [visibleLines]);

  const diagnosticSummary = useMemo<DiagnosticSummary>(
    () => ({
      generatedAt: new Date().toISOString(),
      source,
      keyword,
      totalLines: rawLines.length,
      visibleLines: visibleLines.length,
      summaries,
    }),
    [keyword, rawLines.length, source, summaries, visibleLines.length],
  );

  const refreshLogs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setExportFeedback(null);
    setBundleFeedback(null);

    if (!isTauriRuntime()) {
      setRawLines([]);
      setLoadError("当前运行在浏览器预览模式，无法读取本地日志文件。");
      setLastUpdatedAt(new Date().toISOString());
      setIsLoading(false);
      return;
    }

    try {
      const result = await invokeCommand<ReadLogsData>("read_logs", {
        source,
        lines: lineLimit,
      });

      if (!result.success) {
        setLoadError(extractErrorTextFromBackend(result.error));
        setRawLines([]);
        setLastUpdatedAt(new Date().toISOString());
        setIsLoading(false);
        return;
      }

      const lines = normalizeReadLogsData(result.data, source);
      setRawLines(lines);
      setLastUpdatedAt(new Date().toISOString());
      setIsLoading(false);
    } catch (error: unknown) {
      const stderrHint = mapStderr(error instanceof Error ? error.message : "");
      setLoadError(
        stderrHint
          ? `${stderrHint.title}：${stderrHint.message} 建议：${stderrHint.suggestion}`
          : error instanceof Error
            ? error.message
            : "读取日志出现未知错误。",
      );
      setRawLines([]);
      setLastUpdatedAt(new Date().toISOString());
      setIsLoading(false);
    }
  }, [lineLimit, source]);

  const copyDiagnosticSummary = useCallback(async () => {
    setIsCopying(true);
    setCopyFeedback(null);

    const text = buildDiagnosticSummaryText(diagnosticSummary, visibleLines);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("诊断摘要已复制到剪贴板。");
    } catch {
      setCopyFeedback("复制失败，请检查系统剪贴板权限。");
    } finally {
      setIsCopying(false);
    }
  }, [diagnosticSummary, visibleLines]);

  const runExport = useCallback(
    async (format: DiagnosticsExportFormat) => {
      const setLoading = format === "bundle" ? setIsExportingBundle : setIsExporting;
      const setFeedback = format === "bundle" ? setBundleFeedback : setExportFeedback;
      setLoading(true);
      setFeedback(null);

      const text = buildDiagnosticSummaryText(diagnosticSummary, visibleLines);
      if (!isTauriRuntime()) {
        const filename = buildDiagnosticsDownloadName(source, "text");
        downloadTextFile(filename, text);
        setFeedback(
          format === "bundle"
            ? `当前为预览模式，已回退导出文本摘要 ${filename}`
            : `诊断信息已导出：${filename}`,
        );
        setLoading(false);
        return;
      }

      try {
        const result = await invokeCommand<{ filePath?: string; format?: "text" | "bundle"; includedFiles?: string[] }>(
          "export_diagnostics",
          {
            source,
            keyword,
            summary: diagnosticSummary,
            lines: visibleLines,
            content: text,
            archive: format === "bundle",
          },
        );

        if (result.success) {
          setFeedback(buildExportFeedback(format, result.data));
        } else {
          const message = extractErrorTextFromBackend(result.error);
          const filename = buildDiagnosticsDownloadName(source, "text");
          downloadTextFile(filename, text);
          setFeedback(`后端导出失败：${message}，已回退本地导出 ${filename}`);
        }
      } catch (error: unknown) {
        const filename = buildDiagnosticsDownloadName(source, "text");
        downloadTextFile(filename, text);
        setFeedback(
          error instanceof Error
            ? `后端导出异常：${error.message}；已回退本地导出 ${filename}`
            : `后端导出异常；已回退本地导出 ${filename}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [diagnosticSummary, keyword, source, visibleLines],
  );

  const exportDiagnostics = useCallback(async () => {
    await runExport("text");
  }, [runExport]);

  const exportDiagnosticsBundle = useCallback(async () => {
    await runExport("bundle");
  }, [runExport]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async (): Promise<void> => {
      const result = await settingsService.readSettings();
      if (!mounted) return;
      setLineLimit(result.values.logLineLimit);
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  return {
    source,
    sourceOptions: LOG_SOURCE_OPTIONS,
    keyword,
    rawLines,
    visibleLines,
    summaries,
    isLoading,
    isExporting,
    isExportingBundle,
    isCopying,
    loadError,
    lastUpdatedAt,
    copyFeedback,
    exportFeedback,
    bundleFeedback,
    setSource,
    setKeyword,
    refreshLogs,
    copyDiagnosticSummary,
    exportDiagnostics,
    exportDiagnosticsBundle,
  };
}
