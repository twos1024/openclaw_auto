import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { checkAdminStatus, relaunchAsAdmin } from "../services/admin-service.js";

export function registerAdminHandlers(): void {
  ipcMain.handle(IPC.CHECK_ADMIN_STATUS, async () => {
    try { return ok(await checkAdminStatus()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.RELAUNCH_AS_ADMIN, async () => {
    try { return ok(await relaunchAsAdmin()); }
    catch (error) { return err(toAppError(error)); }
  });
}
