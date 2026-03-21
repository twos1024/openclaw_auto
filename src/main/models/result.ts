import type { AppError } from "./error.js";

export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    suggestion: string;
    details?: unknown;
  };
}

export function ok<T>(data: T): CommandResult<T> {
  return { success: true, data };
}

export function err<T>(error: AppError): CommandResult<T> {
  return { success: false, error: error.toJSON() as CommandResult<T>["error"] };
}
