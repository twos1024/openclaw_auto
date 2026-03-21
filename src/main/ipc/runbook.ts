import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { getRunbookModel } from "../services/runbook-service.js";

export function registerRunbookHandlers(): void {
  ipcMain.handle(IPC.GET_RUNBOOK_MODEL, async () => {
    try { return ok(await getRunbookModel()); }
    catch (error) { return err(toAppError(error)); }
  });
}
