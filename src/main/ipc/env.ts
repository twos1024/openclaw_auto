import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { detectEnv } from "../services/env-service.js";

export function registerEnvHandlers(): void {
  ipcMain.handle(IPC.DETECT_ENV, async () => {
    try { return ok(await detectEnv()); }
    catch (error) { return err(toAppError(error)); }
  });
}
