import { NoticeBanner } from "../components/common/NoticeBanner";
import { PageHero } from "../components/common/PageHero";
import { ErrorSummaryPanel } from "../components/logs/ErrorSummaryPanel";
import { LogFilterBar, LogViewer } from "../components/logs/LogViewer";
import { RunbookContextPanel } from "../components/runbook/RunbookContextPanel";
import { useLogs } from "../hooks/useLogs";
import { useRunbook } from "../hooks/useRunbook";

export function LogsPage(): JSX.Element {
  const { model: runbookModel } = useRunbook(true, 30000);
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
      <PageHero
        title="Logs"
        description="Logs page is now part of the guided recovery flow. Use it to verify whether install, startup, or gateway failures already produced useful diagnostics before changing config or service state."
        meta={`总日志 ${rawLines.length} 行，过滤后 ${visibleLines.length} 行${lastUpdatedAt ? `，最近更新：${new Date(lastUpdatedAt).toLocaleString()}` : ""}`}
      />

      {loadError ? (
        <NoticeBanner title="日志读取提示" tone="error">
          <p style={{ margin: "8px 0 0" }}>{loadError}</p>
        </NoticeBanner>
      ) : null}

      <RunbookContextPanel
        title="Recovery Context"
        description="Logs are usually the fastest way to validate whether the current blocker is install-, config-, or service-related. Use the quick links to jump back once you know where the fault sits."
        model={runbookModel}
      />

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
