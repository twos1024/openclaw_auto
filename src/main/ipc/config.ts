import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import {
  readOpenclawConfig,
  writeOpenclawConfig,
  backupOpenclawConfig,
} from "../services/config-service.js";

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC.READ_OPENCLAW_CONFIG, async (_event, payload?: { path?: string }) => {
    try { return ok(await readOpenclawConfig(payload?.path)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.WRITE_OPENCLAW_CONFIG, async (_event, payload: { path?: string; content: unknown }) => {
    try { return ok(await writeOpenclawConfig(payload.path, payload.content)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.BACKUP_OPENCLAW_CONFIG, async (_event, payload?: { path?: string }) => {
    try { return ok(await backupOpenclawConfig(payload?.path)); }
    catch (error) { return err(toAppError(error)); }
  });
}
