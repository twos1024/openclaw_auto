import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const BASE_URL = "http://127.0.0.1:4175";
const REPORT_PATH = path.resolve("docs/testing/phase6-manual-b.md");
const STATE_KEY = "__phase6_manual_b_state_v1__";
const PERSISTED_KEY = "openclaw-manager-settings";
const GATEWAY_ADDRESS = "http://127.0.0.1:18789";

function isoNow() {
  return new Date().toISOString();
}

function createInitialState() {
  const now = isoNow();
  return {
    counters: { agent: 0, channel: 0, provider: 1, cron: 0, execution: 0 },
    runtime: {
      running: true,
      port: 18789,
      address: GATEWAY_ADDRESS,
      pid: 24680,
      lastStartedAt: now,
    },
    appSettings: {
      preferredInstallSource: "npm-global",
      diagnosticsDir: "C:\\Temp\\phase6",
      logLineLimit: 1200,
      gatewayPollMs: 5000,
      modifiedAt: now,
    },
    agents: [
      {
        id: "agent-seed",
        displayName: "Seed Agent",
        systemPrompt: "Seed helper for cron validation.",
        modelId: "gpt-4o",
        modelName: "GPT-4o",
        modelParams: { temperature: 0.7, maxTokens: 4096 },
        channelIds: ["channel-seed"],
        channelType: "openclaw",
        apiKeyRef: "seed",
        baseUrl: "",
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        totalTokensUsed: 0,
        totalConversations: 0,
      },
    ],
    channels: [
      {
        id: "channel-seed",
        name: "Seed Channel",
        type: "openclaw",
        status: "connected",
        connectionType: "none",
        description: "Seed helper for cron validation.",
        providerId: "provider-seed",
        agentIds: ["agent-seed"],
        updatedAt: now,
      },
    ],
    providers: [
      {
        id: "provider-seed",
        name: "Seed Provider",
        vendor: "openai",
        apiKeyMasked: "sk***",
        baseUrl: "https://api.openai.com/v1",
        modelCount: 1,
        status: "ready",
        updatedAt: now,
      },
    ],
    cronJobs: [],
    sessions: [],
    messagesBySession: {},
  };
}

function makeRow(title, status, steps, error = "", reproSteps = []) {
  return { title, status, steps, error, reproSteps };
}

