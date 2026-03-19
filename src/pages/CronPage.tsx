import { useEffect, useMemo, useState } from "react";
import { Clock3, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";
import { useChannelStore } from "@/store/useChannelStore";
import { useCronStore } from "@/store/useCronStore";
import type { CreateCronJobPayload } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface CronFormState {
  name: string;
  schedule: string;
  agentId: string;
  channelId: string;
  template: string;
  enabled: boolean;
}

const buildDefaultCronForm = (defaultSchedule: string): CronFormState => ({
  name: "",
  schedule: defaultSchedule,
  agentId: "",
  channelId: "",
  template: "",
  enabled: true,
});

function CreateCronDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("cron");
  const agents = useAgentStore((state) => state.agents);
  const channels = useChannelStore((state) => state.channels);
  const saving = useCronStore((state) => state.saving);
  const createCronJob = useCronStore((state) => state.createCronJob);
  const [form, setForm] = useState<CronFormState>(() => buildDefaultCronForm(t("dialog.defaults.schedule")));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(buildDefaultCronForm(t("dialog.defaults.schedule")));
      setError(null);
      return;
    }
    if (agents.length > 0 && !form.agentId) {
      setForm((current) => ({ ...current, agentId: agents[0].id }));
    }
    if (channels.length > 0 && !form.channelId) {
      setForm((current) => ({ ...current, channelId: channels[0].id }));
    }
  }, [agents, channels, form.agentId, form.channelId, open, t]);

  if (!open) return null;

  const updateForm = (patch: Partial<CronFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError(t("dialog.errors.nameRequired"));
      return;
    }
    if (!form.schedule.trim()) {
      setError(t("dialog.errors.scheduleRequired"));
      return;
    }
    if (!form.agentId) {
      setError(t("dialog.errors.agentRequired"));
      return;
    }
    if (!form.channelId) {
      setError(t("dialog.errors.channelRequired"));
      return;
    }

    const payload: CreateCronJobPayload = {
      name: form.name.trim(),
      schedule: form.schedule.trim(),
      agentId: form.agentId,
      channelId: form.channelId,
      template: form.template.trim(),
      enabled: form.enabled,
    };

    const created = await createCronJob(payload);
    if (created) {
      onClose();
      return;
    }

    const latestError = useCronStore.getState().error;
    setError(latestError?.message ?? t("dialog.errors.createFailed"));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(620px,95vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t("dialog.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("dialog.description")}</p>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.name")}</span>
            <Input
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder={t("dialog.placeholders.name")}
              autoFocus
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.schedule")}</span>
            <Input
              value={form.schedule}
              onChange={(event) => updateForm({ schedule: event.target.value })}
              placeholder={t("dialog.placeholders.schedule")}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("dialog.fields.agent")}</span>
              <Select value={form.agentId} onChange={(event) => updateForm({ agentId: event.target.value })}>
                <option value="">{t("dialog.placeholders.agent")}</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.displayName}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("dialog.fields.channel")}</span>
              <Select value={form.channelId} onChange={(event) => updateForm({ channelId: event.target.value })}>
                <option value="">{t("dialog.placeholders.channel")}</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.template")}</span>
            <Textarea
              rows={5}
              value={form.template}
              onChange={(event) => updateForm({ template: event.target.value })}
              placeholder={t("dialog.placeholders.template")}
            />
          </label>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{t("dialog.fields.enabled")}</p>
              <p className="text-xs text-muted-foreground">{t("dialog.hints.enabled")}</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(value) => updateForm({ enabled: value })} />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            {t("dialog.actions.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t("dialog.actions.creating")}
              </>
            ) : (
              t("dialog.actions.create")
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("cron");
  if (status === "success") return <Badge variant="success">{t("status.success")}</Badge>;
  if (status === "error") return <Badge variant="destructive">{t("status.failed")}</Badge>;
  if (status === "running") return <Badge variant="secondary">{t("status.running")}</Badge>;
  if (status === "disabled") return <Badge variant="secondary">{t("status.disabled")}</Badge>;
  return <Badge variant="secondary">{t("status.idle")}</Badge>;
}

export function CronPage(): JSX.Element {
  const { t, i18n } = useTranslation("cron");
  const cronJobs = useCronStore((state) => state.cronJobs);
  const loading = useCronStore((state) => state.loading);
  const error = useCronStore((state) => state.error);
  const triggeringId = useCronStore((state) => state.triggeringId);
  const fetchCronJobs = useCronStore((state) => state.fetchCronJobs);
  const toggleCronJob = useCronStore((state) => state.toggleCronJob);
  const deleteCronJob = useCronStore((state) => state.deleteCronJob);
  const triggerCronJob = useCronStore((state) => state.triggerCronJob);

  const channels = useChannelStore((state) => state.channels);
  const fetchChannels = useChannelStore((state) => state.fetchChannels);

  const agents = useAgentStore((state) => state.agents);
  const agentsLoaded = useAgentStore((state) => state.agentsLoaded);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void fetchCronJobs();
    const timer = window.setInterval(() => {
      void fetchCronJobs();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [fetchCronJobs]);

  useEffect(() => {
    if (channels.length === 0) {
      void fetchChannels();
    }
  }, [channels.length, fetchChannels]);

  useEffect(() => {
    if (!agentsLoaded) {
      void fetchAgents();
    }
  }, [agentsLoaded, fetchAgents]);

  const channelMap = useMemo(() => Object.fromEntries(channels.map((channel) => [channel.id, channel.name])), [channels]);
  const agentMap = useMemo(() => Object.fromEntries(agents.map((agent) => [agent.id, agent.displayName])), [agents]);
  const locale = i18n.language.startsWith("ja") ? "ja-JP" : i18n.language.startsWith("en") ? "en-US" : "zh-CN";
  const enabledCount = useMemo(() => cronJobs.filter((job) => job.enabled).length, [cronJobs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCronJobs();
    setRefreshing(false);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setActionId(id);
    await toggleCronJob(id, enabled);
    setActionId(null);
  };

  const handleTrigger = async (id: string) => {
    await triggerCronJob(id);
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(t("actions.confirmDelete", { name }));
    if (!confirmed) return;
    setActionId(id);
    await deleteCronJob(id);
    setActionId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-heading">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("page.description")} · {t("page.stats", { total: cronJobs.length, enabled: enabledCount })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void handleRefresh()} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.create")}
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      {loading && cronJobs.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">{t("actions.loading")}</div>
      ) : cronJobs.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t("empty.title")}</CardTitle>
            <CardDescription>{t("empty.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("empty.cta")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cronJobs.map((job) => {
            const expanded = expandedId === job.id;
            const actionLoading = actionId === job.id;
            const isTriggering = triggeringId === job.id;
            return (
              <Card key={job.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{job.name}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        {job.schedule}
                      </CardDescription>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                </CardHeader>

                <CardContent className="grid gap-3">
                  <div className="grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                    <p>{t("card.agent", { value: agentMap[job.agentId] ?? job.agentId })}</p>
                    <p>{t("card.channel", { value: channelMap[job.channelId] ?? job.channelId })}</p>
                    <p>{t("card.nextRun", { value: job.nextRunAt ? new Date(job.nextRunAt).toLocaleString(locale) : t("card.notCalculated") })}</p>
                    <p>{t("card.lastRun", { value: job.lastRunAt ? new Date(job.lastRunAt).toLocaleString(locale) : t("card.none") })}</p>
                  </div>

                  <p className="line-clamp-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                    {job.template || t("card.noTemplate")}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <div className="mr-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                      <span>{t("card.enabled")}</span>
                      <Switch checked={job.enabled} onCheckedChange={(value) => void handleToggle(job.id, value)} disabled={actionLoading} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleTrigger(job.id)} disabled={isTriggering}>
                      {isTriggering ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                      {t("actions.trigger")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setExpandedId(expanded ? null : job.id)}>
                      {expanded ? t("actions.hideHistory") : t("actions.viewHistory")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDelete(job.id, job.name)}
                      disabled={actionLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {expanded ? (
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      {job.history.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("card.noHistory")}</p>
                      ) : (
                        <div className="grid gap-2">
                          {job.history.map((execution) => (
                            <div key={execution.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span>{new Date(execution.startedAt).toLocaleString(locale)}</span>
                                <Badge
                                  variant={
                                    execution.status === "success"
                                      ? "success"
                                      : execution.status === "error"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {t(`status.${execution.status}`)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">
                                {t("card.duration", { value: execution.durationMs ? `${execution.durationMs} ms` : t("card.notAvailable") })} ·{" "}
                                {execution.summary || t("card.noSummary")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateCronDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
