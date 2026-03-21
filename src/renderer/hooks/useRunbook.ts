import { useCallback, useEffect, useState } from "react";
import { runbookService } from "../services/runbookService";
import type { RunbookModel } from "../types/workspace";

export interface UseRunbookResult {
  model: RunbookModel | null;
  isLoading: boolean;
  errorText: string | null;
  refresh: () => Promise<void>;
}

export function useRunbook(enabled: boolean, autoRefreshMs?: number): UseRunbookResult {
  const [model, setModel] = useState<RunbookModel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);
    try {
      const result = await runbookService.getRunbookModel();
      if (!result.ok || !result.data) {
        setModel(null);
        setErrorText(result.error?.message ?? "Failed to load workspace data.");
        return;
      }

      setModel(result.data);
    } catch (error: unknown) {
      setModel(null);
      setErrorText(error instanceof Error ? error.message : "Failed to load workspace data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !autoRefreshMs || autoRefreshMs <= 0) return undefined;
    const timer = window.setInterval(() => {
      void refresh();
    }, autoRefreshMs);
    return () => window.clearInterval(timer);
  }, [autoRefreshMs, enabled, refresh]);

  return {
    model,
    isLoading,
    errorText,
    refresh,
  };
}
