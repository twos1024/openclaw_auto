import { AppError, ErrorCode } from "../models/error.js";

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const msg = error instanceof Error ? error.message : String(error);
  return new AppError(ErrorCode.InternalError, msg, "An unexpected error occurred.");
}
