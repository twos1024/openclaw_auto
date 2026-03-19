import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buildInstallWizardModel, buildPlatformGuidance } from "../../services/installWizardService";
import type { InstallActionResult, InstallEnvironment } from "../../types/install";
import { ModalDialog } from "../common/ModalDialog";

export interface InstallWizardDialogProps {
  open: boolean;
  onClose: () => void;
  environment: InstallEnvironment | null;
  installResult: InstallActionResult | null;
  configReady?: boolean;
  serviceReady?: boolean;
}

function translateStepTitle(t: (key: string) => string, id: string): string {
  const keyMap: Record<string, string> = {
    environment: "install:wizard.steps.environment",
    install: "install:wizard.steps.install",
    config: "install:wizard.steps.config",
    service: "install:wizard.steps.service",
    dashboard: "install:wizard.steps.dashboard",
  };
  return t(keyMap[id] ?? id);
}

function translatePrimaryLabel(t: (key: string) => string, route: string, fallback: string): string {
  const keyMap: Record<string, string> = {
    "/install?wizard=1": "install:wizard.primary.startInstall",
    "/config": "install:wizard.primary.goConfig",
    "/service": "install:wizard.primary.startGateway",
    "/dashboard": "install:wizard.primary.openDashboard",
  };
  return t(keyMap[route] ?? fallback);
}

export function InstallWizardDialog({
  open,
  onClose,
  environment,
  installResult,
  configReady = false,
  serviceReady = false,
}: InstallWizardDialogProps): JSX.Element | null {
  const { t } = useTranslation(["install"]);
  if (!open) return null;

  const model = buildInstallWizardModel({ environment, installResult, configReady, serviceReady });
  const platformCards = buildPlatformGuidance(environment?.platform);
  const currentStep = model.steps.find((step) => step.status === "current") ?? model.steps[0] ?? null;
  const currentIndex = currentStep ? model.steps.findIndex((step) => step.id === currentStep.id) : -1;
  const nextStep = currentIndex >= 0 ? model.steps[currentIndex + 1] ?? null : null;

  return (
    <ModalDialog
      title={t("install:wizard.title")}
      open={open}
      onClose={onClose}
      footer={
        <>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {currentStep ? t("install:wizard.currentStep", { step: translateStepTitle(t, currentStep.id) }) : t("install:wizard.ready")}
          </span>
          <Link
            to={model.primaryRoute}
            onClick={onClose}
            style={{
              borderRadius: 8,
              background: "#0f172a",
              color: "#ffffff",
              padding: "10px 14px",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            {translatePrimaryLabel(t, model.primaryRoute, model.primaryLabel)}
          </Link>
        </>
      }
    >
      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#f8fafc",
          padding: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <strong style={{ color: "#0f172a" }}>{model.headline}</strong>
        <p style={{ margin: 0, color: "#475569" }}>{model.summary}</p>
        {currentStep ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {t("install:wizard.nowOnly", { step: translateStepTitle(t, currentStep.id) })}
          </p>
        ) : null}
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{t("install:wizard.sequence.title")}</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>{t("install:wizard.sequence.description")}</p>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {model.steps.map((step, index) => {
            const active = currentStep?.id === step.id;
            const done = step.status === "complete";
            return (
              <div
                key={step.id}
                style={{
                  border: active ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: active ? "#eff6ff" : "#f8fafc",
                  padding: 12,
                  display: "grid",
                  gap: 4,
                }}
              >
                <strong style={{ color: "#0f172a" }}>
                  {index + 1}. {translateStepTitle(t, step.id)}
                  {done ? ` - ${t("install:wizard.tags.done")}` : active ? ` - ${t("install:wizard.tags.current")}` : ""}
                </strong>
                <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#ffffff",
          padding: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0 }}>{t("install:wizard.after.title")}</h3>
        <p style={{ margin: 0, color: "#475569" }}>{t("install:wizard.after.description")}</p>
        {nextStep ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {t("install:wizard.nextStep", { step: translateStepTitle(t, nextStep.id) })}
          </p>
        ) : null}
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: 4,
            display: "grid",
            gap: 10,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>{t("install:wizard.platform.title")}</h3>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>{t("install:wizard.platform.description")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {platformCards.map((card) => (
              <article
                key={card.platform}
                style={{
                  border: card.isCurrent ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: card.isCurrent ? "#f8fbff" : "#ffffff",
                  padding: 14,
                  display: "grid",
                  gap: 8,
                  boxShadow: card.isCurrent ? "0 0 0 1px rgba(147, 197, 253, 0.2)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong>{card.title}</strong>
                  {card.isCurrent ? (
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        background: "#dbeafe",
                        color: "#1d4ed8",
                      }}
                    >
                      {t("install:wizard.platform.current")}
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: 0, color: "#475569" }}>
                  <strong>{t("install:wizard.platform.installMethod")}：</strong>
                  {card.installSource}
                </p>
                <p style={{ margin: 0, color: "#475569" }}>
                  <strong>{t("install:wizard.platform.pathHint")}：</strong>
                  {card.pathHint}
                </p>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{card.troubleshooting}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </ModalDialog>
  );
}
