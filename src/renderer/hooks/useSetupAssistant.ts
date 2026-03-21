import { useRunbook } from "./useRunbook";
import type { RunbookModel } from "../types/workspace";

export interface UseSetupAssistantResult {
  model: RunbookModel | null;
  isLoading: boolean;
  errorText: string | null;
  refresh: () => Promise<void>;
}

export function useSetupAssistant(isOpen: boolean): UseSetupAssistantResult {
  const { model, isLoading, errorText, refresh } = useRunbook(isOpen);
  return { model, isLoading, errorText, refresh };
}
