import type { ErrorSummaryItem } from "../../types/logs";

export interface ErrorSummaryPanelProps {
  summaries: ErrorSummaryItem[];
  isCopying: boolean;
  isExporting: boolean;
  isExportingBundle: boolean;
  copyFeedback: string | null;
  exportFeedback: string | null;
  bundleFeedback: string | null;
  onCopy: () => void;
  onExport: () => void;
  onExportBundle: () => void;
}

function SeverityBadge({ severity }: { severity: ErrorSummaryItem["severity"] }): JSX.Element {
  const styleMap = {
    high: { bg: "#fee2e2", color: "#991b1b" },
    medium: { bg: "#fef3c7", color: "#92400e" },
    low: { bg: "#e2e8f0", color: "#334155" },
  } as const;
  const style = styleMap[severity];

  return (
    <span
      style={{
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        textTransform: "uppercase",
      }}
    >
      {severity}
    </span>
  );
}

export function ErrorSummaryPanel({
  summaries,
  isCopying,
  isExporting,
  isExportingBundle,
  copyFeedback,
  exportFeedback,
  bundleFeedback,
  onCopy,
  onExport,
  onExportBundle,
}: ErrorSummaryPanelProps): JSX.Element {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 14,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0 }}>错误摘要</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCopy}
            disabled={isCopying}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              cursor: isCopying ? "not-allowed" : "pointer",
              opacity: isCopying ? 0.7 : 1,
            }}
          >
            {isCopying ? "复制中..." : "复制诊断摘要"}
          </button>

          <button
            type="button"
            onClick={onExport}
            disabled={isExporting}
            style={{
              border: "none",
              background: "#1d4ed8",
              color: "#ffffff",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              cursor: isExporting ? "not-allowed" : "pointer",
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? "导出中..." : "导出诊断信息"}
          </button>

          <button
            type="button"
            onClick={onExportBundle}
            disabled={isExportingBundle}
            style={{
              border: "1px solid #1d4ed8",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              cursor: isExportingBundle ? "not-allowed" : "pointer",
              opacity: isExportingBundle ? 0.7 : 1,
            }}
          >
            {isExportingBundle ? "打包中..." : "导出诊断包 ZIP"}
          </button>
        </div>
      </div>

      {copyFeedback ? (
        <p style={{ margin: 0, fontSize: 13, color: "#0369a1" }}>{copyFeedback}</p>
      ) : null}
      {exportFeedback ? (
        <p style={{ margin: 0, fontSize: 13, color: "#0369a1" }}>{exportFeedback}</p>
      ) : null}
      {bundleFeedback ? (
        <p style={{ margin: 0, fontSize: 13, color: "#0369a1" }}>{bundleFeedback}</p>
      ) : null}

      {summaries.length === 0 ? (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            borderRadius: 10,
            padding: 12,
            color: "#475569",
          }}
        >
          未检测到明确错误。若服务仍异常，请尝试更换关键字或检查完整日志上下文。
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {summaries.map((item) => (
            <article
              key={item.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <SeverityBadge severity={item.severity} />
                <strong>{item.title}</strong>
                {item.code ? (
                  <span style={{ fontSize: 12, color: "#64748b" }}>{item.code}</span>
                ) : null}
                <span style={{ fontSize: 12, color: "#64748b" }}>命中 {item.count} 次</span>
              </div>
              <p style={{ margin: 0, color: "#334155" }}>{item.message}</p>
              <p style={{ margin: 0, color: "#475569" }}>建议：{item.suggestion}</p>
              {item.samples.length > 0 ? (
                <div
                  style={{
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: 8,
                    fontSize: 12,
                    color: "#334155",
                    fontFamily: "Consolas, Menlo, Monaco, monospace",
                  }}
                >
                  {item.samples.map((sample, index) => (
                    <div key={`${item.id}-sample-${index}`}>{sample}</div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
