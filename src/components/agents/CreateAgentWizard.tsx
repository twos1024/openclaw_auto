import { useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toLegacyChannelType } from "@/lib/channelCompatibility";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface WizardForm {
  displayName: string;
  systemPrompt: string;
  modelId: string;
  modelName: string;
  customModelId: string;
  customModelName: string;
  channelType: string;
  apiKeyRef: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "claude-sonnet-4-5",
  "claude-opus-4-1",
  "deepseek-chat",
  "qwen-max-latest",
  "custom",
] as const;

const CHANNEL_OPTIONS = ["openclaw", "openai-compatible", "custom"] as const;
const PROMPT_TEMPLATE_KEYS = ["general", "code", "translation", "support"] as const;
const STEP_KEYS = ["name", "identity", "model", "channel"] as const;

const buildDefaultForm = (defaultModelName: string): WizardForm => ({
  displayName: "",
  systemPrompt: "",
  modelId: "gpt-4o",
  modelName: defaultModelName,
  customModelId: "",
  customModelName: "",
  channelType: "openclaw",
  apiKeyRef: "",
  baseUrl: "",
  temperature: 0.7,
  maxTokens: 4096,
});

function StepBar({ current }: { current: number }) {
  const { t } = useTranslation("agents");
  return (
    <div className="mb-6 flex items-center gap-0">
      {STEP_KEYS.map((key, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={key} className={cn("flex items-center", index < STEP_KEYS.length - 1 ? "flex-1" : "")}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done ? "bg-primary text-primary-foreground" : active ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span className={cn("whitespace-nowrap text-[11px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {t(`wizard.steps.${key}`)}
              </span>
            </div>
            {index < STEP_KEYS.length - 1 ? <div className={cn("mx-1 mb-4 h-0.5 flex-1", done ? "bg-primary" : "bg-border")} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function StepName({
  form,
  onChange,
}: {
  form: WizardForm;
  onChange: (patch: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation("agents");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("wizard.stepName.description")}</p>
      <Input
        autoFocus
        placeholder={t("wizard.stepName.placeholder")}
        value={form.displayName}
        onChange={(event) => onChange({ displayName: event.target.value })}
      />
    </div>
  );
}

function StepPrompt({
  form,
  onChange,
}: {
  form: WizardForm;
  onChange: (patch: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation("agents");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("wizard.stepPrompt.description")}</p>
      <div className="flex flex-wrap gap-2">
        {PROMPT_TEMPLATE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ systemPrompt: t(`wizard.stepPrompt.templates.${key}`) })}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
          >
            {t(`wizard.stepPrompt.templates.${key}`)}
          </button>
        ))}
      </div>
      <Textarea
        rows={7}
        className="text-sm leading-relaxed"
        placeholder={t("wizard.stepPrompt.placeholder")}
        value={form.systemPrompt}
        onChange={(event) => onChange({ systemPrompt: event.target.value })}
      />
    </div>
  );
}

function StepModel({
  form,
  onChange,
}: {
  form: WizardForm;
  onChange: (patch: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation("agents");
  const builtinIds = MODEL_OPTIONS.slice(0, -1);
  const isCustom = !builtinIds.includes(form.modelId as (typeof builtinIds)[number]) || form.modelId === "custom";
  const customModelId = form.customModelId.trim();
  const customModelName = form.customModelName.trim();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("wizard.stepModel.description")}</p>
      {MODEL_OPTIONS.map((modelId) => {
        const selected = modelId === "custom" ? isCustom : form.modelId === modelId;
        const labelKey =
          modelId === "custom"
            ? "wizard.stepModel.customLabel"
            : `wizard.stepModel.models.${modelId.replace(/[.-]/g, "_")}`;
        const label = t(labelKey, { defaultValue: modelId });
        return (
          <button
            key={modelId}
          type="button"
          onClick={() => {
            if (modelId === "custom") {
              onChange({
                modelId: customModelId || "custom",
                modelName: customModelName || customModelId || t("wizard.stepModel.customModelNameDefault"),
              });
              return;
            }

            onChange({ modelId, modelName: label });
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
            selected ? "border-primary bg-primary/5 text-foreground" : "border-border bg-background text-foreground/80 hover:bg-muted/40",
          )}
          >
            <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", selected ? "scale-110 border-primary bg-primary" : "border-muted-foreground/30")} />
            <span className={cn("font-medium", selected && "text-foreground")}>{label}</span>
          </button>
        );
      })}
      {isCustom ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder={t("wizard.stepModel.customModelIdPlaceholder")}
            value={form.customModelId}
            onChange={(event) => {
              const value = event.target.value;
              const normalizedValue = value.trim();
              onChange({
                customModelId: value,
                modelId: normalizedValue || "custom",
                modelName: customModelName || normalizedValue || t("wizard.stepModel.customModelNameDefault"),
              });
            }}
          />
          <Input
            placeholder={t("wizard.stepModel.customModelNamePlaceholder")}
            value={form.customModelName}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                customModelName: value,
                modelName: value.trim() || customModelId || t("wizard.stepModel.customModelNameDefault"),
              });
            }}
          />
        </div>
      ) : null}
      <div className="grid gap-4 pt-2 md:grid-cols-2">
        <div>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("wizard.stepModel.temperatureLabel", { value: form.temperature.toFixed(1) })}</span>
            <span className="text-xs text-muted-foreground">{t("wizard.stepModel.temperatureHint")}</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={form.temperature}
            onChange={(event) => onChange({ temperature: Number(event.target.value) })}
            className="mt-2 w-full"
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("wizard.stepModel.maxTokensLabel")}</span>
          <Input
            type="number"
            min={1}
            max={200000}
            step={1}
            inputMode="numeric"
            value={form.maxTokens}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              const normalizedValue = Number.isFinite(nextValue) ? Math.min(200000, Math.max(1, Math.trunc(nextValue))) : 4096;
              onChange({ maxTokens: normalizedValue });
            }}
          />
          <span className="text-xs text-muted-foreground">{t("wizard.stepModel.maxTokensHint")}</span>
        </label>
      </div>
    </div>
  );
}

