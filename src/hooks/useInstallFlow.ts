import { useCallback, useEffect, useMemo, useState } from "react";
import { buildInstallPhasesPreview, installService } from "../services/installService";
import type { InstallActionResult, InstallEnvironment, InstallPhase } from "../types/install";
import type { BackendError } from "../types/api";

export interface UseInstallFlowResult {
  environment: InstallEnvironment | null;
  envError: BackendError | null;
  installResult: InstallActionResult | null;
  phases: InstallPhase[];
  isLoading: boolean;
  isInstalling: boolean;
  refreshEnvironment: () => Promise<void>;
  installOpenClaw: () => Promise<void>;
}

export function useInstallFlow(): UseInstallFlowResult {
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(null);
  const [envError, setEnvError] = useState<BackendError | null>(null);
  const [installResult, setInstallResult] = useState<InstallActionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  const refreshEnvironment = useCallback(async () => {
    setIsLoading(true);
    const result = await installService.detectEnv();
    if (result.ok && result.data) {
      setEnvironment(result.data);
      setEnvError(null);
    } else {
      setEnvironment(null);
      setEnvError(result.error ?? null);
    }
    setIsLoading(false);
  }, []);

  const installOpenClaw = useCallback(async () => {
    setInstallResult(null);
    setIsInstalling(true);
    const result = await installService.installOpenClaw();
    setInstallResult(result);
    setIsInstalling(false);
    await refreshEnvironment();
  }, [refreshEnvironment]);

  useEffect(() => {
    void refreshEnvironment();
  }, [refreshEnvironment]);

  return useMemo(
    () => ({
      environment,
      envError,
      installResult,
      phases: installResult?.phases ?? buildInstallPhasesPreview(environment, envError),
      isLoading,
      isInstalling,
      refreshEnvironment,
      installOpenClaw,
    }),
    [environment, envError, installResult, isLoading, isInstalling, refreshEnvironment, installOpenClaw],
  );
}
