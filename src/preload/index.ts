import { contextBridge, ipcRenderer } from "electron";

// Expose a safe, minimal API to the renderer process.
// contextIsolation: true + nodeIntegration: false ensures only this
// explicitly-listed API is accessible from renderer code.
contextBridge.exposeInMainWorld("api", {
  invoke: <T>(channel: string, payload?: Record<string, unknown>): Promise<T> =>
    ipcRenderer.invoke(channel, payload),

  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  removeListener: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback as Parameters<typeof ipcRenderer.removeListener>[1]);
  },
});

// Expose process info the renderer may need (platform, versions)
contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: process.versions,
});
