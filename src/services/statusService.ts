import type { OverviewStatus, ServiceResult } from "../types/status";
import { settingsService } from "./settingsService";
import { invokeCommand, isTauriRuntime } from "./tauriClient";
import {
  buildConfigSection,
  buildInstallSection,
  buildNextActions,
  buildOverall,
  buildPreviewOverview,
  buildRuntimeSection,
  buildServiceSection,
  buildSettingsSection,
} from "./overview/builders";
import { APP_VERSION, type ConfigReadData, type DetectEnvData, type GatewayStatusData } from "./overview/contracts";

function nowIso(): string {
  return new Date().toISOString();
}

export const statusService = {
  async getOverviewStatus(): Promise<ServiceResult<OverviewStatus>> {
    const updatedAt = nowIso();
    if (!isTauriRuntime()) {
      return {
        ok: true,
        data: buildPreviewOverview(updatedAt),
      };
    }

    const [envResult, gatewayResult, configResult, settingsResult] = await Promise.all([
      invokeCommand<DetectEnvData>("detect_env"),
      invokeCommand<GatewayStatusData>("get_gateway_status"),
      invokeCommand<ConfigReadData>("read_openclaw_config", { path: null }),
      settingsService.readSettings(),
    ]);

    const runtime = buildRuntimeSection(envResult, updatedAt);
    const install = buildInstallSection(envResult, updatedAt);
    const config = buildConfigSection(configResult, updatedAt);
    const service = buildServiceSection(gatewayResult, updatedAt);
    const settings = buildSettingsSection(settingsResult, updatedAt);
    const overall = buildOverall({ runtime, install, config, service, settings }, updatedAt);
    const nextActions = buildNextActions({ install, config, service, settings });

    return {
      ok: true,
      data: {
        appVersion: APP_VERSION,
        platform: envResult.data?.platform ?? "unknown",
        dashboardUrl: gatewayResult.data?.address ?? "http://127.0.0.1:18789",
        mode: "live",
        overall,
        runtime,
        install,
        config,
        service,
        settings,
        nextActions,
      },
    };
  },
};
