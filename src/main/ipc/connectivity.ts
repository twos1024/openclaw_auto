import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { testConnection } from "../services/connectivity-service.js";
import type { ConnectionConfigInput } from "../services/connectivity-service.js";

export function registerConnectivityHandlers(): void {
  ipcMain.handle(IPC.TEST_CONNECTION, async (_event, payload: ConnectionConfigInput) => {
    try { return ok(await testConnection(payload)); }
    catch (error) { return err(toAppError(error)); }
  });
}
