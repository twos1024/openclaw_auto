import { useCallback, useEffect, useMemo, useState } from "react";
import { settingsService } from "../services/settingsService";
import {
  defaultAppSettings,
  type AppSettings,
  type SaveSettingsResult,
  type SettingsFormErrors,
} from "../types/settings";
import type { BackendError } from "../types/api";
import { hasSettingsValidationError, validateSettingsForm } from "../utils/settingsValidators";

export interface UseSettingsFormResult {
  form: AppSettings;
  errors: SettingsFormErrors;
  loadIssue: BackendError | null;
  loadedPath: string | null;
  exists: boolean;
  modifiedAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  saveResult: SaveSettingsResult | null;
  setField: (field: keyof AppSettings, value: string | number) => void;
  saveSettings: () => Promise<void>;
  resetToDefault: () => void;
  reload: () => Promise<void>;
}

export function useSettingsForm(): UseSettingsFormResult {
  const [form, setForm] = useState<AppSettings>(defaultAppSettings);
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  const [loadIssue, setLoadIssue] = useState<BackendError | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean>(false);
  const [modifiedAt, setModifiedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<SaveSettingsResult | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const loaded = await settingsService.readSettings();
    setForm(loaded.values);
    setLoadIssue(loaded.issue ?? null);
    setLoadedPath(loaded.path ?? null);
    setExists(loaded.exists);
    setModifiedAt(loaded.modifiedAt ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setField = useCallback((field: keyof AppSettings, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const validate = useCallback((values: AppSettings): boolean => {
    const nextErrors = validateSettingsForm(values);
    setErrors(nextErrors);
    return !hasSettingsValidationError(nextErrors);
  }, []);

  const saveSettings = useCallback(async () => {
    setSaveResult(null);
    if (!validate(form)) {
      return;
    }

    setIsSaving(true);
    const result = await settingsService.saveSettings(form);
    setSaveResult(result);
    setIsSaving(false);
    await reload();
  }, [form, reload, validate]);

  const resetToDefault = useCallback(() => {
    setForm(defaultAppSettings);
    setErrors({});
    setSaveResult(null);
  }, []);

  return useMemo(
    () => ({
      form,
      errors,
      loadIssue,
      loadedPath,
      exists,
      modifiedAt,
      isLoading,
      isSaving,
      saveResult,
      setField,
      saveSettings,
      resetToDefault,
      reload,
    }),
    [
      form,
      errors,
      loadIssue,
      loadedPath,
      exists,
      modifiedAt,
      isLoading,
      isSaving,
      saveResult,
      setField,
      saveSettings,
      resetToDefault,
      reload,
    ],
  );
}
