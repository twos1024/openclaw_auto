import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  resolveBrowserLanguage,
  type AppLanguage,
  type ThemePreference,
} from "@/lib/preferences";

interface SettingsStore {
  sidebarCollapsed: boolean;
  theme: ThemePreference;
  language: AppLanguage;
  setupComplete: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: AppLanguage) => void;
  setSetupComplete: (complete: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      language: resolveBrowserLanguage(typeof navigator === "undefined" ? undefined : navigator.language),
      setupComplete: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSetupComplete: (setupComplete) => set({ setupComplete }),
    }),
    {
      name: "openclaw-manager-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        language: state.language,
        setupComplete: state.setupComplete,
      }),
    },
  ),
);
