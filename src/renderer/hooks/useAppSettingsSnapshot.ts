import { useEffect, useState } from "react";
import { settingsService } from "../services/settingsService";
import { defaultAppSettings, type AppSettings } from "../types/settings";

export interface AppSettingsSnapshot {
  settings: AppSettings;
  isLoading: boolean;
}

export function useAppSettingsSnapshot(): AppSettingsSnapshot {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      try {
        const result = await settingsService.readSettings();
        if (!mounted) return;
        setSettings(result.values);
      } catch {
        if (!mounted) return;
        setSettings(defaultAppSettings);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    settings,
    isLoading,
  };
}