function renderReport(results) {
  const lines = [];
  lines.push("# Phase 6 Manual B");
  lines.push("");
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Base URL: ${BASE_URL}`);
  lines.push("");
  lines.push("## Summary");
  for (const item of results) {
    lines.push(`- ${item.title}: ${item.status}`);
  }
  lines.push("");
  for (const item of results) {
    lines.push(`## ${item.title}`);
    lines.push(`- Result: ${item.status}`);
    lines.push("- 操作步骤与可见结果:");
    for (const step of item.steps) {
      lines.push(`  - ${step}`);
    }
    if (item.status === "FAIL") {
      lines.push("- 失败复现步骤:");
      for (const step of item.reproSteps) {
        lines.push(`  - ${step}`);
      }
      lines.push(`- Failure: ${item.error}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function makeInitScript() {
  return String.raw`
    const STATE_KEY = ${JSON.stringify(STATE_KEY)};
    const PERSISTED_KEY = ${JSON.stringify(PERSISTED_KEY)};
    const GATEWAY_ADDRESS = ${JSON.stringify(GATEWAY_ADDRESS)};
    const DEFAULT_STATE = ${JSON.stringify(createInitialState())};
    const PERSISTED_SETTINGS = { sidebarCollapsed: false, theme: "system", language: "en", setupComplete: true };
    const originalFetch = window.fetch.bind(window);

    const read = (key, fallback) => {
      try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch {}
      return fallback;
    };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const state = () => read(STATE_KEY, structuredClone(DEFAULT_STATE));
    const save = (value) => write(STATE_KEY, value);
    const id = (s, key) => key + "-" + (s.counters[key] = (s.counters[key] ?? 0) + 1);
    const agentLabel = (s, value) => s.agents.find((a) => a.id === value)?.displayName ?? value;
    const getMessages = (s, key) => (s.messagesBySession[key] ??= []);

    write(PERSISTED_KEY, { state: PERSISTED_SETTINGS, version: 0 });
    window.confirm = () => true;
    window.fetch = async (input, init) => {
      const req = typeof input === "string" ? new Request(input, init) : new Request(input, init);
      const url = new URL(req.url);
      if (url.origin !== GATEWAY_ADDRESS) return originalFetch(input, init);
      const s = state();
      if (url.pathname === "/api/sessions" && req.method === "GET") {
        save(s);
        return new Response(JSON.stringify(s.sessions), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const history = url.pathname.match(/^\\/api\\/sessions\\/([^/]+)\\/history$/);
      if (history && req.method === "GET") {
        const key = decodeURIComponent(history[1]);
        save(s);
        return new Response(JSON.stringify(clone(s.messagesBySession[key] ?? [])), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const stream = url.pathname.match(/^\\/api\\/sessions\\/([^/]+)\\/stream$/);
      if (stream && req.method === "POST") {
        const key = decodeURIComponent(stream[1]);
        const body = await req.json().catch(() => ({}));
        const text = typeof body.message === "string" ? body.message : "";
        const agentId = typeof body.agentId === "string" ? body.agentId : "main";
        const reply = "Mock reply for " + agentLabel(s, agentId) + ": " + text;
        getMessages(s, key).push(
          { id: "usr-" + Date.now(), role: "user", content: text, timestamp: Date.now() / 1000, agentId },
          { id: "ast-" + Date.now(), role: "assistant", content: reply, timestamp: Date.now() / 1000, agentId },
        );
        const existing = s.sessions.find((session) => session.key === key);
        const session = { key, label: existing?.label ?? (agentLabel(s, agentId) + " chat"), agentId, lastActivity: Date.now(), messageCount: s.messagesBySession[key].length };
        if (existing) Object.assign(existing, session); else s.sessions.unshift(session);
        save(s);
        return new Response("data: " + JSON.stringify({ type: "delta", delta: reply }) + "\n\ndata: " + JSON.stringify({ type: "done" }) + "\n\n", { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
      }
      return new Response(JSON.stringify({ error: "mock endpoint not implemented" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    };
    window.__TAURI__ = { core: { invoke: async (command, payload = {}) => {
      const s = state();
      const ok = (data) => { save(s); return { success: true, data }; };
      const fail = (message) => ({ success: false, error: { code: "E_NOT_FOUND", message, suggestion: "Reload and retry." } });
      switch (command) {
        case "list_agents": return ok({ agents: clone(s.agents), total: s.agents.length, running: s.agents.filter((a) => a.status === "active").length });
        case "create_agent": { const agent = { id: id(s, "agent"), displayName: payload.displayName ?? "Agent", systemPrompt: payload.systemPrompt ?? "", modelId: payload.modelId ?? "gpt-4o", modelName: payload.modelName ?? "GPT-4o", modelParams: { temperature: payload.temperature ?? 0.7, maxTokens: payload.maxTokens ?? 4096 }, providerId: payload.providerId, channelIds: [], channelType: payload.channelType ?? "openclaw", apiKeyRef: payload.apiKeyRef ?? "", baseUrl: payload.baseUrl ?? "", status: "created", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastActiveAt: null, totalTokensUsed: 0, totalConversations: 0 }; s.agents.unshift(agent); return ok(agent); }
        case "start_agent": { const agent = s.agents.find((a) => a.id === payload.id); if (!agent) return fail("Agent not found."); agent.status = "active"; agent.lastActiveAt = new Date().toISOString(); agent.updatedAt = agent.lastActiveAt; return ok(agent); }
        case "stop_agent": { const agent = s.agents.find((a) => a.id === payload.id); if (!agent) return fail("Agent not found."); agent.status = "stopped"; agent.updatedAt = new Date().toISOString(); return ok(agent); }
        case "delete_agent": { s.agents = s.agents.filter((a) => a.id !== payload.id); return ok({ deleted: true, id: payload.id }); }
        case "list_channels": return ok(clone(s.channels));
        case "add_channel": { const channel = { id: id(s, "channel"), name: payload.name ?? "Channel", type: payload.type ?? "openclaw", status: "idle", connectionType: payload.connectionType ?? "none", description: payload.description, providerId: payload.providerId, agentIds: Array.isArray(payload.agentIds) ? payload.agentIds : [], updatedAt: new Date().toISOString() }; s.channels.unshift(channel); return ok(channel); }
        case "update_channel": { const channel = s.channels.find((c) => c.id === payload.id); if (!channel) return fail("Channel not found."); Object.assign(channel, payload, { status: payload.status ?? channel.status, updatedAt: new Date().toISOString() }); return ok(channel); }
        case "delete_channel": { s.channels = s.channels.filter((c) => c.id !== payload.id); return ok({ deleted: true, id: payload.id }); }
        case "list_providers": return ok(clone(s.providers));
        case "create_provider": { const apiKey = payload.apiKey ?? ""; const provider = { id: id(s, "provider"), name: payload.name ?? "Provider", vendor: payload.vendor ?? "openai", apiKeyMasked: apiKey ? (apiKey.slice(0, 3) + "***") : "sk***", baseUrl: payload.baseUrl || undefined, modelCount: 0, status: "disabled", updatedAt: new Date().toISOString() }; s.providers.unshift(provider); return ok(provider); }
        case "update_provider": { const provider = s.providers.find((p) => p.id === payload.id); if (!provider) return fail("Provider not found."); Object.assign(provider, payload, { status: payload.status ?? provider.status, updatedAt: new Date().toISOString() }); return ok(provider); }
        case "delete_provider": { s.providers = s.providers.filter((p) => p.id !== payload.id); return ok({ deleted: true, id: payload.id }); }
        case "validate_provider": { const provider = s.providers.find((p) => p.id === payload.id); if (!provider) return fail("Provider not found."); provider.status = "ready"; provider.updatedAt = new Date().toISOString(); return ok({ valid: true, detail: "Provider validation succeeded." }); }
        case "list_cron_jobs": return ok(clone(s.cronJobs));
        case "create_cron_job": { const enabled = payload.enabled !== false; const job = { id: id(s, "cron"), name: payload.name ?? "Cron Job", schedule: payload.schedule ?? "0 * * * *", enabled, agentId: payload.agentId ?? "", channelId: payload.channelId ?? "", template: payload.template ?? "", nextRunAt: enabled ? new Date(Date.now() + 3600000).toISOString() : null, lastRunAt: null, status: enabled ? "idle" : "disabled", history: [] }; s.cronJobs.unshift(job); return ok(job); }
        case "update_cron_job": { const job = s.cronJobs.find((j) => j.id === payload.id); if (!job) return fail("Cron job not found."); Object.assign(job, payload, { enabled: typeof payload.enabled === "boolean" ? payload.enabled : job.enabled, status: payload.status ?? (payload.enabled === false ? "disabled" : "idle") }); if (typeof payload.enabled === "boolean") job.nextRunAt = payload.enabled ? new Date(Date.now() + 3600000).toISOString() : null; return ok(job); }
        case "delete_cron_job": { s.cronJobs = s.cronJobs.filter((j) => j.id !== payload.id); return ok({ deleted: true, id: payload.id }); }
        case "trigger_cron_job": { const job = s.cronJobs.find((j) => j.id === payload.id); if (!job) return fail("Cron job not found."); job.lastRunAt = new Date().toISOString(); job.status = "success"; job.history.unshift({ id: "exec-" + (++s.counters.execution), startedAt: new Date().toISOString(), durationMs: 120, status: "success", summary: "Mock execution completed." }); return ok({ triggered: true, id: payload.id, detail: "Cron job triggered." }); }
        case "read_app_settings": return ok({ path: "C:\\mock\\app-settings.json", exists: true, content: clone(s.appSettings), modifiedAt: s.appSettings.modifiedAt });
        case "write_app_settings": { const next = payload.content ?? payload.settings ?? {}; s.appSettings = { preferredInstallSource: next.preferredInstallSource ?? s.appSettings.preferredInstallSource, diagnosticsDir: next.diagnosticsDir ?? "", logLineLimit: Number(next.logLineLimit ?? s.appSettings.logLineLimit), gatewayPollMs: Number(next.gatewayPollMs ?? s.appSettings.gatewayPollMs), modifiedAt: new Date().toISOString() }; return ok({ path: "C:\\mock\\app-settings.json", backupPath: "C:\\mock\\app-settings.backup.json", bytesWritten: 128 }); }
        case "detect_env": return ok({ platform: "windows", npmFound: true, npmVersion: "10.9.0", openclawFound: true, openclawVersion: "1.2.3", openclawPath: "C:\\OpenClaw\\openclaw.exe" });
        case "get_gateway_status": return ok({ state: s.runtime.running ? "running" : "stopped", running: s.runtime.running, port: s.runtime.port, address: s.runtime.address, pid: s.runtime.pid, statusDetail: s.runtime.running ? "Gateway is running." : "Gateway is not running." });
        case "start_gateway": s.runtime.running = true; s.runtime.pid = 13579; s.runtime.lastStartedAt = new Date().toISOString(); return ok({});
        default: return ok({});
      }
    } } };
  `;
}

function installMock(payload) {
  const STATE_KEY = payload.stateKey;
  const PERSISTED_KEY = payload.persistedKey;
  const GATEWAY_ADDRESS = payload.gatewayAddress;
  const DEFAULT_STATE = payload.defaultState;
  const PERSISTED_SETTINGS = payload.persistedSettings;
  const originalFetch = window.fetch.bind(window);

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {}
    return fallback;
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const state = () => read(STATE_KEY, structuredClone(DEFAULT_STATE));
  const save = (value) => write(STATE_KEY, value);
  const id = (s, key) => key + "-" + (s.counters[key] = (s.counters[key] ?? 0) + 1);
  const agentLabel = (s, value) => s.agents.find((a) => a.id === value)?.displayName ?? value;
  const getMessages = (s, key) => (s.messagesBySession[key] ??= []);

  write(PERSISTED_KEY, { state: PERSISTED_SETTINGS, version: 0 });
  window.confirm = () => true;
  window.isTauri = true;
  window.fetch = async (input, init) => {
    const req = typeof input === "string" ? new Request(input, init) : new Request(input, init);
    const url = new URL(req.url);
    if (url.origin !== GATEWAY_ADDRESS) return originalFetch(input, init);
    const s = state();
    if (url.pathname === "/api/sessions" && req.method === "GET") {
      save(s);
      return new Response(JSON.stringify(s.sessions), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const history = url.pathname.match(/^\/api\/sessions\/([^/]+)\/history$/);
    if (history && req.method === "GET") {
      const key = decodeURIComponent(history[1]);
      save(s);
      return new Response(JSON.stringify(clone(s.messagesBySession[key] ?? [])), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const stream = url.pathname.match(/^\/api\/sessions\/([^/]+)\/stream$/);
    if (stream && req.method === "POST") {
      const key = decodeURIComponent(stream[1]);
      const body = await req.json().catch(() => ({}));
      const text = typeof body.message === "string" ? body.message : "";
      const agentId = typeof body.agentId === "string" ? body.agentId : "main";
      const reply = "Mock reply for " + agentLabel(s, agentId) + ": " + text;
      getMessages(s, key).push(
        { id: "usr-" + Date.now(), role: "user", content: text, timestamp: Date.now() / 1000, agentId },
        { id: "ast-" + Date.now(), role: "assistant", content: reply, timestamp: Date.now() / 1000, agentId },
      );
      const existing = s.sessions.find((session) => session.key === key);
      const session = { key, label: existing?.label ?? (agentLabel(s, agentId) + " chat"), agentId, lastActivity: Date.now(), messageCount: s.messagesBySession[key].length };
      if (existing) Object.assign(existing, session);
      else s.sessions.unshift(session);
      save(s);
      return new Response("data: " + JSON.stringify({ type: "delta", delta: reply }) + "\n\ndata: " + JSON.stringify({ type: "done" }) + "\n\n", { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }
    return new Response(JSON.stringify({ error: "mock endpoint not implemented" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };
  window.__TAURI__ = {
    core: {
      invoke: async (command, payload = {}) => {
        const s = state();
        const ok = (data) => {
          save(s);
          return { success: true, data };
        };
        const fail = (message) => ({ success: false, error: { code: "E_NOT_FOUND", message, suggestion: "Reload and retry." } });
        switch (command) {
          case "list_agents":
            return ok({ agents: clone(s.agents), total: s.agents.length, running: s.agents.filter((a) => a.status === "active").length });
          case "create_agent": {
            const agent = {
              id: id(s, "agent"),
              displayName: payload.displayName ?? "Agent",
              systemPrompt: payload.systemPrompt ?? "",
              modelId: payload.modelId ?? "gpt-4o",
              modelName: payload.modelName ?? "GPT-4o",
              modelParams: { temperature: payload.temperature ?? 0.7, maxTokens: payload.maxTokens ?? 4096 },
              providerId: payload.providerId,
              channelIds: [],
              channelType: payload.channelType ?? "openclaw",
              apiKeyRef: payload.apiKeyRef ?? "",
              baseUrl: payload.baseUrl ?? "",
              status: "created",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastActiveAt: null,
              totalTokensUsed: 0,
              totalConversations: 0,
            };
            s.agents.unshift(agent);
            return ok(agent);
          }
          case "start_agent": {
            const agent = s.agents.find((a) => a.id === payload.id);
            if (!agent) return fail("Agent not found.");
            agent.status = "active";
            agent.lastActiveAt = new Date().toISOString();
            agent.updatedAt = agent.lastActiveAt;
            return ok(agent);
          }
          case "stop_agent": {
            const agent = s.agents.find((a) => a.id === payload.id);
            if (!agent) return fail("Agent not found.");
            agent.status = "stopped";
            agent.updatedAt = new Date().toISOString();
            return ok(agent);
          }
          case "delete_agent":
            s.agents = s.agents.filter((a) => a.id !== payload.id);
            return ok({ deleted: true, id: payload.id });
          case "list_channels":
            return ok(clone(s.channels));
          case "add_channel": {
            const channel = { id: id(s, "channel"), name: payload.name ?? "Channel", type: payload.type ?? "openclaw", status: "idle", connectionType: payload.connectionType ?? "none", description: payload.description, providerId: payload.providerId, agentIds: Array.isArray(payload.agentIds) ? payload.agentIds : [], updatedAt: new Date().toISOString() };
            s.channels.unshift(channel);
            return ok(channel);
          }
          case "update_channel": {
            const channel = s.channels.find((c) => c.id === payload.id);
            if (!channel) return fail("Channel not found.");
            Object.assign(channel, payload, { status: payload.status ?? channel.status, updatedAt: new Date().toISOString() });
            return ok(channel);
          }
          case "delete_channel":
            s.channels = s.channels.filter((c) => c.id !== payload.id);
            return ok({ deleted: true, id: payload.id });
          case "list_providers":
            return ok(clone(s.providers));
          case "create_provider": {
            const apiKey = payload.apiKey ?? "";
            const provider = { id: id(s, "provider"), name: payload.name ?? "Provider", vendor: payload.vendor ?? "openai", apiKeyMasked: apiKey ? (apiKey.slice(0, 3) + "***") : "sk***", baseUrl: payload.baseUrl || undefined, modelCount: 0, status: "disabled", updatedAt: new Date().toISOString() };
            s.providers.unshift(provider);
            return ok(provider);
          }
          case "update_provider": {
            const provider = s.providers.find((p) => p.id === payload.id);
            if (!provider) return fail("Provider not found.");
            Object.assign(provider, payload, { status: payload.status ?? provider.status, updatedAt: new Date().toISOString() });
            return ok(provider);
          }
          case "delete_provider":
            s.providers = s.providers.filter((p) => p.id !== payload.id);
            return ok({ deleted: true, id: payload.id });
          case "validate_provider": {
            const provider = s.providers.find((p) => p.id === payload.id);
            if (!provider) return fail("Provider not found.");
            provider.status = "ready";
            provider.updatedAt = new Date().toISOString();
            return ok({ valid: true, detail: "Provider validation succeeded." });
          }
          case "list_cron_jobs":
            return ok(clone(s.cronJobs));
          case "create_cron_job": {
            const enabled = payload.enabled !== false;
            const job = { id: id(s, "cron"), name: payload.name ?? "Cron Job", schedule: payload.schedule ?? "0 * * * *", enabled, agentId: payload.agentId ?? "", channelId: payload.channelId ?? "", template: payload.template ?? "", nextRunAt: enabled ? new Date(Date.now() + 3600000).toISOString() : null, lastRunAt: null, status: enabled ? "idle" : "disabled", history: [] };
            s.cronJobs.unshift(job);
            return ok(job);
          }
          case "update_cron_job": {
            const job = s.cronJobs.find((j) => j.id === payload.id);
            if (!job) return fail("Cron job not found.");
            Object.assign(job, payload, { enabled: typeof payload.enabled === "boolean" ? payload.enabled : job.enabled, status: payload.status ?? (payload.enabled === false ? "disabled" : "idle") });
            if (typeof payload.enabled === "boolean") job.nextRunAt = payload.enabled ? new Date(Date.now() + 3600000).toISOString() : null;
            return ok(job);
          }
          case "delete_cron_job":
            s.cronJobs = s.cronJobs.filter((j) => j.id !== payload.id);
            return ok({ deleted: true, id: payload.id });
          case "trigger_cron_job": {
            const job = s.cronJobs.find((j) => j.id === payload.id);
            if (!job) return fail("Cron job not found.");
            job.lastRunAt = new Date().toISOString();
            job.status = "success";
            job.history.unshift({ id: "exec-" + (++s.counters.execution), startedAt: new Date().toISOString(), durationMs: 120, status: "success", summary: "Mock execution completed." });
            return ok({ triggered: true, id: payload.id, detail: "Cron job triggered." });
          }
          case "read_app_settings":
            return ok(clone(s.appSettings));
          case "write_app_settings": {
            const next = payload.content ?? payload.settings ?? {};
            s.appSettings = { preferredInstallSource: next.preferredInstallSource ?? s.appSettings.preferredInstallSource, diagnosticsDir: next.diagnosticsDir ?? "", logLineLimit: Number(next.logLineLimit ?? s.appSettings.logLineLimit), gatewayPollMs: Number(next.gatewayPollMs ?? s.appSettings.gatewayPollMs), modifiedAt: new Date().toISOString() };
            return ok(clone(s.appSettings));
          }
          case "detect_env":
            return ok({ platform: "windows", npmFound: true, npmVersion: "10.9.0", openclawFound: true, openclawVersion: "1.2.3", openclawPath: "C:\\OpenClaw\\openclaw.exe" });
          case "get_gateway_status":
            return ok({ state: s.runtime.running ? "running" : "stopped", running: s.runtime.running, port: s.runtime.port, address: s.runtime.address, pid: s.runtime.pid, statusDetail: s.runtime.running ? "Gateway is running." : "Gateway is not running." });
          case "start_gateway":
            s.runtime.running = true;
            s.runtime.pid = 13579;
            s.runtime.lastStartedAt = new Date().toISOString();
            return ok({});
          default:
            return ok({});
        }
      },
    },
  };
}

async function openPage(page, route) {
  await page.goto(`${BASE_URL}/#${route}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(250);
}

function cardByTitle(page, title) {
  return page.locator("div.rounded-2xl").filter({
    has: page.getByText(title, { exact: true }),
  }).first();
}

async function runAgentFlow(page) {
  const steps = [];
  await openPage(page, "/agents");
  await page.getByRole("button", { name: /^New Agent$/ }).click();
  await page.getByPlaceholder("e.g. Support Assistant").fill("Phase 6 Agent");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /support assistant/i }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /^GPT-4o$/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create Agent" }).click();
  const createdCard = cardByTitle(page, "Phase 6 Agent");
  await createdCard.getByText("Phase 6 Agent", { exact: true }).waitFor({ state: "visible" });
  steps.push("Created agent card visible: Phase 6 Agent.");

  await createdCard.getByRole("button", { name: /^Start$/ }).click();
  await createdCard.getByText("Running", { exact: true }).waitFor({ state: "visible" });
  steps.push("Agent status switched to Running.");

  await openPage(page, "/chat");
  const chatInput = page.getByPlaceholder(/Send a message|发送消息|メッセージ/);
  await chatInput.fill("Hello from phase 6");
  await chatInput.press("Enter");
  await page.getByText("Hello from phase 6", { exact: true }).waitFor({ state: "visible" });
  await page.getByText(/Mock reply for .*: Hello from phase 6/).waitFor({ state: "visible" });
  steps.push("Chat shows user message and mocked assistant reply.");

  await openPage(page, "/agents");
  const updatedCard = cardByTitle(page, "Phase 6 Agent");
  await updatedCard.getByRole("button", { name: /^Stop$/ }).click();
  await updatedCard.getByText("Stopped", { exact: true }).waitFor({ state: "visible" });
  steps.push("Agent status switched back to Stopped.");

  await updatedCard.locator("button").last().click();
  await page.getByText("Phase 6 Agent", { exact: true }).waitFor({ state: "hidden" });
  steps.push("Agent card removed after delete.");
  return steps;
}

async function runChannelFlow(page) {
  const steps = [];
  await openPage(page, "/channels");
  await page.getByRole("button", { name: /^New Channel$/ }).click();
  await page.getByLabel("Name").fill("Phase 6 Channel");
  await page.getByRole("button", { name: "Create Channel" }).click();
  const channelCard = cardByTitle(page, "Phase 6 Channel");
  await channelCard.getByText("Phase 6 Channel", { exact: true }).waitFor({ state: "visible" });
  steps.push("Created channel card visible: Phase 6 Channel.");

  await channelCard.getByRole("button", { name: /^Connect$/ }).click();
  await channelCard.getByText("Connected", { exact: true }).waitFor({ state: "visible" });
  steps.push("Channel status switched to Connected.");

  await channelCard.getByRole("button", { name: /^Disconnect$/ }).click();
  await channelCard.getByText("Disconnected", { exact: true }).waitFor({ state: "visible" });
  steps.push("Channel status switched back to Disconnected.");

  await channelCard.locator("button").last().click();
  await page.getByText("Phase 6 Channel", { exact: true }).waitFor({ state: "hidden" });
  steps.push("Channel card removed after delete.");
  return steps;
}

async function runProviderFlow(page) {
  const steps = [];
  await openPage(page, "/providers");
  await page.getByRole("button", { name: /^New Provider$/ }).click();
  await page.getByLabel("Name").fill("Phase 6 Provider");
  await page.getByLabel("API Key").fill("sk-phase6-provider");
  await page.getByRole("button", { name: "Create Provider" }).click();
  const providerCard = cardByTitle(page, "Phase 6 Provider");
  await providerCard.getByText("Phase 6 Provider", { exact: true }).waitFor({ state: "visible" });
  steps.push("Created provider card visible: Phase 6 Provider.");

  await providerCard.getByRole("button", { name: /^Validate$/ }).click();
  await providerCard.getByText("Ready", { exact: true }).waitFor({ state: "visible" });
  steps.push("Provider validation switched status to Ready.");

  await providerCard.locator("button").last().click();
  await page.getByText("Phase 6 Provider", { exact: true }).waitFor({ state: "hidden" });
  steps.push("Provider card removed after delete.");
  return steps;
}

async function runCronFlow(page) {
  const steps = [];
  await openPage(page, "/cron");
  await page.getByRole("button", { name: /^New Job$/ }).click();
  await page.getByLabel("Name").fill("Phase 6 Cron");
  await page.getByLabel("Schedule").fill("0 * * * *");
  await page.getByLabel("Agent").selectOption({ label: "Seed Agent" });
  await page.getByLabel("Channel").selectOption({ label: "Seed Channel" });
  await page.getByLabel("Template").fill("Run a periodic phase 6 task.");
  await page.getByRole("button", { name: /^Create Job$/ }).click();
  const cronCard = cardByTitle(page, "Phase 6 Cron");
  await cronCard.getByText("Phase 6 Cron", { exact: true }).waitFor({ state: "visible" });
  steps.push("Created cron job card visible: Phase 6 Cron.");

  const switchControl = cronCard.getByRole("switch").first();
  await switchControl.click();
  await cronCard.getByText("Disabled", { exact: true }).waitFor({ state: "visible" });
  await switchControl.click();
  await cronCard.getByText("Idle", { exact: true }).waitFor({ state: "visible" });
  steps.push("Cron enable/disable toggle changed visible status.");

  await cronCard.getByRole("button", { name: /^Run Now$/ }).click();
  await cronCard.getByText("Success", { exact: true }).waitFor({ state: "visible" });
  steps.push("Immediate trigger updated visible status to Success and added history.");

  await cronCard.locator("button").last().click();
  await page.getByText("Phase 6 Cron", { exact: true }).waitFor({ state: "hidden" });
  steps.push("Cron card removed after delete.");
  return steps;
}

async function runSettingsFlow(page) {
  const steps = [];
  await openPage(page, "/settings");
  await page.getByLabel("Gateway polling interval (ms)").fill("9000");
  await page.getByLabel("Diagnostics directory").fill("C:\\Temp\\phase6-persisted");
  await page.getByRole("button", { name: /Save settings|Save/ }).click();
  await page.getByRole("button", { name: /Saved/ }).waitFor({ state: "visible" });
  steps.push("Saved app settings with gatewayPollMs=9000 and diagnosticsDir=C:\\Temp\\phase6-persisted.");

  await openPage(page, "/settings");
  const pollValue = await page.getByLabel("Gateway polling interval (ms)").inputValue();
  const dirValue = await page.getByLabel("Diagnostics directory").inputValue();
  steps.push(`After refresh, gatewayPollMs=${pollValue} and diagnosticsDir=${dirValue}.`);
  if (pollValue !== "9000" || dirValue !== "C:\\Temp\\phase6-persisted") {
    throw new Error(`Settings persistence mismatch: poll=${pollValue}, diagnosticsDir=${dirValue}`);
  }
  return steps;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.addInitScript(installMock, {
    stateKey: STATE_KEY,
    persistedKey: PERSISTED_KEY,
    gatewayAddress: GATEWAY_ADDRESS,
    defaultState: createInitialState(),
    persistedSettings: {
      sidebarCollapsed: false,
      theme: "system",
      language: "en",
      setupComplete: true,
    },
  });

  const results = [];
  const flows = [
    ["Agent", runAgentFlow],
    ["Channel", runChannelFlow],
    ["Provider", runProviderFlow],
    ["Cron", runCronFlow],
    ["Settings", runSettingsFlow],
  ];

  for (const [title, flow] of flows) {
    try {
      const steps = await flow(page);
      results.push(makeRow(title, "PASS", steps));
    } catch (error) {
      const routeMap = {
        Agent: "agents",
        Channel: "channels",
        Provider: "providers",
        Cron: "cron",
        Settings: "settings",
      };
      const route = routeMap[title] ?? title.toLowerCase();
      results.push(
        makeRow(
          title,
          "FAIL",
          [error instanceof Error ? error.message : String(error)],
          error instanceof Error ? error.message : String(error),
          [
            `Open ${BASE_URL} with the manual script loaded.`,
            `Navigate to /#/${route} and repeat the same UI sequence.`,
          ],
        ),
      );
    }
  }

  await browser.close();
  return results;
}

const results = await main();
await mkdir(path.dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, renderReport(results), "utf8");
console.log(renderReport(results));
