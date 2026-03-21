import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import {
  listChannels,
  addChannel,
  updateChannel,
  deleteChannel,
} from "../services/channel-service.js";
import type {
  CreateChannelPayload,
  UpdateChannelPayload,
} from "../services/channel-service.js";

export function registerChannelHandlers(): void {
  ipcMain.handle(IPC.LIST_CHANNELS, async () => {
    try { return ok(await listChannels()); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.ADD_CHANNEL, async (_event, payload: CreateChannelPayload) => {
    try { return ok(await addChannel(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.UPDATE_CHANNEL, async (_event, payload: UpdateChannelPayload) => {
    try { return ok(await updateChannel(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.DELETE_CHANNEL, async (_event, payload: { id: string }) => {
    try { return ok(await deleteChannel(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });
}
