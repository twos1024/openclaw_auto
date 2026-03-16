import { ErrorSummaryPanel } from "../components/logs/ErrorSummaryPanel";
import { LogFilterBar, LogViewer } from "../components/logs/LogViewer";
import { useLogs } from "../hooks/useLogs";

export function LogsPage(): JSX.Element {
  const {
    source,
    sourceOptions,
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
  } = useLogs("gateway");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 8 }}>LogsPage</h2>
        <p style={{ margin: 0, color: "#64748b" }}>
          查看安装/启动/Gateway 日志，自动提炼错误摘要并生成可分享诊断信息。
        </p>
        <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 13 }}>
          总日志 {rawLines.length} 行，过滤后 {visibleLines.length} 行
          {lastUpdatedAt ? `，最近更新：${new Date(lastUpdatedAt).toLocaleString()}` : ""}
        </p>
      </header>

      {loadError ? (
        <section
          style={{
            border: "1px solid #fca5a5",
            borderRadius: 10,
            background: "#fef2f2",
            color: "#991b1b",
            padding: 12,
          }}
        >
          <strong>日志读取提示</strong>
          <p style={{ margin: "8px 0 0" }}>{loadError}</p>
        </section>
      ) : null}

      <LogFilterBar
        source={source}
        sourceOptions={sourceOptions}
        keyword={keyword}
        onSourceChange={setSource}
        onKeywordChange={setKeyword}
        onRefresh={() => void refreshLogs()}
        isRefreshing={isLoading}
      />

      <ErrorSummaryPanel
        summaries={summaries}
        isCopying={isCopying}
        isExporting={isExporting}
        isExportingBundle={isExportingBundle}
        copyFeedback={copyFeedback}
        exportFeedback={exportFeedback}
        bundleFeedback={bundleFeedback}
        onCopy={() => void copyDiagnosticSummary()}
        onExport={() => void exportDiagnostics()}
        onExportBundle={() => void exportDiagnosticsBundle()}
      />

      <LogViewer
        lines={visibleLines}
        keyword={keyword}
        isLoading={isLoading}
        emptyText="当前过滤条件下没有日志。"
      />
    </div>
  );
}
