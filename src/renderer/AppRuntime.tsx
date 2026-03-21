import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import i18n from "@/i18n";
import { router } from "@/router";
import { resolveThemeClass } from "@/lib/preferences";
import { useSettingsStore } from "@/store/useSettingsStore";

export function AppRuntime(): JSX.Element {
  const theme = useSettingsStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);

  useEffect(() => {
    document.documentElement.lang = language;
    void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      root.classList.remove("light", "dark");
      root.classList.add(resolveThemeClass(theme, mediaQuery.matches));
    };

    applyTheme();

    if (theme !== "system") {
      return undefined;
    }

    const handleThemeChange = () => applyTheme();
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [theme]);

  return <RouterProvider router={router} />;
}
