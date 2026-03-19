export type CronJobStatus = "idle" | "running" | "success" | "error" | "disabled";

export interface CronExecution {
  id: string;
  startedAt: string;
  durationMs?: number;
  status: Exclude<CronJobStatus, "idle" | "disabled">;
  summary?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  agentId: string;
  channelId: string;
  template: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  status: CronJobStatus;
  history: CronExecution[];
}

export interface CreateCronJobPayload {
  name: string;
  schedule: string;
  agentId: string;
  channelId: string;
  template: string;
  enabled?: boolean;
}

export interface UpdateCronJobPayload extends Partial<CreateCronJobPayload> {
  id: string;
  status?: CronJobStatus;
}
