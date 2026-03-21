import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  validateProvider,
} from "../services/provider-service.js";
import type {
  CreateProviderPayload,
  UpdateProviderPayload,
} from "../services/provider-service.js";

export function registerProviderHandlers(): void {
  ipcMain.handle(IPC.LIST_PROVIDERS, async () => {
    try { return ok(await listProviders()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.CREATE_PROVIDER, async (_event, payload: CreateProviderPayload) => {
    try { return ok(await createProvider(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.UPDATE_PROVIDER, async (_event, payload: UpdateProviderPayload) => {
    try { return ok(await updateProvider(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.DELETE_PROVIDER, async (_event, payload: { id: string }) => {
    try { return ok(await deleteProvider(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.VALIDATE_PROVIDER, async (_event, payload: { id: string }) => {
    try { return ok(await validateProvider(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });
}
