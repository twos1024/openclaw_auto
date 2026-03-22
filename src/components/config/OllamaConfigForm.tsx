import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ConfigFormErrors, ConfigFormValues } from "../../types/config";

export interface OllamaConfigFormProps {
  values: ConfigFormValues;
  errors: ConfigFormErrors;
  disabled?: boolean;
  onFieldChange: (field: keyof ConfigFormValues, value: string | number) => void;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Field(props: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <label className={cn("block", props.className)}>
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{props.label}</span>
      {props.children}
      {props.error ? (
        <span className="mt-1.5 block text-xs text-destructive">{props.error}</span>
      ) : null}
    </label>
  );
}

export function OllamaConfigForm({
  values,
  errors,
  disabled,
  onFieldChange,
}: OllamaConfigFormProps): JSX.Element {
  const { t } = useTranslation("config");

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label={t("form.ollama.host.label")} error={errors.ollamaHost} className="col-span-2">
        <Input
          type="text"
          value={values.ollamaHost}
          disabled={disabled}
          onChange={(event) => onFieldChange("ollamaHost", event.target.value)}
          placeholder="http://127.0.0.1:11434"
        />
      </Field>

      <Field label={t("form.ollama.model.label")} error={errors.model} className="col-span-2">
        <Input
          type="text"
          value={values.model}
          disabled={disabled}
          onChange={(event) => onFieldChange("model", event.target.value)}
          placeholder="qwen2.5:7b"
        />
      </Field>

      <Field label={t("form.ollama.timeout.label")} error={errors.timeout}>
        <Input
          type="number"
          value={values.timeout}
          disabled={disabled}
          onChange={(event) => onFieldChange("timeout", toNumber(event.target.value, values.timeout))}
        />
      </Field>

      <Field label={t("form.ollama.maxTokens.label")} error={errors.maxTokens}>
        <Input
          type="number"
          value={values.maxTokens}
          disabled={disabled}
          onChange={(event) =>
            onFieldChange("maxTokens", toNumber(event.target.value, values.maxTokens))
          }
        />
      </Field>

      <Field label={t("form.ollama.temperature.label")} error={errors.temperature} className="col-span-2">
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={values.temperature}
          disabled={disabled}
          onChange={(event) =>
            onFieldChange("temperature", toNumber(event.target.value, values.temperature))
          }
        />
      </Field>
    </div>
  );
}
