import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import { readLogs, exportDiagnostics, LogSource } from "../services/log-service.js";

export function registerLogsHandlers(): void {
  ipcMain.handle(IPC.READ_LOGS, async (_event, payload: { source: string; lines?: number }) => {
    try {
      const source = payload.source as LogSource;
      return ok(await readLogs(source, payload.lines ?? 1200));
    }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.EXPORT_DIAGNOSTICS, async (_event, payload: {
    source: string;
    keyword?: string;
    content: string;
    archive?: boolean;
  }) => {
    try {
      const source = payload.source as LogSource;
      return ok(await exportDiagnostics(source, payload.keyword, payload.content, payload.archive ?? false));
    }
    catch (error) { return err(toAppError(error)); }
  });
}
