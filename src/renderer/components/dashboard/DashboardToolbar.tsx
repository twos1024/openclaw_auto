import { useTranslation } from "react-i18next";

export interface DashboardToolbarProps {
  address: string | null;
  statusDetail: string;
  isRunning: boolean;
  isRefreshing: boolean;
  isRestarting: boolean;
  isOpeningExternal: boolean;
  onRefreshStatus: () => void;
  onReloadFrame: () => void;
  onRestart: () => void;
  onOpenExternal: () => void;
}

function ToolbarButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        background: props.disabled ? "#f8fafc" : "#ffffff",
        color: "#0f172a",
        padding: "10px 14px",
        fontWeight: 700,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.65 : 1,
      }}
    >
      {props.label}
    </button>
  );
}

export function DashboardToolbar({
  address,
  statusDetail,
  isRunning,
  isRefreshing,
  isRestarting,
  isOpeningExternal,
  onRefreshStatus,
  onReloadFrame,
  onRestart,
  onOpenExternal,
}: DashboardToolbarProps): JSX.Element {
  const { t } = useTranslation("dashboard");

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0 }}>{t("toolbar.title")}</h2>
        <p style={{ margin: 0, color: "#475569" }}>{statusDetail}</p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{t("toolbar.endpoint")} {address ?? "-"}</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ToolbarButton
          label={isRefreshing ? t("toolbar.refreshing") : t("toolbar.refreshStatus")}
          onClick={onRefreshStatus}
          disabled={isRefreshing}
        />
        <ToolbarButton label={t("toolbar.reloadFrame")} onClick={onReloadFrame} disabled={!isRunning} />
        <ToolbarButton
          label={isRestarting ? t("toolbar.restarting") : t("toolbar.restartGateway")}
          onClick={onRestart}
          disabled={!isRunning || isRestarting}
        />
        <ToolbarButton
          label={isOpeningExternal ? t("toolbar.opening") : t("toolbar.openExternal")}
          onClick={onOpenExternal}
          disabled={!isRunning || isOpeningExternal}
        />
      </div>
    </section>
  );
}
