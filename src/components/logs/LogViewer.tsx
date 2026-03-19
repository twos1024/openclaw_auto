import { useTranslation } from "react-i18next";
import type { LogSource, LogSourceOption } from "../../types/logs";

export interface LogFilterBarProps {
  source: LogSource;
  sourceOptions: LogSourceOption[];
  keyword: string;
  onSourceChange: (source: LogSource) => void;
  onKeywordChange: (keyword: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export interface LogViewerProps {
  lines: string[];
  keyword: string;
  isLoading?: boolean;
  emptyText?: string;
}

function renderHighlightedLine(line: string, keyword: string): JSX.Element {
  if (!keyword.trim()) return <>{line}</>;

  const lowerLine = line.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const chunks: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;

  while (cursor < line.length) {
    const index = lowerLine.indexOf(lowerKeyword, cursor);
    if (index === -1) {
      chunks.push({ text: line.slice(cursor), hit: false });
      break;
    }

    if (index > cursor) {
      chunks.push({ text: line.slice(cursor, index), hit: false });
    }
    chunks.push({
      text: line.slice(index, index + keyword.length),
      hit: true,
    });
    cursor = index + keyword.length;
  }

  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.hit ? (
          <mark
            key={`${chunk.text}-${index}`}
            style={{ background: "#fde68a", color: "#7c2d12", padding: "0 2px" }}
          >
            {chunk.text}
          </mark>
        ) : (
          <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
        ),
      )}
    </>
  );
}

export function LogFilterBar({
  source,
  sourceOptions,
  keyword,
  onSourceChange,
  onKeywordChange,
  onRefresh,
  isRefreshing,
}: LogFilterBarProps): JSX.Element {
  const { t } = useTranslation(["logs"]);
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sourceOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onSourceChange(item.value)}
            style={{
              border: source === item.value ? "none" : "1px solid #cbd5e1",
              background: source === item.value ? "#0f172a" : "#ffffff",
              color: source === item.value ? "#ffffff" : "#334155",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={t("logs:viewer.filterPlaceholder")}
          style={{
            flex: "1 1 360px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={Boolean(isRefreshing)}
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: isRefreshing ? "not-allowed" : "pointer",
            opacity: isRefreshing ? 0.7 : 1,
          }}
        >
          {isRefreshing ? t("logs:viewer.actions.refreshing") : t("logs:viewer.actions.refresh")}
        </button>
      </div>
    </section>
  );
}

export function LogViewer({
  lines,
  keyword,
  isLoading,
  emptyText,
}: LogViewerProps): JSX.Element {
  const { t } = useTranslation(["logs"]);
  const resolvedEmptyText = emptyText ?? t("logs:viewer.empty");
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#0f172a",
        color: "#e2e8f0",
        padding: 12,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10, color: "#cbd5e1", fontSize: 15 }}>
        {t("logs:viewer.title", { count: lines.length })}
      </h3>

      <div
        style={{
          fontFamily: "Consolas, Menlo, Monaco, monospace",
          fontSize: 12,
          lineHeight: 1.5,
          maxHeight: 420,
          overflow: "auto",
          border: "1px solid #334155",
          borderRadius: 8,
          background: "#020617",
          padding: 10,
        }}
      >
        {isLoading ? (
          <p style={{ margin: 0, color: "#94a3b8" }}>{t("logs:viewer.loading")}</p>
        ) : lines.length === 0 ? (
          <p style={{ margin: 0, color: "#94a3b8" }}>{resolvedEmptyText}</p>
        ) : (
          lines.map((line, index) => (
            <div key={`${index}-${line.slice(0, 16)}`} style={{ whiteSpace: "pre-wrap" }}>
              <span style={{ color: "#64748b", marginRight: 8 }}>{String(index + 1).padStart(4, "0")}</span>
              {renderHighlightedLine(line, keyword)}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
