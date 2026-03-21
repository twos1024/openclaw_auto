import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import {
  getGatewayStatus,
  startGateway,
  stopGateway,
  restartGateway,
  openDashboard,
  probeDashboardEndpoint,
} from "../services/gateway-service.js";

export function registerGatewayHandlers(): void {
  ipcMain.handle(IPC.GET_GATEWAY_STATUS, async () => {
    try { return ok(await getGatewayStatus()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.START_GATEWAY, async () => {
    try { return ok(await startGateway()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.STOP_GATEWAY, async () => {
    try { return ok(await stopGateway()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.RESTART_GATEWAY, async () => {
    try { return ok(await restartGateway()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.OPEN_DASHBOARD, async () => {
    try { return ok(await openDashboard()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.PROBE_DASHBOARD_ENDPOINT, async (_event, payload: { address: string }) => {
    try { return ok(await probeDashboardEndpoint(payload.address)); }
    catch (error) { return err(toAppError(error)); }
  });
}
