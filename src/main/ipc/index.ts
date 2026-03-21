import { registerAgentHandlers } from "./agent.js";
import { registerChannelHandlers } from "./channel.js";
import { registerProviderHandlers } from "./provider.js";
import { registerCronHandlers } from "./cron.js";
import { registerAdminHandlers } from "./admin.js";
import { registerEnvHandlers } from "./env.js";
import { registerInstallHandlers } from "./install.js";
import { registerConnectivityHandlers } from "./connectivity.js";
import { registerConfigHandlers } from "./config.js";
import { registerGatewayHandlers } from "./gateway.js";
import { registerLogsHandlers } from "./logs.js";
import { registerSettingsHandlers } from "./settings.js";
import { registerOverviewHandlers } from "./overview.js";
import { registerRunbookHandlers } from "./runbook.js";

export function registerAllIpcHandlers(): void {
  registerAgentHandlers();
  registerChannelHandlers();
  registerProviderHandlers();
  registerCronHandlers();
  registerAdminHandlers();
  registerEnvHandlers();
  registerInstallHandlers();
  registerConnectivityHandlers();
  registerConfigHandlers();
  registerGatewayHandlers();
  registerLogsHandlers();
  registerSettingsHandlers();
  registerOverviewHandlers();
  registerRunbookHandlers();
}
