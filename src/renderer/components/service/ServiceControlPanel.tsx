import { useTranslation } from "react-i18next";
import type { GatewayStatus, ServiceActionResult } from "../../services/serviceService";

export interface ServiceControlPanelProps {
  status: GatewayStatus | null;
  lastActionResult: ServiceActionResult | null;
  isRefreshing: boolean;
  loadingByAction: Record<"start" | "stop" | "restart" | "openDashboard", boolean>;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onOpenDashboard: () => void;
}

function Badge({ status }: { status: GatewayStatus | null }): JSX.Element {
  const { t } = useTranslation("service");
  const state = status?.state ?? "error";
  const styleMap = {
    running: { bg: "#dcfce7", color: "#166534" },
    stopped: { bg: "#e2e8f0", color: "#334155" },
    starting: { bg: "#dbeafe", color: "#1d4ed8" },
    stopping: { bg: "#fef3c7", color: "#92400e" },
    error: { bg: "#fee2e2", color: "#991b1b" },
  } as const;
  const style = styleMap[state];

  return (
    <span
      style={{
        display: "inline-block",
        background: style.bg,
        color: style.color,
        fontWeight: 700,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        textTransform: "uppercase",
      }}
    >
      {t(`state.${state}`)}
    </span>
  );
}

function ActionButton(props: {
  label: string;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant: "primary" | "danger" | "secondary" | "neutral";
}): JSX.Element {
  const styleMap = {
    primary: { bg: "#0f766e", color: "#ffffff", border: "none" },
    danger: { bg: "#dc2626", color: "#ffffff", border: "none" },
    secondary: { bg: "#1d4ed8", color: "#ffffff", border: "none" },
    neutral: { bg: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1" },
  } as const;
  const style = styleMap[props.variant];
  const disabled = props.disabled || props.loading;

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      style={{
        border: style.border,
        background: style.bg,
        color: style.color,
        borderRadius: 8,
        padding: "10px 14px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {props.loading ? `${props.label}...` : props.label}
    </button>
  );
}

export function ServiceControlPanel({
  status,
  lastActionResult,
  isRefreshing,
  loadingByAction,
  onRefresh,
  onStart,
  onStop,
  onRestart,
  onOpenDashboard,
}: ServiceControlPanelProps): JSX.Element {
  const { t } = useTranslation("service");
  const busy = Object.values(loadingByAction).some(Boolean) || isRefreshing;
  const isRunning = Boolean(status?.running);

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>{t("controls.title")}</h3>
          <p style={{ margin: 0, color: "#64748b" }}>
            {status?.statusDetail ?? t("controls.waiting")}
          </p>
        </div>
        <Badge status={status} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionButton
          label={t("controls.refresh")}
          loading={isRefreshing}
          disabled={busy}
          onClick={onRefresh}
          variant="neutral"
        />
        <ActionButton
          label={t("controls.start")}
          loading={loadingByAction.start}
          disabled={busy || isRunning}
          onClick={onStart}
          variant="primary"
        />
        <ActionButton
          label={t("controls.stop")}
          loading={loadingByAction.stop}
          disabled={busy || !isRunning}
          onClick={onStop}
          variant="danger"
        />
        <ActionButton
          label={t("controls.restart")}
          loading={loadingByAction.restart}
          disabled={busy || !isRunning}
          onClick={onRestart}
          variant="secondary"
        />
        <ActionButton
          label={t("controls.openDashboard")}
          loading={loadingByAction.openDashboard}
          disabled={busy || !isRunning}
          onClick={onOpenDashboard}
          variant="neutral"
        />
      </div>

      {lastActionResult ? (
        <div
          style={{
            border:
              lastActionResult.status === "success"
                ? "1px solid #86efac"
                : lastActionResult.status === "failure"
                  ? "1px solid #fcd34d"
                  : "1px solid #fca5a5",
            borderRadius: 8,
            padding: 12,
            background:
              lastActionResult.status === "success"
                ? "#f0fdf4"
                : lastActionResult.status === "failure"
                  ? "#fffbeb"
                  : "#fef2f2",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{lastActionResult.detail}</p>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>{lastActionResult.suggestion}</p>
          {lastActionResult.code ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
              {t("controls.errorCode")}
              {lastActionResult.code}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
