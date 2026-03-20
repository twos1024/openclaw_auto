import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Link2, Pencil, Plus, Radio, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/store/useAgentStore";
import { useChannelStore } from "@/store/useChannelStore";
import { useProviderStore } from "@/store/useProviderStore";
import type { Channel, ChannelType, ConnectionType, CreateChannelPayload, UpdateChannelPayload } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ChannelFormState {
  name: string;
  type: ChannelType;
  connectionType: ConnectionType;
  description: string;
  providerId: string;
  agentIds: string[];
}

const CHANNEL_TYPE_OPTIONS: ChannelType[] = ["openclaw", "openai-compatible", "custom", "webhook"];
const CONNECTION_OPTIONS: ConnectionType[] = ["none", "api-key", "oauth"];

const DEFAULT_FORM: ChannelFormState = {
  name: "",
  type: "openclaw",
  connectionType: "none",
  description: "",
  providerId: "",
  agentIds: [],
};

type ChannelDialogMode = "create" | "edit";

function buildChannelForm(channel: Channel | null): ChannelFormState {
  return {
    name: channel?.name ?? "",
    type: channel?.type ?? "openclaw",
    connectionType: channel?.connectionType ?? "none",
    description: channel?.description ?? "",
    providerId: channel?.providerId ?? "",
    agentIds: channel?.agentIds ?? [],
  };
}

