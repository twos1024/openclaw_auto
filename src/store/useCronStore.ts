import { create } from "zustand";
import { cronService } from "@/services/cronService";
import type { BackendError } from "@/types/api";
import type {
  CreateCronJobPayload,
  CronJob,
  UpdateCronJobPayload,
} from "@/types";

interface CronStore {
  cronJobs: CronJob[];
  loading: boolean;
  saving: boolean;
  triggeringId: string | null;
  error: BackendError | null;
  lastFetchedAt: string | null;
  setCronJobs: (cronJobs: CronJob[]) => void;
  setError: (error: BackendError | null) => void;
  upsertCronJob: (cronJob: CronJob) => void;
  removeCronJob: (id: string) => void;
  fetchCronJobs: () => Promise<void>;
  createCronJob: (payload: CreateCronJobPayload) => Promise<boolean>;
  patchCronJob: (payload: UpdateCronJobPayload) => Promise<boolean>;
  toggleCronJob: (id: string, enabled: boolean) => Promise<boolean>;
  deleteCronJob: (id: string) => Promise<boolean>;
  triggerCronJob: (id: string) => Promise<boolean>;
}

export const useCronStore = create<CronStore>((set) => ({
  cronJobs: [],
  loading: false,
  saving: false,
  triggeringId: null,
  error: null,
  lastFetchedAt: null,
  setCronJobs: (cronJobs) => set({ cronJobs }),
  setError: (error) => set({ error }),
  upsertCronJob: (cronJob) =>
    set((state) => {
      const next = state.cronJobs.filter((item) => item.id !== cronJob.id);
      return { cronJobs: [cronJob, ...next] };
    }),
  removeCronJob: (id) =>
    set((state) => ({
      cronJobs: state.cronJobs.filter((cronJob) => cronJob.id !== id),
    })),
  fetchCronJobs: async () => {
    set({ loading: true, error: null });
    const result = await cronService.listCronJobs();
    if (result.ok && result.data) {
      set({
        cronJobs: result.data,
        loading: false,
        error: null,
        lastFetchedAt: new Date().toISOString(),
      });
      return;
    }
    set({
      loading: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to load cron jobs.",
        suggestion: "Check gateway status and retry.",
      },
    });
  },
  createCronJob: async (payload) => {
    set({ saving: true, error: null });
    const result = await cronService.createCronJob(payload);
    if (result.ok && result.data) {
      set((state) => ({
        cronJobs: [result.data!, ...state.cronJobs],
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to create cron job.",
        suggestion: "Check cron expression and retry.",
      },
    });
    return false;
  },
  patchCronJob: async (payload) => {
    set({ saving: true, error: null });
    const result = await cronService.updateCronJob(payload);
    if (result.ok && result.data) {
      set((state) => ({
        cronJobs: state.cronJobs.map((cronJob) =>
          cronJob.id === result.data!.id ? result.data! : cronJob,
        ),
        error: null,
        saving: false,
      }));
      return true;
    }
    set({
      saving: false,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to update cron job.",
        suggestion: "Review cron fields and retry.",
      },
    });
    return false;
  },
  toggleCronJob: async (id, enabled) => {
    const result = await cronService.updateCronJob({
      id,
      enabled,
      status: enabled ? "idle" : "disabled",
    });
    if (result.ok && result.data) {
      set((state) => ({
        cronJobs: state.cronJobs.map((cronJob) =>
          cronJob.id === id ? result.data! : cronJob,
        ),
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: `Failed to ${enabled ? "enable" : "disable"} cron job.`,
        suggestion: "Retry after checking gateway status.",
      },
    });
    return false;
  },
  deleteCronJob: async (id) => {
    const result = await cronService.deleteCronJob(id);
    if (result.ok) {
      set((state) => ({
        cronJobs: state.cronJobs.filter((cronJob) => cronJob.id !== id),
        error: null,
      }));
      return true;
    }
    set({
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to delete cron job.",
        suggestion: "Check references and retry.",
      },
    });
    return false;
  },
  triggerCronJob: async (id) => {
    set({ triggeringId: id, error: null });
    const result = await cronService.triggerCronJob(id);
    if (result.ok) {
      set((state) => ({
        cronJobs: state.cronJobs.map((job) =>
          job.id === id
            ? {
                ...job,
                status: "running",
              }
            : job,
        ),
        triggeringId: null,
        error: null,
      }));
      void cronService.listCronJobs().then((refreshResult) => {
        if (refreshResult.ok && refreshResult.data) {
          set({
            cronJobs: refreshResult.data,
            lastFetchedAt: new Date().toISOString(),
            error: null,
          });
        }
      });
      return true;
    }
    set({
      triggeringId: null,
      error: result.error ?? {
        code: "E_UNKNOWN",
        message: "Failed to trigger cron job.",
        suggestion: "Retry after checking gateway status.",
      },
    });
    return false;
  },
}));
