import { afterEach, describe, expect, it, vi } from "vitest";
import { useCronStore } from "../../src/store/useCronStore";
import type { CreateCronJobPayload, CronJob } from "../../src/types";

const mockListCronJobs = vi.hoisted(() => vi.fn());
const mockCreateCronJob = vi.hoisted(() => vi.fn());
const mockUpdateCronJob = vi.hoisted(() => vi.fn());
const mockDeleteCronJob = vi.hoisted(() => vi.fn());
const mockTriggerCronJob = vi.hoisted(() => vi.fn());

vi.mock("@/services/cronService", () => ({
  cronService: {
    listCronJobs: mockListCronJobs,
    createCronJob: mockCreateCronJob,
    updateCronJob: mockUpdateCronJob,
    deleteCronJob: mockDeleteCronJob,
    triggerCronJob: mockTriggerCronJob,
  },
}));

function makeCronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-1",
    name: "Morning Briefing",
    schedule: "0 9 * * 1-5",
    enabled: true,
    agentId: "agent-1",
    channelId: "channel-1",
    template: "Summarize today's work.",
    nextRunAt: "2026-03-20T09:00:00Z",
    lastRunAt: null,
    status: "idle",
    history: [],
    ...overrides,
  };
}

function resetStore(): void {
  useCronStore.setState({
    cronJobs: [],
    loading: false,
    saving: false,
    triggeringId: null,
    error: null,
    lastFetchedAt: null,
  });
}

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("useCronStore", () => {
  afterEach(() => {
    resetStore();
    mockListCronJobs.mockReset();
    mockCreateCronJob.mockReset();
    mockUpdateCronJob.mockReset();
    mockDeleteCronJob.mockReset();
    mockTriggerCronJob.mockReset();
  });

  it("clears stale errors after a successful fetch", async () => {
    const job = makeCronJob({ id: "job-2", status: "running" });
    useCronStore.setState({
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockListCronJobs.mockResolvedValue({
      ok: true,
      data: [job],
    });

    await useCronStore.getState().fetchCronJobs();

    const state = useCronStore.getState();
    expect(state.error).toBeNull();
    expect(state.cronJobs).toEqual([job]);
    expect(state.loading).toBe(false);
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("refreshes jobs after a successful trigger and clears stale errors", async () => {
    useCronStore.setState({
      cronJobs: [makeCronJob({ id: "job-1", status: "idle" })],
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockTriggerCronJob.mockResolvedValue({
      ok: true,
      data: {
        triggered: true,
        id: "job-1",
        detail: "Cron job triggered.",
      },
    });
    mockListCronJobs.mockResolvedValue({
      ok: true,
      data: [makeCronJob({ id: "job-1", status: "running" })],
    });

    const success = await useCronStore.getState().triggerCronJob("job-1");
    await flush();

    const state = useCronStore.getState();
    expect(success).toBe(true);
    expect(state.cronJobs[0]?.status).toBe("running");
    expect(state.error).toBeNull();
    expect(state.triggeringId).toBeNull();
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it("updates an existing cron job on patch and clears stale errors", async () => {
    useCronStore.setState({
      cronJobs: [makeCronJob({ id: "job-1", schedule: "0 9 * * 1-5" })],
      error: {
        code: "E_UNKNOWN",
        message: "stale error",
        suggestion: "retry",
      },
    });
    mockUpdateCronJob.mockResolvedValue({
      ok: true,
      data: makeCronJob({
        id: "job-1",
        schedule: "0 10 * * 1-5",
        enabled: false,
        status: "disabled",
      }),
    });

    const success = await useCronStore.getState().patchCronJob({
      id: "job-1",
      schedule: "0 10 * * 1-5",
      enabled: false,
      status: "disabled",
    });

    const state = useCronStore.getState();
    expect(success).toBe(true);
    expect(state.cronJobs[0]?.schedule).toBe("0 10 * * 1-5");
    expect(state.cronJobs[0]?.enabled).toBe(false);
    expect(state.error).toBeNull();
    expect(state.saving).toBe(false);
  });

  it("does not insert a fake cron job when creation fails", async () => {
    const existing = makeCronJob();
    useCronStore.setState({
      cronJobs: [existing],
    });
    mockCreateCronJob.mockResolvedValue({
      ok: false,
      error: {
        code: "E_CREATE_FAILED",
        message: "backend refused the payload",
        suggestion: "check cron fields",
      },
    });

    const payload: CreateCronJobPayload = {
      name: "Broken Job",
      schedule: "0 9 * * 1-5",
      agentId: "agent-1",
      channelId: "channel-1",
      template: "Summarize",
      enabled: true,
    };

    const success = await useCronStore.getState().createCronJob(payload);

    const state = useCronStore.getState();
    expect(success).toBe(false);
    expect(state.cronJobs).toEqual([existing]);
    expect(state.error?.code).toBe("E_CREATE_FAILED");
    expect(state.saving).toBe(false);
  });
});
