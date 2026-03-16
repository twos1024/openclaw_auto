import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildInstallPhasesPreview, installService } from "../services/installService";
import { buildInstallingPhases, buildInstallProgressModel } from "../services/installProgress";
import { parseInstallTelemetry } from "../services/installTelemetry";
import type {
  InstallActionResult,
  InstallEnvironment,
  InstallPhase,
  InstallProgressModel,
  InstallTelemetry,
} from "../types/install";
import type { BackendError } from "../types/api";

export interface UseInstallFlowResult {
  environment: InstallEnvironment | null;
  envError: BackendError | null;
  installResult: InstallActionResult | null;
  phases: InstallPhase[];
  installProgress: InstallProgressModel;
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
  const [installStartedAt, setInstallStartedAt] = useState<number | null>(null);
  const [installElapsedMs, setInstallElapsedMs] = useState<number>(0);
  const [installTelemetry, setInstallTelemetry] = useState<InstallTelemetry | null>(null);
  const [installTelemetryStageStartElapsedMs, setInstallTelemetryStageStartElapsedMs] = useState<number>(0);
  const installElapsedRef = useRef<number>(0);
  const installTelemetryRef = useRef<InstallTelemetry | null>(null);

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
    if (isInstalling) return;

    setInstallResult(null);
    setInstallStartedAt(Date.now());
    setInstallElapsedMs(0);
    setInstallTelemetry(null);
    setInstallTelemetryStageStartElapsedMs(0);
    setIsInstalling(true);
    try {
      const result = await installService.installOpenClaw();
      setInstallResult(result);
    } finally {
      setIsInstalling(false);
      setInstallStartedAt(null);
      setInstallElapsedMs(0);
      setInstallTelemetry(null);
      setInstallTelemetryStageStartElapsedMs(0);
    }
    await refreshEnvironment();
  }, [isInstalling, refreshEnvironment]);

  useEffect(() => {
    void refreshEnvironment();
  }, [refreshEnvironment]);

  useEffect(() => {
    installElapsedRef.current = installElapsedMs;
  }, [installElapsedMs]);

  useEffect(() => {
    installTelemetryRef.current = installTelemetry;
  }, [installTelemetry]);

  useEffect(() => {
    if (!isInstalling || installStartedAt === null) {
      return;
    }

    setInstallElapsedMs(Math.max(Date.now() - installStartedAt, 0));
    const timer = window.setInterval(() => {
      setInstallElapsedMs(Math.max(Date.now() - installStartedAt, 0));
    }, 240);

    return () => {
      window.clearInterval(timer);
    };
  }, [installStartedAt, isInstalling]);

  useEffect(() => {
    if (!isInstalling) {
      return;
    }

    let cancelled = false;

    const refreshInstallTelemetry = async (): Promise<void> => {
      const lines = await installService.readInstallLogLines();
      if (cancelled) return;
      const nextTelemetry = parseInstallTelemetry(lines);
      const current = installTelemetryRef.current;
      const changed =
        current?.activePhaseId !== nextTelemetry?.activePhaseId || current?.phaseState !== nextTelemetry?.phaseState;
      if (changed) {
        setInstallTelemetryStageStartElapsedMs(installElapsedRef.current);
      }
      setInstallTelemetry(nextTelemetry);
    };

    void refreshInstallTelemetry();
    const timer = window.setInterval(() => {
      void refreshInstallTelemetry();
    }, 700);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isInstalling]);

  return useMemo(
    () => ({
      environment,
      envError,
      installResult,
      phases:
        installResult?.phases ??
        (isInstalling
          ? buildInstallingPhases({ environment, elapsedMs: installElapsedMs, telemetry: installTelemetry })
          : buildInstallPhasesPreview(environment, envError)),
      installProgress: buildInstallProgressModel({
        environment,
        installResult,
        isInstalling,
        elapsedMs: installElapsedMs,
        telemetry: installTelemetry,
        telemetryStageElapsedMs: Math.max(installElapsedMs - installTelemetryStageStartElapsedMs, 0),
      }),
      isLoading,
      isInstalling,
      refreshEnvironment,
      installOpenClaw,
    }),
    [
      environment,
      envError,
      installResult,
      installElapsedMs,
      installTelemetry,
      installTelemetryStageStartElapsedMs,
      isLoading,
      isInstalling,
      refreshEnvironment,
      installOpenClaw,
    ],
  );
}
