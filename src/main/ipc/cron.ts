import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import {
  listCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  triggerCronJob,
} from "../services/cron-service.js";
import type {
  CreateCronJobPayload,
  UpdateCronJobPayload,
} from "../services/cron-service.js";

export function registerCronHandlers(): void {
  ipcMain.handle(IPC.LIST_CRON_JOBS, async () => {
    try { return ok(await listCronJobs()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.CREATE_CRON_JOB, async (_event, payload: CreateCronJobPayload) => {
    try { return ok(await createCronJob(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.UPDATE_CRON_JOB, async (_event, payload: UpdateCronJobPayload) => {
    try { return ok(await updateCronJob(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.DELETE_CRON_JOB, async (_event, payload: { id: string }) => {
    try { return ok(await deleteCronJob(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.TRIGGER_CRON_JOB, async (_event, payload: { id: string }) => {
    try { return ok(await triggerCronJob(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });
}
