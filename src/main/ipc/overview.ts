import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { getOverviewStatus } from "../services/overview-service.js";

export function registerOverviewHandlers(): void {
  ipcMain.handle(IPC.GET_OVERVIEW_STATUS, async () => {
    try { return ok(await getOverviewStatus()); }
    catch (error) { return err(toAppError(error)); }
  });
}
