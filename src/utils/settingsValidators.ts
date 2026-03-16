import type { AppSettings, SettingsFormErrors } from "../types/settings";

export function validateSettingsForm(values: AppSettings): SettingsFormErrors {
  const errors: SettingsFormErrors = {};

  if (!values.diagnosticsDir.trim()) {
    errors.diagnosticsDir = "Diagnostics directory is required.";
  }

  if (!Number.isFinite(values.logLineLimit) || values.logLineLimit < 1 || values.logLineLimit > 20000) {
    errors.logLineLimit = "Log line limit must be between 1 and 20000.";
  }

  if (!Number.isFinite(values.gatewayPollMs) || values.gatewayPollMs < 1000 || values.gatewayPollMs > 60000) {
    errors.gatewayPollMs = "Gateway polling interval must be between 1000 and 60000 ms.";
  }

  return errors;
}

export function hasSettingsValidationError(errors: SettingsFormErrors): boolean {
  return Object.values(errors).some((value) => typeof value === "string" && value.length > 0);
}
