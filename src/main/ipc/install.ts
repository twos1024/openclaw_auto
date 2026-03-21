import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { installOpenclaw, installOpenclawWithTerminal } from "../services/install-service.js";

export function registerInstallHandlers(): void {
  ipcMain.handle(IPC.INSTALL_OPENCLAW, async () => {
    try { return ok(await installOpenclaw()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.INSTALL_OPENCLAW_IN_TERMINAL, async () => {
    try { return ok(await installOpenclawWithTerminal()); }
    catch (error) { return err(toAppError(error)); }
  });
}
