import { useEffect, useState } from "react";
import { installService } from "../services/installService";
import type { InstallEnvironment } from "../types/install";

export interface EnvironmentSnapshotResult {
  environment: InstallEnvironment | null;
  isLoading: boolean;
}

export function useEnvironmentSnapshot(): EnvironmentSnapshotResult {
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      const result = await installService.detectEnv();
      if (!mounted) return;
      setEnvironment(result.ok ? result.data ?? null : null);
      setIsLoading(false);
    };
    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    environment,
    isLoading,
  };
}
