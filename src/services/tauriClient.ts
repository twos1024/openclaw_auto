import type { BackendError, CommandResult } from "../types/api";

type InvokeFn = <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: InvokeFn;
      };
    };
  }
}

function createUnavailableError(): BackendError {
  return {
    code: "E_TAURI_UNAVAILABLE",
    message: "Tauri invoke is unavailable in current runtime.",
    suggestion: "Run ClawDesk inside the Tauri desktop shell to use local commands.",
  };
}

export function getInvoke(): InvokeFn | null {
  return window.__TAURI__?.core?.invoke ?? null;
}

export function isTauriRuntime(): boolean {
  return getInvoke() !== null;
}

export async function invokeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  const invoke = getInvoke();
  if (!invoke) {
    return {
      success: false,
      error: createUnavailableError(),
    };
  }

  try {
    return await invoke<CommandResult<T>>(command, payload);
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "E_INVOKE",
        message: error instanceof Error ? error.message : `Failed to invoke command: ${command}`,
        suggestion: "Ensure the backend command is registered and Tauri is running normally.",
      },
    };
  }
}
