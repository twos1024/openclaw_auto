import { useCallback, useEffect, useState } from "react";
import { buildRunbookModel } from "../services/runbookService";
import { statusService } from "../services/statusService";
import type { OverviewStatus } from "../types/status";
import type { RunbookModel } from "../types/workspace";

export interface UseRunbookResult {
  model: RunbookModel | null;
  status: OverviewStatus | null;
  isLoading: boolean;
  errorText: string | null;
  refresh: () => Promise<void>;
}

export function useRunbook(enabled: boolean, autoRefreshMs?: number): UseRunbookResult {
  const [model, setModel] = useState<RunbookModel | null>(null);
  const [status, setStatus] = useState<OverviewStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);
    const result = await statusService.getOverviewStatus();
    if (!result.ok || !result.data) {
      setStatus(null);
      setModel(null);
      setErrorText(result.error?.message ?? "Failed to load workspace data.");
      setIsLoading(false);
      return;
    }

    setStatus(result.data);
    setModel(buildRunbookModel(result.data));
    setIsLoading(false);
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
    status,
    isLoading,
    errorText,
    refresh,
  };
}
