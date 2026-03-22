import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ConfigFormErrors,
  ConfigFormValues,
  OpenAiCompatiblePresetId,
} from "../../types/config";

export interface OpenAIConfigFormProps {
  values: ConfigFormValues;
  errors: ConfigFormErrors;
  disabled?: boolean;
  presetId: OpenAiCompatiblePresetId;
  onFieldChange: (field: keyof ConfigFormValues, value: string | number) => void;
  onPresetChange: (presetId: OpenAiCompatiblePresetId) => void;
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

export function OpenAIConfigForm({
  values,
  errors,
  disabled,
  presetId,
  onFieldChange,
  onPresetChange,
}: OpenAIConfigFormProps): JSX.Element {
  const { t } = useTranslation("config");

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label={t("form.openai.preset.label")} className="col-span-2">
        <Select
          value={presetId}
          disabled={disabled}
          onChange={(event) => onPresetChange(event.target.value as OpenAiCompatiblePresetId)}
        >
          <option value="custom">{t("form.openai.preset.options.custom")}</option>
          <option value="openai">{t("form.openai.preset.options.openai")}</option>
          <option value="deepseek">{t("form.openai.preset.options.deepseek")}</option>
          <option value="openrouter">{t("form.openai.preset.options.openrouter")}</option>
        </Select>
      </Field>

      <Field label={t("form.openai.baseUrl.label")} error={errors.baseUrl} className="col-span-2">
        <Input
          type="text"
          value={values.baseUrl}
          disabled={disabled}
          onChange={(event) => onFieldChange("baseUrl", event.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </Field>

      <Field label={t("form.openai.apiKey.label")} error={errors.apiKey} className="col-span-2">
        <Input
          type="password"
          value={values.apiKey}
          disabled={disabled}
          onChange={(event) => onFieldChange("apiKey", event.target.value)}
          placeholder="sk-..."
        />
      </Field>

      <Field label={t("form.openai.model.label")} error={errors.model} className="col-span-2">
        <Input
          type="text"
          value={values.model}
          disabled={disabled}
          onChange={(event) => onFieldChange("model", event.target.value)}
          placeholder="gpt-4o-mini"
        />
      </Field>

      <Field label={t("form.openai.timeout.label")} error={errors.timeout}>
        <Input
          type="number"
          value={values.timeout}
          disabled={disabled}
          onChange={(event) => onFieldChange("timeout", toNumber(event.target.value, values.timeout))}
        />
      </Field>

      <Field label={t("form.openai.maxTokens.label")} error={errors.maxTokens}>
        <Input
          type="number"
          value={values.maxTokens}
          disabled={disabled}
          onChange={(event) =>
            onFieldChange("maxTokens", toNumber(event.target.value, values.maxTokens))
          }
        />
      </Field>

      <Field label={t("form.openai.temperature.label")} error={errors.temperature} className="col-span-2">
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
