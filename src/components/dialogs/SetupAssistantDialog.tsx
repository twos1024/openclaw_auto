import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSetupAssistant } from "../../hooks/useSetupAssistant";
import { ModalDialog } from "../common/ModalDialog";
import { RunbookLaunchChecks } from "../runbook/RunbookLaunchChecks";

export interface SetupAssistantDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SetupAssistantDialog({ open, onClose }: SetupAssistantDialogProps): JSX.Element | null {
  const { t } = useTranslation("runbook");
  const { model, isLoading, errorText, refresh } = useSetupAssistant(open);
  const footerAction = model?.currentBlocker
    ? { route: model.currentBlocker.route, label: model.currentBlocker.actionLabel }
    : model
      ? { route: model.primaryRoute, label: model.primaryLabel }
      : null;

  return (
    <ModalDialog
      title={t("assistant.title")}
      open={open}
      onClose={onClose}
      width={920}
      footer={
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-2.5 font-semibold text-foreground hover:bg-muted"
          >
            {t("assistant.refresh")}
          </button>
          {footerAction ? (
            <Link
              to={footerAction.route}
              onClick={onClose}
              className="inline-block rounded-lg bg-foreground px-3.5 py-2.5 font-bold text-background no-underline hover:opacity-90"
            >
              {footerAction.label}
            </Link>
          ) : null}
        </>
      }
    >
      {isLoading ? <p className="m-0 text-muted-foreground">{t("assistant.loading")}</p> : null}
      {errorText ? (
        <section className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorText}
        </section>
      ) : null}
      {model ? (
        <>
          <section className="grid gap-2 rounded-xl border border-border bg-muted/50 p-4">
            <strong className="text-foreground">{model.headline}</strong>
            <p className="m-0 text-muted-foreground">{model.summary}</p>
            {model.currentBlocker ? (
              <p className="m-0 text-xs text-muted-foreground/80">
                {t("assistant.currentBlocker")}
                {model.currentBlocker.title}
              </p>
            ) : null}
            <p className="m-0 text-xs text-muted-foreground/80">
              {t("assistant.checkedAt")}{new Date(model.lastCheckedAt).toLocaleString()}
            </p>
          </section>

          <RunbookLaunchChecks model={model} />

          <div className="grid gap-3">
            {model.steps.map((step, index) => {
              const active = step.status === "current" || step.status === "ready";
              return (
                <article
                  key={step.id}
                  className={`grid gap-2.5 rounded-xl border p-4 ${
                    active
                      ? "border-blue-700 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-foreground">
                      {index + 1}. {step.title}
                    </strong>
                  </div>
                  <p className="m-0 text-muted-foreground">{step.description}</p>
                  {step.status === "current" || step.status === "ready" ? (
                    <div>
                      <Link
                        to={step.route}
                        onClick={onClose}
                        className="inline-block rounded-lg bg-foreground px-3 py-2 font-bold text-background no-underline hover:opacity-90"
                      >
                        {step.actionLabel}
                      </Link>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </ModalDialog>
  );
}
