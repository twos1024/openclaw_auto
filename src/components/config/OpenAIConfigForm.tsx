import type { CSSProperties } from "react";
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
  children: JSX.Element;
}): JSX.Element {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: 6, color: "#334155", fontWeight: 600 }}>
        {props.label}
      </span>
      {props.children}
      {props.error ? (
        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "#b91c1c" }}>
          {props.error}
        </span>
      ) : null}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
};

export function OpenAIConfigForm({
  values,
  errors,
  disabled,
  presetId,
  onFieldChange,
  onPresetChange,
}: OpenAIConfigFormProps): JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ gridColumn: "1 / span 2" }}>
        <Field label="API Preset">
          <select
            value={presetId}
            disabled={disabled}
            onChange={(event) => onPresetChange(event.target.value as OpenAiCompatiblePresetId)}
            style={inputStyle}
          >
            <option value="custom">Custom Compatible Endpoint</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </Field>
      </div>

      <div style={{ gridColumn: "1 / span 2" }}>
        <Field label="Base URL" error={errors.baseUrl}>
          <input
            type="text"
            value={values.baseUrl}
            disabled={disabled}
            onChange={(event) => onFieldChange("baseUrl", event.target.value)}
            placeholder="https://api.openai.com/v1"
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ gridColumn: "1 / span 2" }}>
        <Field label="API Key" error={errors.apiKey}>
          <input
            type="password"
            value={values.apiKey}
            disabled={disabled}
            onChange={(event) => onFieldChange("apiKey", event.target.value)}
            placeholder="sk-..."
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ gridColumn: "1 / span 2" }}>
        <Field label="Model" error={errors.model}>
          <input
            type="text"
            value={values.model}
            disabled={disabled}
            onChange={(event) => onFieldChange("model", event.target.value)}
            placeholder="gpt-4o-mini"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Timeout (ms)" error={errors.timeout}>
        <input
          type="number"
          value={values.timeout}
          disabled={disabled}
          onChange={(event) => onFieldChange("timeout", toNumber(event.target.value, values.timeout))}
          style={inputStyle}
        />
      </Field>

      <Field label="Max Tokens" error={errors.maxTokens}>
        <input
          type="number"
          value={values.maxTokens}
          disabled={disabled}
          onChange={(event) =>
            onFieldChange("maxTokens", toNumber(event.target.value, values.maxTokens))
          }
          style={inputStyle}
        />
      </Field>

      <div style={{ gridColumn: "1 / span 2" }}>
        <Field label="Temperature" error={errors.temperature}>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={values.temperature}
            disabled={disabled}
            onChange={(event) =>
              onFieldChange("temperature", toNumber(event.target.value, values.temperature))
            }
            style={inputStyle}
          />
        </Field>
      </div>
    </div>
  );
}
