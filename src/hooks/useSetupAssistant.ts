import { useCallback, useEffect, useState } from "react";
import { statusService } from "../services/statusService";
import { buildSetupAssistantModel } from "../services/setupAssistantService";
import type { GuidedSetupModel } from "../types/guidedSetup";

export interface UseSetupAssistantResult {
  model: GuidedSetupModel | null;
  isLoading: boolean;
  errorText: string | null;
  refresh: () => Promise<void>;
}

export function useSetupAssistant(isOpen: boolean): UseSetupAssistantResult {
  const [model, setModel] = useState<GuidedSetupModel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);
    const result = await statusService.getOverviewStatus();
    if (!result.ok || !result.data) {
      setModel(null);
      setErrorText(result.error?.message ?? "Failed to load setup assistant data.");
      setIsLoading(false);
      return;
    }

    setModel(buildSetupAssistantModel(result.data));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
  }, [isOpen, refresh]);

  return {
    model,
    isLoading,
    errorText,
    refresh,
  };
}
