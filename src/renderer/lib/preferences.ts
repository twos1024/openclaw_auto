export const SUPPORTED_LANGUAGES = ["zh", "en", "ja"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

export function resolveBrowserLanguage(language?: string | null): AppLanguage {
  if (!language) {
    return "zh";
  }

  const normalized = language.toLowerCase();
  if (normalized.startsWith("ja")) {
    return "ja";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return "zh";
}

export function resolveThemeClass(theme: ThemePreference, prefersDark: boolean): "light" | "dark" {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }
  return theme;
}
