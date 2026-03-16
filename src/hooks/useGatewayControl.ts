import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  serviceService,
  type GatewayStatus,
  type ServiceActionResult,
} from "../services/serviceService";

export interface UseGatewayControlResult {
  status: GatewayStatus | null;
  lastActionResult: ServiceActionResult | null;
  isInitializing: boolean;
  isRefreshing: boolean;
  isPolling: boolean;
  loadingByAction: Record<"start" | "stop" | "restart" | "openDashboard", boolean>;
  refreshStatus: () => Promise<void>;
  startGateway: () => Promise<void>;
  stopGateway: () => Promise<void>;
  restartGateway: () => Promise<void>;
  openDashboard: () => Promise<void>;
}

async function safeRun<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export function useGatewayControl(pollMs = 5000): UseGatewayControlResult {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [lastActionResult, setLastActionResult] = useState<ServiceActionResult | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [loadingByAction, setLoadingByAction] = useState<
    Record<"start" | "stop" | "restart" | "openDashboard", boolean>
  >({
    start: false,
    stop: false,
    restart: false,
    openDashboard: false,
  });

  const unmountedRef = useRef<boolean>(false);
  const actionLockRef = useRef<Record<"start" | "stop" | "restart" | "openDashboard", boolean>>({
    start: false,
    stop: false,
    restart: false,
    openDashboard: false,
  });

  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    const next = await safeRun(() => serviceService.getGatewayStatus());
    if (!unmountedRef.current && next) {
      setStatus(next);
    }
    if (!unmountedRef.current) {
      setIsRefreshing(false);
    }
  }, []);

  const runAction = useCallback(
    async (key: "start" | "stop" | "restart" | "openDashboard", fn: () => Promise<ServiceActionResult>) => {
      if (actionLockRef.current[key]) return;

      actionLockRef.current[key] = true;
      setLoadingByAction((prev) => ({ ...prev, [key]: true }));
      try {
        const result = await fn();
        if (!unmountedRef.current) {
          setLastActionResult(result);
        }
        await refreshStatus();
      } finally {
        actionLockRef.current[key] = false;
        if (!unmountedRef.current) {
          setLoadingByAction((prev) => ({ ...prev, [key]: false }));
        }
      }
    },
    [refreshStatus],
  );

  const startGateway = useCallback(async () => {
    await runAction("start", () => serviceService.startGateway());
  }, [runAction]);

  const stopGateway = useCallback(async () => {
    await runAction("stop", () => serviceService.stopGateway());
  }, [runAction]);

  const restartGateway = useCallback(async () => {
    await runAction("restart", () => serviceService.restartGateway());
  }, [runAction]);

  const openDashboard = useCallback(async () => {
    await runAction("openDashboard", () => serviceService.openDashboard());
  }, [runAction]);

  useEffect(() => {
    let pollTimer: number | null = null;
    unmountedRef.current = false;

    const initialize = async (): Promise<void> => {
      const next = await safeRun(() => serviceService.getGatewayStatus());
      if (!unmountedRef.current && next) {
        setStatus(next);
      }
      if (!unmountedRef.current) {
        setIsInitializing(false);
      }

      setIsPolling(true);
      pollTimer = window.setInterval(() => {
        void refreshStatus();
      }, pollMs);
    };

    void initialize();

    return () => {
      unmountedRef.current = true;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      setIsPolling(false);
    };
  }, [pollMs, refreshStatus]);

  return useMemo(
    () => ({
      status,
      lastActionResult,
      isInitializing,
      isRefreshing,
      isPolling,
      loadingByAction,
      refreshStatus,
      startGateway,
      stopGateway,
      restartGateway,
      openDashboard,
    }),
    [
      status,
      lastActionResult,
      isInitializing,
      isRefreshing,
      isPolling,
      loadingByAction,
      refreshStatus,
      startGateway,
      stopGateway,
      restartGateway,
      openDashboard,
    ],
  );
}
