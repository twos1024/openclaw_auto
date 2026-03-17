import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useRunbook } from "../hooks/useRunbook";
import { useShellActions } from "../hooks/useShellActions";
import { OverviewPage } from "./OverviewPage";

export function HomeEntryPage(): JSX.Element {
  const { model, isLoading, errorText } = useRunbook(true);
  const { openSetupAssistant } = useShellActions();
  const [hasAutoOpened, setHasAutoOpened] = useState<boolean>(false);

  useEffect(() => {
    if (!hasAutoOpened && model?.currentBlocker) {
      openSetupAssistant();
      setHasAutoOpened(true);
    }
  }, [hasAutoOpened, model?.currentBlocker, openSetupAssistant]);

  if (model && !model.currentBlocker) {
    return <Navigate to={model.primaryRoute} replace />;
  }

  if (isLoading) {
    return (
      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 20,
          display: "grid",
          gap: 8,
        }}
      >
        <strong style={{ color: "#0f172a" }}>正在准备新手引导</strong>
        <p style={{ margin: 0, color: "#475569" }}>正在判断你现在应该先做哪一步。</p>
      </section>
    );
  }

  if (model?.currentBlocker) {
    return <OverviewPage autoRefreshMs={15000} />;
  }

  return (
    <section
      style={{
        border: "1px solid #fecaca",
        borderRadius: 12,
        background: "#fef2f2",
        padding: 20,
        display: "grid",
        gap: 8,
      }}
    >
      <strong style={{ color: "#991b1b" }}>无法进入新手引导</strong>
      <p style={{ margin: 0, color: "#7f1d1d" }}>
        {errorText ?? "当前无法判断下一步。你可以先打开概览页或安装页继续。"}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          to="/overview"
          style={{
            display: "inline-block",
            borderRadius: 8,
            background: "#0f172a",
            color: "#ffffff",
            padding: "8px 12px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          打开概览
        </Link>
        <Link
          to="/install?wizard=1"
          style={{
            display: "inline-block",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            padding: "8px 12px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          打开安装向导
        </Link>
      </div>
    </section>
  );
}
