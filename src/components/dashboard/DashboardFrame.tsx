import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildDashboardEmbedPresentation, inferDashboardEmbedPhase } from "../../services/dashboardEmbedState";
import type { DashboardEmbedPhase } from "../../types/dashboard";

export interface DashboardFrameProps {
  src: string;
  frameKey: number;
  onReloadFrame: () => void;
  onOpenExternal: () => void;
  onOpenSetupAssistant: () => void;
  onRestartGateway: () => void;
  onPhaseChange?: (phase: DashboardEmbedPhase) => void;
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
      className={
        props.variant === "primary"
          ? "rounded-lg border-none bg-slate-900 px-3.5 py-2.5 text-sm font-bold text-white"
          : "rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-bold text-foreground"
      }
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
  onPhaseChange,
  timeoutMs = 3000,
}: DashboardFrameProps): JSX.Element {
  const { t } = useTranslation("dashboard");
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

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

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
    <section className="relative overflow-hidden rounded-2xl border border-border bg-slate-900" style={{ minHeight: "72vh" }}>
      <iframe
        ref={iframeRef}
        key={frameKey}
        title={t("frame.title")}
        src={src}
        onLoad={handleLoad}
        className="w-full border-none bg-white"
        style={{ minHeight: "72vh" }}
      />

      {phase !== "loaded" ? (
        <div
          className={`absolute inset-0 grid place-items-center p-6 ${
            phase === "loading" ? "bg-slate-50/[0.92]" : "bg-white/[0.96]"
          }`}
        >
          <section className="grid w-full max-w-2xl gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
            <h3 className="m-0 text-base font-semibold">{presentation.title}</h3>
            <p className="m-0 text-sm text-muted-foreground">{presentation.detail}</p>
            <p className="m-0 text-xs text-slate-500">{presentation.suggestion}</p>
            {phase === "loading" ? (
              <div
                aria-label={t("frame.loadingAria")}
                className="h-2.5 overflow-hidden rounded-full bg-border"
              >
                <div className="h-full w-[42%] rounded-full bg-blue-600" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <ActionButton label={t("frame.actions.reloadFrame")} onClick={onReloadFrame} variant="primary" />
                <ActionButton label={t("frame.actions.openExternal")} onClick={onOpenExternal} />
                {phase === "blocked" ? (
                  <ActionButton label={t("frame.actions.restartGateway")} onClick={onRestartGateway} />
                ) : null}
                <ActionButton label={t("frame.actions.openSetupAssistant")} onClick={onOpenSetupAssistant} />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
