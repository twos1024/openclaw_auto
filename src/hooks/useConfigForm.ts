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

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      const loaded = await configService.readConfig();
      if (!mounted) return;
      setForm(loaded.values);
      setLoadIssue(loaded.issue ?? null);
      setLoadedPath(loaded.path ?? null);
      setUsedDefaultValues(loaded.usedDefaultValues);
      setIsLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

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
    const result = await configService.testConnection(form);
    setTestResult(result);
    setIsTesting(false);
  }, [form, validate]);

  const saveConfig = useCallback(async () => {
    setSaveResult(null);
    if (!validate(form)) return;

    setIsSaving(true);
    const result = await configService.saveConfig(form);
    setSaveResult(result);
    setIsSaving(false);
  }, [form, validate]);

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
    ],
  );
}
