import { ipcMain } from "electron";
import { IPC } from "../../shared/ipc-channels.js";
import { ok, err } from "../models/result.js";
import { toAppError } from "./utils.js";
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  startAgent,
  stopAgent,
} from "../services/agent-service.js";
import type {
  CreateAgentPayload,
  UpdateAgentPayload,
} from "../services/agent-service.js";

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.LIST_AGENTS, async (_event, payload?: { search?: string }) => {
    try { return ok(await listAgents(payload?.search)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.CREATE_AGENT, async (_event, payload: CreateAgentPayload) => {
    try { return ok(await createAgent(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.UPDATE_AGENT, async (_event, payload: UpdateAgentPayload) => {
    try { return ok(await updateAgent(payload)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.DELETE_AGENT, async (_event, payload: { id: string }) => {
    try { return ok(await deleteAgent(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.START_AGENT, async (_event, payload: { id: string }) => {
    try { return ok(await startAgent(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });

  ipcMain.handle(IPC.STOP_AGENT, async (_event, payload: { id: string }) => {
    try { return ok(await stopAgent(payload.id)); }
    catch (error) { return err(toAppError(error)); }
  });
}
