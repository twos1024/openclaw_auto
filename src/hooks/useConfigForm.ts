import { useCallback, useEffect, useMemo, useState } from "react";
import { configService } from "../services/configService";
import { applyOpenAiCompatiblePreset } from "../services/configPresets";
import {
  defaultConfigValues,
  type BackendError,
  type ConfigFormErrors,
  type ConfigFormValues,
  type ConnectionTestResult,
  type OpenAiCompatiblePresetId,
  type SaveConfigResult,
} from "../types/config";
import { hasValidationError, validateConfigForm } from "../utils/validators";

export interface UseConfigFormResult {
  form: ConfigFormValues;
  errors: ConfigFormErrors;
  isLoading: boolean;
  isTesting: boolean;
  isSaving: boolean;
  loadIssue: BackendError | null;
  loadedPath: string | null;
  usedDefaultValues: boolean;
  testResult: ConnectionTestResult | null;
  saveResult: SaveConfigResult | null;
  setField: (field: keyof ConfigFormValues, value: string | number) => void;
  setProviderType: (providerType: ConfigFormValues["providerType"]) => void;
  applyCompatiblePreset: (presetId: OpenAiCompatiblePresetId) => void;
  testConnection: () => Promise<void>;
  saveConfig: () => Promise<void>;
  resetToDefault: () => void;
  reload: () => Promise<void>;
}

function buildUnexpectedLoadIssue(error: unknown): BackendError {
  return {
    code: "E_UNKNOWN",
    message: error instanceof Error ? error.message : "Failed to load OpenClaw config.",
    suggestion: "Retry the action or restart ClawDesk.",
  };
}

function buildUnexpectedActionResult(
  error: unknown,
  fallbackSuggestion: string,
): ConnectionTestResult | SaveConfigResult {
  return {
    status: "error",
    detail: error instanceof Error ? error.message : "Unknown error",
    suggestion: fallbackSuggestion,
    code: "E_UNKNOWN",
  };
}

export function useConfigForm(): UseConfigFormResult {
  const [form, setForm] = useState<ConfigFormValues>(defaultConfigValues);
  const [errors, setErrors] = useState<ConfigFormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadIssue, setLoadIssue] = useState<BackendError | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [usedDefaultValues, setUsedDefaultValues] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saveResult, setSaveResult] = useState<SaveConfigResult | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await configService.readConfig();
      setForm(loaded.values);
      setErrors({});
      setLoadIssue(loaded.issue ?? null);
      setLoadedPath(loaded.path ?? null);
      setUsedDefaultValues(loaded.usedDefaultValues);
    } catch (error: unknown) {
      setForm(defaultConfigValues);
      setLoadIssue(buildUnexpectedLoadIssue(error));
      setLoadedPath(null);
      setUsedDefaultValues(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setField = useCallback((field: keyof ConfigFormValues, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const setProviderType = useCallback((providerType: ConfigFormValues["providerType"]) => {
    setForm((prev) => ({
      ...prev,
      providerType,
    }));
    setErrors((prev) => ({
      ...prev,
      providerType: undefined,
      baseUrl: undefined,
      apiKey: undefined,
      ollamaHost: undefined,
    }));
  }, []);

  const applyCompatiblePreset = useCallback(
    (presetId: OpenAiCompatiblePresetId) => {
      setForm((prev) => applyOpenAiCompatiblePreset(prev, presetId));
      setErrors((prev) => ({
        ...prev,
        providerType: undefined,
        baseUrl: undefined,
      }));
    },
    [],
  );

  const validate = useCallback((values: ConfigFormValues): boolean => {
    const nextErrors = validateConfigForm(values);
    setErrors(nextErrors);
    return !hasValidationError(nextErrors);
  }, []);

  const testConnection = useCallback(async () => {
    setTestResult(null);
    setSaveResult(null);
    if (!validate(form)) return;

    setIsTesting(true);
    try {
      const result = await configService.testConnection(form);
      setTestResult(result);
    } catch (error: unknown) {
      setTestResult(
        buildUnexpectedActionResult(
          error,
          "Check backend network access, provider URL, and local certificates, then retry.",
        ) as ConnectionTestResult,
      );
    } finally {
      setIsTesting(false);
    }
  }, [form, validate]);

  const saveConfig = useCallback(async () => {
    setSaveResult(null);
    if (!validate(form)) return;

    setIsSaving(true);
    let shouldReload = false;
    try {
      const result = await configService.saveConfig(form);
      setSaveResult(result);
      shouldReload = result.status === "success";
    } catch (error: unknown) {
      setSaveResult(
        buildUnexpectedActionResult(
          error,
          "Check app logs and filesystem permissions, then retry.",
        ) as SaveConfigResult,
      );
    } finally {
      setIsSaving(false);
    }
    if (shouldReload) {
      await reload();
    }
  }, [form, reload, validate]);

  const resetToDefault = useCallback(() => {
    setForm(defaultConfigValues);
    setErrors({});
    setTestResult(null);
    setSaveResult(null);
  }, []);

  return useMemo(
    () => ({
      form,
      errors,
      isLoading,
      isTesting,
      isSaving,
      loadIssue,
      loadedPath,
      usedDefaultValues,
      testResult,
      saveResult,
      setField,
      setProviderType,
      applyCompatiblePreset,
      testConnection,
      saveConfig,
      resetToDefault,
      reload,
    }),
    [
      form,
      errors,
      isLoading,
      isTesting,
      isSaving,
      loadIssue,
      loadedPath,
      usedDefaultValues,
      testResult,
      saveResult,
      setField,
      setProviderType,
      applyCompatiblePreset,
      testConnection,
      saveConfig,
      resetToDefault,
      reload,
    ],
  );
}
