import type { OverviewStatus, ServiceResult } from "../types/status";
import { settingsService } from "./settingsService";
import { getRuntimeDiagnostics, invokeCommand } from "./tauriClient";
import {
  buildConfigSection,
  buildInstallSection,
  buildNextActions,
  buildOverall,
  buildPreviewOverview,
  buildRuntimeUnavailableOverview,
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
    const runtime = getRuntimeDiagnostics();
    if (runtime.mode === "browser-preview") {
      return {
        ok: true,
        data: buildPreviewOverview(updatedAt, runtime),
      };
    }

    if (runtime.mode === "tauri-runtime-unavailable") {
      return {
        ok: true,
        data: buildRuntimeUnavailableOverview(updatedAt, runtime),
      };
    }

    const [envResult, gatewayResult, configResult, settingsResult] = await Promise.all([
      invokeCommand<DetectEnvData>("detect_env"),
      invokeCommand<GatewayStatusData>("get_gateway_status"),
      invokeCommand<ConfigReadData>("read_openclaw_config", { path: null }),
      settingsService.readSettings(),
    ]);

    const runtimeSection = buildRuntimeSection(envResult, updatedAt, runtime);
    const install = buildInstallSection(envResult, updatedAt);
    const config = buildConfigSection(configResult, updatedAt);
    const service = buildServiceSection(gatewayResult, updatedAt);
    const settings = buildSettingsSection(settingsResult, updatedAt);
    const overall = buildOverall({ runtime: runtimeSection, install, config, service, settings }, updatedAt);
    const nextActions = buildNextActions({ install, config, service, settings });

    return {
      ok: true,
      data: {
        appVersion: APP_VERSION,
        platform: envResult.data?.platform ?? "unknown",
        dashboardUrl: gatewayResult.data?.address ?? "Unavailable",
        mode: "live",
        overall,
        runtime: runtimeSection,
        install,
        config,
        service,
        settings,
        nextActions,
      },
    };
  },
};
