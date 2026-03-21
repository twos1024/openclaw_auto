import { useTranslation } from "react-i18next";
import { NoticeBanner } from "../components/common/NoticeBanner";
import { PageHero } from "../components/common/PageHero";
import { ErrorSummaryPanel } from "../components/logs/ErrorSummaryPanel";
import { LogFilterBar, LogViewer } from "../components/logs/LogViewer";
import { RunbookContextPanel } from "../components/runbook/RunbookContextPanel";
import { useLogs } from "../hooks/useLogs";
import { useRunbook } from "../hooks/useRunbook";

export function LogsPage(): JSX.Element {
  const { t } = useTranslation(["logs"]);
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
        title={t("logs:page.title")}
        description={t("logs:page.description")}
        meta={lastUpdatedAt
          ? t("logs:page.metaWithUpdatedAt", {
              total: rawLines.length,
              visible: visibleLines.length,
              updatedAt: new Date(lastUpdatedAt).toLocaleString(),
            })
          : t("logs:page.meta", {
              total: rawLines.length,
              visible: visibleLines.length,
            })}
      />

      {loadError ? (
        <NoticeBanner title={t("logs:page.loadErrorTitle")} tone="error">
          <p style={{ margin: "8px 0 0" }}>{loadError}</p>
        </NoticeBanner>
      ) : null}

      <RunbookContextPanel
        title={t("logs:page.runbook.title")}
        description={t("logs:page.runbook.description")}
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
        emptyText={t("logs:viewer.empty")}
      />
    </div>
  );
}
