import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "../../src/renderer/types/settings";
import { hasSettingsValidationError, validateSettingsForm } from "../../src/renderer/utils/settingsValidators";

describe("validateSettingsForm", () => {
  it("returns diagnosticsDir error when diagnosticsDir is empty", () => {
    const errors = validateSettingsForm({
      ...defaultAppSettings,
      diagnosticsDir: "",
    });

    expect(errors.diagnosticsDir).toBe("Diagnostics directory is required.");
  });

  it("returns no error for valid settings", () => {
    const errors = validateSettingsForm({
      ...defaultAppSettings,
      diagnosticsDir: "C:\\ClawDesk\\diagnostics",
    });

    expect(hasSettingsValidationError(errors)).toBe(false);
  });
});
