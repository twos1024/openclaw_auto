import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { readAppSettings, writeAppSettings } from "../services/settings-service.js";
import type { AppSettings } from "../services/settings-service.js";

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.READ_APP_SETTINGS, async (_event, payload?: { path?: string }) => {
    try { return ok(await readAppSettings(payload?.path)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.WRITE_APP_SETTINGS, async (_event, payload: { path?: string; content: AppSettings }) => {
    try { return ok(await writeAppSettings(payload.path, payload.content)); }
    catch (error) { return err(toAppError(error)); }
  });
}
