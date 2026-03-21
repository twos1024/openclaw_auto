import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resolveBrowserLanguage } from "@/lib/preferences";
import zhCommon from "./locales/zh/common.json";
import zhNavigation from "./locales/zh/navigation.json";
import zhSettings from "./locales/zh/settings.json";
import zhChat from "./locales/zh/chat.json";
import zhInstall from "./locales/zh/install.json";
import zhConfig from "./locales/zh/config.json";
import zhService from "./locales/zh/service.json";
import zhLogs from "./locales/zh/logs.json";
import zhOverview from "./locales/zh/overview.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhRunbook from "./locales/zh/runbook.json";
import zhPlugins from "./locales/zh/plugins.json";
import zhAgents from "./locales/zh/agents.json";
import zhChannels from "./locales/zh/channels.json";
import zhProviders from "./locales/zh/providers.json";
import zhCron from "./locales/zh/cron.json";
import zhSkills from "./locales/zh/skills.json";
import zhModels from "./locales/zh/models.json";
import zhFeedback from "./locales/zh/feedback.json";
import zhSetup from "./locales/zh/setup.json";
import enCommon from "./locales/en/common.json";
import enNavigation from "./locales/en/navigation.json";
import enSettings from "./locales/en/settings.json";
import enChat from "./locales/en/chat.json";
import enInstall from "./locales/en/install.json";
import enConfig from "./locales/en/config.json";
import enService from "./locales/en/service.json";
import enLogs from "./locales/en/logs.json";
import enOverview from "./locales/en/overview.json";
import enDashboard from "./locales/en/dashboard.json";
import enRunbook from "./locales/en/runbook.json";
import enPlugins from "./locales/en/plugins.json";
import enAgents from "./locales/en/agents.json";
import enChannels from "./locales/en/channels.json";
import enProviders from "./locales/en/providers.json";
import enCron from "./locales/en/cron.json";
import enSkills from "./locales/en/skills.json";
import enModels from "./locales/en/models.json";
import enFeedback from "./locales/en/feedback.json";
import enSetup from "./locales/en/setup.json";
import jaCommon from "./locales/ja/common.json";
import jaNavigation from "./locales/ja/navigation.json";
import jaSettings from "./locales/ja/settings.json";
import jaChat from "./locales/ja/chat.json";
import jaInstall from "./locales/ja/install.json";
import jaConfig from "./locales/ja/config.json";
import jaService from "./locales/ja/service.json";
import jaLogs from "./locales/ja/logs.json";
import jaOverview from "./locales/ja/overview.json";
import jaDashboard from "./locales/ja/dashboard.json";
import jaRunbook from "./locales/ja/runbook.json";
import jaPlugins from "./locales/ja/plugins.json";
import jaAgents from "./locales/ja/agents.json";
import jaChannels from "./locales/ja/channels.json";
import jaProviders from "./locales/ja/providers.json";
import jaCron from "./locales/ja/cron.json";
import jaSkills from "./locales/ja/skills.json";
import jaModels from "./locales/ja/models.json";
import jaFeedback from "./locales/ja/feedback.json";
import jaSetup from "./locales/ja/setup.json";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: resolveBrowserLanguage(typeof navigator === "undefined" ? undefined : navigator.language),
    fallbackLng: "zh",
    defaultNS: "common",
    ns: ["common", "navigation", "settings", "chat", "skills", "models", "feedback", "install", "config", "service", "logs", "overview", "dashboard", "runbook", "plugins", "agents", "channels", "providers", "cron", "setup"],
    resources: {
      zh: {
        common: zhCommon,
        navigation: zhNavigation,
        settings: zhSettings,
        chat: zhChat,
        install: zhInstall,
        config: zhConfig,
        service: zhService,
        logs: zhLogs,
        overview: zhOverview,
        dashboard: zhDashboard,
        runbook: zhRunbook,
        plugins: zhPlugins,
        skills: zhSkills,
        models: zhModels,
        feedback: zhFeedback,
        agents: zhAgents,
        channels: zhChannels,
        providers: zhProviders,
        cron: zhCron,
        setup: zhSetup,
      },
      en: {
        common: enCommon,
        navigation: enNavigation,
        settings: enSettings,
        chat: enChat,
        install: enInstall,
        config: enConfig,
        service: enService,
        logs: enLogs,
        overview: enOverview,
        dashboard: enDashboard,
        runbook: enRunbook,
        plugins: enPlugins,
        skills: enSkills,
        models: enModels,
        feedback: enFeedback,
        agents: enAgents,
        channels: enChannels,
        providers: enProviders,
        cron: enCron,
        setup: enSetup,
      },
      ja: {
        common: jaCommon,
        navigation: jaNavigation,
        settings: jaSettings,
        chat: jaChat,
        install: jaInstall,
        config: jaConfig,
        service: jaService,
        logs: jaLogs,
        overview: jaOverview,
        dashboard: jaDashboard,
        runbook: jaRunbook,
        plugins: jaPlugins,
        skills: jaSkills,
        models: jaModels,
        feedback: jaFeedback,
        agents: jaAgents,
        channels: jaChannels,
        providers: jaProviders,
        cron: jaCron,
        setup: jaSetup,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