function ChannelDialog({
  open,
  mode,
  channel,
  onClose,
}: {
  open: boolean;
  mode: ChannelDialogMode;
  channel: Channel | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("channels");
  const agents = useAgentStore((state) => state.agents);
  const providers = useProviderStore((state) => state.providers);
  const saving = useChannelStore((state) => state.saving);
  const createChannel = useChannelStore((state) => state.createChannel);
  const patchChannel = useChannelStore((state) => state.patchChannel);
  const [form, setForm] = useState<ChannelFormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM);
      setError(null);
      return;
    }
    setForm(buildChannelForm(channel));
    setError(null);
  }, [open, channel]);

  if (!open) return null;

  const updateForm = (patch: Partial<ChannelFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const toggleAgent = (id: string) => {
    setForm((current) => ({
      ...current,
      agentIds: current.agentIds.includes(id)
        ? current.agentIds.filter((item) => item !== id)
        : [...current.agentIds, id],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError(t("dialog.errors.nameRequired"));
      return;
    }

    const payloadBase = {
      name: form.name.trim(),
      type: form.type,
      connectionType: form.connectionType,
      description: form.description.trim() || undefined,
    };

    if (mode === "create") {
      const payload: CreateChannelPayload = {
        ...payloadBase,
        providerId: form.providerId || undefined,
        agentIds: form.agentIds.length > 0 ? form.agentIds : undefined,
      };
      const created = await createChannel(payload);
      if (created) {
        onClose();
        return;
      }
    } else {
      if (!channel) {
        setError(t("dialog.errors.updateFailed"));
        return;
      }
      const payload: UpdateChannelPayload = {
        id: channel.id,
        ...payloadBase,
        providerId: form.providerId ? form.providerId : (null as unknown as string),
        agentIds: form.agentIds,
      };
      const updated = await patchChannel(payload);
      if (updated) {
        onClose();
        return;
      }
    }

    const latestError = useChannelStore.getState().error;
    setError(
      latestError?.message ??
        (mode === "create" ? t("dialog.errors.createFailed") : t("dialog.errors.updateFailed")),
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(620px,95vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{mode === "create" ? t("dialog.titleCreate") : t("dialog.titleEdit")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "create" ? t("dialog.descriptionCreate") : t("dialog.descriptionEdit")}
          </p>
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

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("dialog.fields.type")}</span>
              <Select value={form.type} onChange={(event) => updateForm({ type: event.target.value as ChannelType })}>
                {CHANNEL_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`dialog.options.type.${option}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("dialog.fields.connectionType")}</span>
              <Select
                value={form.connectionType}
                onChange={(event) => updateForm({ connectionType: event.target.value as ConnectionType })}
              >
                {CONNECTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`dialog.options.connection.${option}`)}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.provider")}</span>
            <Select value={form.providerId} onChange={(event) => updateForm({ providerId: event.target.value })}>
              <option value="">{t("dialog.options.noProvider")}</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.agents")}</span>
            {agents.length > 0 ? (
              <div className="grid max-h-40 gap-2 overflow-auto rounded-lg border border-border p-2">
                {agents.map((agent) => {
                  const checked = form.agentIds.includes(agent.id);
                  return (
                    <label
                      key={agent.id}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-2.5 py-2 text-sm",
                        checked ? "border-primary bg-primary/5" : "border-border bg-background",
                      )}
                    >
                      <span className="truncate">{agent.displayName}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => toggleAgent(agent.id)}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {t("dialog.hints.noAgents")}
              </p>
            )}
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.description")}</span>
            <Textarea
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              placeholder={t("dialog.placeholders.description")}
              rows={4}
            />
          </label>
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
                {mode === "create" ? t("dialog.actions.creating") : t("dialog.actions.updating")}
              </>
            ) : (
              mode === "create" ? t("dialog.actions.create") : t("dialog.actions.update")
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function StatusLabel({ status }: { status: string }) {
  const { t } = useTranslation("channels");
  if (status === "connected") return <Badge variant="success">{t("status.connected")}</Badge>;
  if (status === "error") return <Badge variant="destructive">{t("status.error")}</Badge>;
  if (status === "idle") return <Badge variant="secondary">{t("status.idle")}</Badge>;
  return <Badge variant="secondary">{t("status.disconnected")}</Badge>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation("channels");
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <CardTitle className="text-base">{t("error.title")}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button variant="outline" onClick={onRetry}>
          {t("error.cta")}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ChannelsPage(): JSX.Element {
  const { t, i18n } = useTranslation("channels");
  const channels = useChannelStore((state) => state.channels);
  const loading = useChannelStore((state) => state.loading);
  const error = useChannelStore((state) => state.error);
  const fetchChannels = useChannelStore((state) => state.fetchChannels);
  const patchChannel = useChannelStore((state) => state.patchChannel);
  const deleteChannel = useChannelStore((state) => state.deleteChannel);

  const providers = useProviderStore((state) => state.providers);
  const fetchProviders = useProviderStore((state) => state.fetchProviders);

  const agentsLoaded = useAgentStore((state) => state.agentsLoaded);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<ChannelDialogMode>("create");
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const hasChannels = channels.length > 0;
  const showErrorState = Boolean(error) && !hasChannels && !loading;

  useEffect(() => {
    void fetchChannels();
    const timer = window.setInterval(() => {
      void fetchChannels();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchChannels]);

  useEffect(() => {
    if (providers.length === 0) {
      void fetchProviders();
    }
  }, [fetchProviders, providers.length]);

  useEffect(() => {
    if (!agentsLoaded) {
      void fetchAgents();
    }
  }, [agentsLoaded, fetchAgents]);

  const providerMap = useMemo(
    () => Object.fromEntries(providers.map((provider) => [provider.id, provider.name])),
    [providers],
  );
  const locale = i18n.language.startsWith("ja") ? "ja-JP" : i18n.language.startsWith("en") ? "en-US" : "zh-CN";
  const connectedCount = channels.filter((channel) => channel.status === "connected").length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchChannels();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleConnection = async (id: string, currentStatus: string) => {
    setActionId(id);
    const nextStatus = currentStatus === "connected" ? "disconnected" : "connected";
    await patchChannel({ id, status: nextStatus });
    setActionId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(t("actions.confirmDelete", { name }));
    if (!confirmed) return;
    setActionId(id);
    await deleteChannel(id);
    setActionId(null);
  };

  const openCreateDialog = () => {
    setEditingChannel(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEditDialog = (channel: Channel) => {
    setEditingChannel(channel);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingChannel(null);
    setDialogMode("create");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-heading">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("page.description")} · {t("page.stats", { total: channels.length, connected: connectedCount })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void handleRefresh()} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("actions.create")}
        </Button>
      </div>

      {error && hasChannels ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      {loading && channels.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">{t("actions.loading")}</div>
      ) : showErrorState ? (
        <ErrorState message={error?.message ?? t("error.title")} onRetry={() => void handleRefresh()} />
      ) : channels.length === 0 ? (
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
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {channels.map((channel) => {
            const providerName = channel.providerId ? providerMap[channel.providerId] ?? channel.providerId : t("card.noProvider");
            return (
              <Card key={channel.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{channel.name}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Radio className="h-3.5 w-3.5" />
                        {t(`dialog.options.type.${channel.type}`)}
                      </CardDescription>
                    </div>
                    <StatusLabel status={channel.status} />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="grid gap-1.5 text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5" />
                      {t("card.connectionType", { value: t(`dialog.options.connection.${channel.connectionType}`) })}
                    </p>
                    <p>{t("card.provider", { value: providerName })}</p>
                    <p>{t("card.boundAgents", { count: channel.agentIds.length })}</p>
                    <p>{t("card.updatedAt", { value: new Date(channel.updatedAt).toLocaleString(locale) })}</p>
                  </div>
                  {channel.description ? (
                    <p className="line-clamp-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                      {channel.description}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(channel)}
                      disabled={actionId === channel.id}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      {t("actions.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleToggleConnection(channel.id, channel.status)}
                      disabled={actionId === channel.id}
                    >
                      {actionId === channel.id ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      {channel.status === "connected" ? t("actions.disconnect") : t("actions.connect")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDelete(channel.id, channel.name)}
                      disabled={actionId === channel.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ChannelDialog open={dialogOpen} mode={dialogMode} channel={editingChannel} onClose={closeDialog} />
    </div>
  );
}
