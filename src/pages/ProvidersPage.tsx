import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/useProviderStore";
import type { CreateProviderPayload, Provider, ProviderVendor, UpdateProviderPayload } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ProviderFormState {
  name: string;
  vendor: ProviderVendor;
  apiKey: string;
  baseUrl: string;
}

type ProviderDialogMode = "create" | "edit";

const VENDOR_OPTIONS: ProviderVendor[] = ["openai", "anthropic", "deepseek", "ollama", "google", "qwen", "zhipu", "moonshot", "groq", "mistral", "custom"];

const DEFAULT_FORM: ProviderFormState = {
  name: "",
  vendor: "openai",
  apiKey: "",
  baseUrl: "",
};

function buildProviderForm(provider: Provider | null): ProviderFormState {
  return {
    name: provider?.name ?? "",
    vendor: provider?.vendor ?? "openai",
    apiKey: "",
    baseUrl: provider?.baseUrl ?? "",
  };
}

function ProviderDialog({
  open,
  mode,
  provider,
  onClose,
}: {
  open: boolean;
  mode: ProviderDialogMode;
  provider: Provider | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("providers");
  const saving = useProviderStore((state) => state.saving);
  const createProvider = useProviderStore((state) => state.createProvider);
  const patchProvider = useProviderStore((state) => state.patchProvider);
  const [form, setForm] = useState<ProviderFormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM);
      setError(null);
      return;
    }
    setForm(buildProviderForm(provider));
    setError(null);
  }, [open, provider]);

  if (!open) return null;

  const updateForm = (patch: Partial<ProviderFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError(t("dialog.errors.nameRequired"));
      return;
    }
    if (mode === "create" && !form.apiKey.trim() && form.vendor !== "ollama") {
      setError(t("dialog.errors.apiKeyRequired"));
      return;
    }

    const payloadBase = {
      name: form.name.trim(),
      vendor: form.vendor,
      baseUrl: form.baseUrl.trim() || undefined,
    };

    if (mode === "create") {
      const payload: CreateProviderPayload = {
        ...payloadBase,
        apiKey: form.apiKey.trim(),
      };
      const created = await createProvider(payload);
      if (created) {
        onClose();
        return;
      }
    } else {
      if (!provider) {
        setError(t("dialog.errors.updateFailed"));
        return;
      }
      const payload: UpdateProviderPayload = {
        id: provider.id,
        ...payloadBase,
      };
      const apiKey = form.apiKey.trim();
      if (apiKey) {
        payload.apiKey = apiKey;
      }
      const updated = await patchProvider(payload);
      if (updated) {
        onClose();
        return;
      }
    }

    const latestError = useProviderStore.getState().error;
    setError(
      latestError?.message ??
        (mode === "create" ? t("dialog.errors.createFailed") : t("dialog.errors.updateFailed")),
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(560px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl">
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

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.vendor")}</span>
            <Select value={form.vendor} onChange={(event) => updateForm({ vendor: event.target.value as ProviderVendor })}>
              {VENDOR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`dialog.options.vendor.${option}`)}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.apiKey")}</span>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(event) => updateForm({ apiKey: event.target.value })}
              placeholder={
                mode === "edit"
                  ? t("dialog.placeholders.apiKeyEdit")
                  : form.vendor === "ollama"
                    ? t("dialog.placeholders.apiKeyOllama")
                    : t("dialog.placeholders.apiKey")
              }
            />
            {mode === "edit" ? <span className="text-xs text-muted-foreground">{t("dialog.hints.apiKeyOptional")}</span> : null}
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("dialog.fields.baseUrl")}</span>
            <Input
              value={form.baseUrl}
              onChange={(event) => updateForm({ baseUrl: event.target.value })}
              placeholder={t("dialog.placeholders.baseUrl")}
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
  const { t } = useTranslation("providers");
  if (status === "ready") return <Badge variant="success">{t("status.ready")}</Badge>;
  if (status === "checking") return <Badge variant="secondary">{t("status.checking")}</Badge>;
  if (status === "error") return <Badge variant="destructive">{t("status.error")}</Badge>;
  return <Badge variant="secondary">{t("status.disabled")}</Badge>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation("providers");
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

export function ProvidersPage(): JSX.Element {
  const { t, i18n } = useTranslation("providers");
  const providers = useProviderStore((state) => state.providers);
  const loading = useProviderStore((state) => state.loading);
  const error = useProviderStore((state) => state.error);
  const validatingId = useProviderStore((state) => state.validatingId);
  const fetchProviders = useProviderStore((state) => state.fetchProviders);
  const patchProvider = useProviderStore((state) => state.patchProvider);
  const deleteProvider = useProviderStore((state) => state.deleteProvider);
  const validateProvider = useProviderStore((state) => state.validateProvider);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<ProviderDialogMode>("create");
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  const readyCount = useMemo(() => providers.filter((provider) => provider.status === "ready").length, [providers]);
  const locale = i18n.language.startsWith("ja") ? "ja-JP" : i18n.language.startsWith("en") ? "en-US" : "zh-CN";
  const hasProviders = providers.length > 0;
  const showErrorState = Boolean(error) && !hasProviders && !loading;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProviders();
    } finally {
      setRefreshing(false);
    }
  };

  const handleValidate = async (id: string) => {
    await validateProvider(id);
  };

  const handleToggle = async (id: string, status: string) => {
    setActionId(id);
    const nextStatus = status === "disabled" ? "ready" : "disabled";
    await patchProvider({ id, status: nextStatus });
    setActionId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(t("actions.confirmDelete", { name }));
    if (!confirmed) return;
    setActionId(id);
    await deleteProvider(id);
    setActionId(null);
  };

  const openCreateDialog = () => {
    setEditingProvider(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEditDialog = (provider: Provider) => {
    setEditingProvider(provider);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProvider(null);
    setDialogMode("create");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-heading">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("page.description")} · {t("page.stats", { total: providers.length, ready: readyCount })}
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

      {error && hasProviders ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      {loading && providers.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">{t("actions.loading")}</div>
      ) : showErrorState ? (
        <ErrorState message={error?.message ?? t("error.title")} onRetry={() => void handleRefresh()} />
      ) : providers.length === 0 ? (
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
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
          {providers.map((provider) => {
            const isValidating = validatingId === provider.id;
            const actionLoading = actionId === provider.id;
            return (
              <Card key={provider.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{provider.name}</CardTitle>
                      <CardDescription className="mt-1">{t(`dialog.options.vendor.${provider.vendor}`)}</CardDescription>
                    </div>
                    <StatusLabel status={provider.status} />
                  </div>
                </CardHeader>

                <CardContent className="grid gap-3 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    {t("card.apiKey", { value: provider.apiKeyMasked ?? t("card.hidden") })}
                  </p>
                  <p className="text-muted-foreground">{t("card.baseUrl", { value: provider.baseUrl || t("card.default") })}</p>
                  <p className="text-muted-foreground">{t("card.modelCount", { value: provider.modelCount })}</p>
                  <p className="text-muted-foreground">{t("card.updatedAt", { value: new Date(provider.updatedAt).toLocaleString(locale) })}</p>

                  <div className="flex items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(provider)}
                      disabled={actionLoading}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      {t("actions.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleValidate(provider.id)}
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {t("actions.validate")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleToggle(provider.id, provider.status)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {provider.status === "disabled" ? t("actions.enable") : t("actions.disable")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDelete(provider.id, provider.name)}
                      disabled={actionLoading}
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

      <ProviderDialog open={dialogOpen} mode={dialogMode} provider={editingProvider} onClose={closeDialog} />
    </div>
  );
}
