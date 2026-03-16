import { useEffect, useMemo, useRef, useState } from "react";
import { buildDashboardEmbedPresentation, inferDashboardEmbedPhase } from "../../services/dashboardEmbedState";
import type { DashboardEmbedPhase } from "../../types/dashboard";

export interface DashboardFrameProps {
  src: string;
  frameKey: number;
  onReloadFrame: () => void;
  onOpenExternal: () => void;
  onOpenSetupAssistant: () => void;
  onRestartGateway: () => void;
  timeoutMs?: number;
}

function ActionButton(props: {
  label: string;
  onClick: () => void;
  variant?: "primary" | "neutral";
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: props.variant === "primary" ? "none" : "1px solid #cbd5e1",
        borderRadius: 8,
        background: props.variant === "primary" ? "#0f172a" : "#ffffff",
        color: props.variant === "primary" ? "#ffffff" : "#0f172a",
        padding: "10px 14px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {props.label}
    </button>
  );
}

export function DashboardFrame({
  src,
  frameKey,
  onReloadFrame,
  onOpenExternal,
  onOpenSetupAssistant,
  onRestartGateway,
  timeoutMs = 3000,
}: DashboardFrameProps): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [phase, setPhase] = useState<DashboardEmbedPhase>("loading");

  useEffect(() => {
    setPhase("loading");
    const timer = window.setTimeout(() => {
      setPhase((current) => (current === "loading" ? "timeout" : current));
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [frameKey, src, timeoutMs]);

  const presentation = useMemo(() => buildDashboardEmbedPresentation(phase), [phase]);

  const handleLoad = (): void => {
    let inspectedHref: string | null = null;
    let inspectionFailed = false;

    try {
      inspectedHref = iframeRef.current?.contentWindow?.location?.href ?? null;
    } catch {
      inspectionFailed = true;
    }

    setPhase(inferDashboardEmbedPhase({ inspectedHref, inspectionFailed }));
  };

  return (
    <section
      style={{
        position: "relative",
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        overflow: "hidden",
        background: "#0f172a",
        minHeight: "72vh",
      }}
    >
      <iframe
        ref={iframeRef}
        key={frameKey}
        title="OpenClaw Dashboard"
        src={src}
        onLoad={handleLoad}
        style={{
          width: "100%",
          minHeight: "72vh",
          border: "none",
          background: "#ffffff",
        }}
      />

      {phase !== "loaded" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: phase === "loading" ? "rgba(248, 250, 252, 0.92)" : "rgba(255, 255, 255, 0.96)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: 720,
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              background: "#ffffff",
              padding: 20,
              display: "grid",
              gap: 12,
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
            }}
          >
            <h3 style={{ margin: 0 }}>{presentation.title}</h3>
            <p style={{ margin: 0, color: "#475569" }}>{presentation.detail}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{presentation.suggestion}</p>
            {phase === "loading" ? (
              <div
                aria-label="Dashboard loading"
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "42%",
                    height: "100%",
                    background: "#2563eb",
                    borderRadius: 999,
                  }}
                />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <ActionButton label="Reload Frame" onClick={onReloadFrame} variant="primary" />
                <ActionButton label="Open External" onClick={onOpenExternal} />
                {phase === "blocked" ? (
                  <ActionButton label="Restart Gateway" onClick={onRestartGateway} />
                ) : null}
                <ActionButton label="Open Setup Assistant" onClick={onOpenSetupAssistant} />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
