/**
 * hostBridgeMock.ts — Test helper for mocking the host bridge environment.
 *
 * Use these helpers in unit and integration tests to simulate the three
 * host runtime modes: browser-preview, host-runtime-available,
 * host-runtime-unavailable.
 *
 * Also supports the legacy __TAURI__ global for backward-compat tests.
 */
import { vi } from "vitest";

type MockInvokeFn = ReturnType<typeof vi.fn>;

/** Reset all host bridge globals to an undefined state (browser-preview mode). */
export function resetHostBridgeGlobals(): void {
  Object.defineProperty(window, "__TAURI__", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(window, "isTauri", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, "isTauri", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

/**
 * Simulate browser-preview mode: no shell, no invoke bridge.
 * This is the default state after calling resetHostBridgeGlobals().
 */
export function simulateBrowserPreview(): void {
  resetHostBridgeGlobals();
}

/**
 * Simulate host-runtime-available mode: shell detected + official invoke bridge present.
 * Returns the mock invoke function so tests can configure responses.
 */
export function simulateHostRuntimeAvailable(
  handlers: Record<string, (payload?: Record<string, unknown>) => unknown> = {},
): MockInvokeFn {
  Object.defineProperty(window, "isTauri", {
    configurable: true,
    writable: true,
    value: true,
  });
  Object.defineProperty(globalThis, "isTauri", {
    configurable: true,
    writable: true,
    value: true,
  });

  const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled invoke command in test: ${command}`);
    }
    return handler(payload);
  });

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    writable: true,
    value: { invoke },
  });

  return invoke;
}

/**
 * Simulate host-runtime-unavailable mode: shell detected but no invoke bridge.
 */
export function simulateHostRuntimeUnavailable(): void {
  Object.defineProperty(window, "isTauri", {
    configurable: true,
    writable: true,
    value: true,
  });
  Object.defineProperty(globalThis, "isTauri", {
    configurable: true,
    writable: true,
    value: true,
  });
  // No __TAURI_INTERNALS__ or __TAURI__.core.invoke — bridge is missing
}

/**
 * Simulate host-runtime-available mode using the legacy __TAURI__ global fallback.
 * Useful for backward-compat tests verifying tauriClient shim behaviour.
 */
export function simulateLegacyTauriBridge(
  handlers: Record<string, (payload?: Record<string, unknown>) => unknown> = {},
): MockInvokeFn {
  const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled invoke command in test: ${command}`);
    }
    return handler(payload);
  });

  Object.defineProperty(window, "__TAURI__", {
    configurable: true,
    writable: true,
    value: { core: { invoke } },
  });

  return invoke;
}