function StepChannel({
  form,
  onChange,
}: {
  form: WizardForm;
  onChange: (patch: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation("agents");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("wizard.stepChannel.description")}</p>
      {CHANNEL_OPTIONS.map((channelId) => {
        const selected = form.channelType === channelId;
        return (
          <button
            key={channelId}
            type="button"
            onClick={() => onChange({ channelType: channelId, baseUrl: channelId === "openclaw" ? "" : form.baseUrl })}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40",
            )}
          >
            <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full border-2", selected ? "border-primary bg-primary" : "border-muted-foreground/30")} />
            <div>
              <p className={cn("text-sm font-medium", selected ? "text-foreground" : "text-foreground/80")}>
                {t(`wizard.stepChannel.channels.${channelId}.label`)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`wizard.stepChannel.channels.${channelId}.description`)}
              </p>
            </div>
          </button>
        );
      })}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("wizard.stepChannel.apiKeyLabel")}</span>
        <Input
          type="password"
          placeholder={t("wizard.stepChannel.apiKeyPlaceholder")}
          value={form.apiKeyRef}
          onChange={(event) => onChange({ apiKeyRef: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("wizard.stepChannel.endpointLabel")}</span>
        <Input
          placeholder={
            form.channelType === "openclaw"
              ? t("wizard.stepChannel.endpointPlaceholderOpenclaw")
              : t("wizard.stepChannel.endpointPlaceholderOther")
          }
          value={form.baseUrl}
          onChange={(event) => onChange({ baseUrl: event.target.value })}
        />
      </label>
    </div>
  );
}

export function CreateAgentWizard({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useTranslation("agents");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(() => buildDefaultForm(t("wizard.stepModel.models.gpt_4o")));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createAgent = useAgentStore((state) => state.createAgent);

  const onChange = (patch: Partial<WizardForm>) => setForm((current) => ({ ...current, ...patch }));
  const isLastStep = step === STEP_KEYS.length - 1;
  const requiresEndpoint = form.channelType !== "openclaw";
  const canFinish = !requiresEndpoint || (form.apiKeyRef.trim().length > 0 && form.baseUrl.trim().length > 0);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);

    try {
      const created = await createAgent({
        displayName: form.displayName || `agent-${Date.now()}`,
        systemPrompt: form.systemPrompt,
        modelId: form.modelId,
        modelName: form.modelName,
        channelType: toLegacyChannelType(form.channelType),
        apiKeyRef: form.apiKeyRef,
        baseUrl: form.baseUrl,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
      });

      if (created) {
        onClose();
      } else {
        const latestError = useAgentStore.getState().error;
        setError(latestError?.message ?? t("wizard.errors.createFailed"));
      }
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(560px,95vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-card shadow-2xl">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("wizard.title")}</h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <StepBar current={step} />

          <div className="min-h-[260px]">
            {step === 0 ? <StepName form={form} onChange={onChange} /> : null}
            {step === 1 ? <StepPrompt form={form} onChange={onChange} /> : null}
            {step === 2 ? <StepModel form={form} onChange={onChange} /> : null}
            {step === 3 ? <StepChannel form={form} onChange={onChange} /> : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <Button variant="outline" onClick={step === 0 ? onClose : () => setStep((current) => current - 1)}>
              {step === 0 ? t("wizard.footer.cancel") : t("wizard.footer.previous")}
            </Button>
            <Button onClick={isLastStep ? () => void handleCreate() : () => setStep((current) => current + 1)} disabled={(isLastStep && !canFinish) || saving}>
              {saving ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : null}
              {saving ? t("wizard.footer.creating") : isLastStep ? t("wizard.footer.create") : t("wizard.footer.next")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
