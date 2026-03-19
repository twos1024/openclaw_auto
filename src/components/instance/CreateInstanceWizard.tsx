import { useState } from "react";
import { X, Check } from "lucide-react";
import { invokeCommand } from "@/services/tauriClient";
import { useAppStore, type InstanceRecord } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardForm {
  displayName: string;
  systemPrompt: string;
  modelId: string;
  modelName: string;
  channelType: string;
  apiKeyRef: string;
  baseUrl: string;
  temperature: number;
}

const MODELS = [
  { id: "gpt-4o",             name: "GPT-4o" },
  { id: "gpt-4o-mini",        name: "GPT-4o Mini" },
  { id: "gpt-4-turbo",        name: "GPT-4 Turbo" },
  { id: "claude-opus-4-6",    name: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6",  name: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5",   name: "Claude Haiku 4.5" },
  { id: "deepseek-chat",      name: "DeepSeek Chat" },
  { id: "qwen-max-latest",    name: "Qwen Max" },
  { id: "custom",             name: "自定义..." },
];

const CHANNELS = [
  { id: "apimart",          label: "APIMart",         desc: "通过 APIMart 统一接入多模型" },
  { id: "openai-compatible", label: "OpenAI 兼容",    desc: "兼容 OpenAI 接口的任意服务" },
  { id: "custom",            label: "完全自定义",      desc: "自定义 API 端点和认证" },
];

const PROMPT_TEMPLATES = [
  { label: "通用助手", value: "你是一个友好、专业的 AI 助手，能够帮助用户完成各种任务。" },
  { label: "代码助手", value: "你是一名经验丰富的软件工程师，擅长代码审查、调试和架构设计。请用简洁、专业的语言回答技术问题。" },
  { label: "翻译专家", value: "你是一名专业翻译，精通中英日三种语言。请准确、流畅地翻译用户提供的内容，保持原文的风格和语气。" },
  { label: "客服助手", value: "你是一名友善、耐心的客服助手。请礼貌地回应用户问题，并尽力帮助解决他们的问题。" },
];

const STEPS = ["名称", "身份", "模型", "渠道"];

const DEFAULT: WizardForm = {
  displayName: "", systemPrompt: "", modelId: "gpt-4o", modelName: "GPT-4o",
  channelType: "apimart", apiKeyRef: "", baseUrl: "https://api.apimart.io/v1", temperature: 0.7,
};

// ─── Step bar ─────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className={cn("flex items-center", i < STEPS.length - 1 ? "flex-1" : "")}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-foreground text-background" :
                "bg-muted text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn("text-[11px] whitespace-nowrap", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-1 mb-4", done ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ form, onChange }: { form: WizardForm; onChange: (p: Partial<WizardForm>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">为你的 AI 机器人取一个名字，留空则自动生成。</p>
      <Input
        autoFocus
        placeholder="如：翻译助手、代码顾问..."
        value={form.displayName}
        onChange={(e) => onChange({ displayName: e.target.value })}
      />
    </div>
  );
}

function Step2({ form, onChange }: { form: WizardForm; onChange: (p: Partial<WizardForm>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">定义机器人的角色和行为准则（System Prompt）。</p>
      <div className="flex flex-wrap gap-2">
        {PROMPT_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onChange({ systemPrompt: t.value })}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            {t.label}
          </button>
        ))}
      </div>
      <Textarea
        placeholder="输入 System Prompt..."
        value={form.systemPrompt}
        onChange={(e) => onChange({ systemPrompt: e.target.value })}
        rows={7}
        className="text-sm leading-relaxed"
      />
    </div>
  );
}

function Step3({ form, onChange }: { form: WizardForm; onChange: (p: Partial<WizardForm>) => void }) {
  const builtinIds = MODELS.slice(0, -1).map((m) => m.id);
  const isCustom = !builtinIds.includes(form.modelId) || form.modelId === "custom";

  // Pre-populate from existing form value when re-mounting after step navigation
  const [customModelId, setCustomModelId] = useState(() =>
    isCustom && form.modelId !== "custom" ? form.modelId : "",
  );
  const [customModelName, setCustomModelName] = useState(() =>
    isCustom && form.modelName !== "自定义模型" ? form.modelName : "",
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">选择底层语言模型。</p>
      {MODELS.map((m) => {
        const selected = m.id === "custom" ? isCustom : form.modelId === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (m.id === "custom") onChange({ modelId: customModelId || "custom", modelName: customModelName || customModelId || "自定义模型" });
              else onChange({ modelId: m.id, modelName: m.name });
            }}
            className={cn(
              "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm text-left transition-colors border",
              selected
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-background hover:bg-muted/40 text-foreground/80",
            )}
          >
            <span className={cn(
              "h-4 w-4 rounded-full border-2 shrink-0",
              selected ? "border-primary bg-primary scale-110" : "border-muted-foreground/30",
            )} />
            <span className={cn("font-medium", selected && "text-foreground")}>{m.name}</span>
          </button>
        );
      })}
      {isCustom && (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="模型 ID，如 qwen-max-latest"
            value={customModelId}
            onChange={(e) => {
              setCustomModelId(e.target.value);
              onChange({ modelId: e.target.value || "custom", modelName: customModelName || e.target.value || "自定义模型" });
            }}
          />
          <Input
            placeholder="显示名称（可选）"
            value={customModelName}
            onChange={(e) => {
              setCustomModelName(e.target.value);
              onChange({ modelName: e.target.value || customModelId || "自定义模型" });
            }}
          />
        </div>
      )}
      <div className="pt-2">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Temperature: {form.temperature.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">越高越有创意</span>
        </label>
        <input
          type="range" min={0} max={2} step={0.1}
          value={form.temperature}
          onChange={(e) => onChange({ temperature: Number(e.target.value) })}
          className="w-full mt-2"
        />
      </div>
    </div>
  );
}

function Step4({ form, onChange }: { form: WizardForm; onChange: (p: Partial<WizardForm>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">配置 API 渠道和认证信息。</p>
      {CHANNELS.map((c) => {
        const selected = form.channelType === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              const url = c.id === "apimart" ? "https://api.apimart.io/v1" : "";
              onChange({ channelType: c.id, baseUrl: url });
            }}
            className={cn(
              "flex items-start gap-3 w-full rounded-xl px-3 py-3 text-left transition-colors border",
              selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40",
            )}
          >
            <span className={cn("mt-0.5 h-4 w-4 rounded-full border-2 shrink-0", selected ? "border-primary bg-primary" : "border-muted-foreground/30")} />
            <div>
              <p className={cn("text-sm font-medium", selected ? "text-foreground" : "text-foreground/80")}>{c.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
            </div>
          </button>
        );
      })}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">API Key</span>
        <Input
          type="password"
          placeholder="sk-..."
          value={form.apiKeyRef}
          onChange={(e) => onChange({ apiKeyRef: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">API 端点</span>
        <Input
          placeholder="https://api.openai.com/v1"
          value={form.baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
        />
      </label>
    </div>
  );
}

// ─── Wizard dialog ────────────────────────────────────────────────────────────

export function CreateInstanceWizard({ onClose }: { onClose: () => void }): JSX.Element {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addInstance = useAppStore((s) => s.addInstance);

  const onChange = (patch: Partial<WizardForm>) => setForm((f) => ({ ...f, ...patch }));

  const canFinish = form.apiKeyRef.trim().length > 0;
  const isLast = step === STEPS.length - 1;

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await invokeCommand<InstanceRecord>("create_instance", {
        displayName: form.displayName || `实例-${Date.now()}`,
        systemPrompt: form.systemPrompt,
        modelId: form.modelId,
        modelName: form.modelName,
        channelType: form.channelType,
        apiKeyRef: form.apiKeyRef,
        baseUrl: form.baseUrl,
        temperature: form.temperature,
        maxTokens: 4096,
      });
      if (result.success && result.data) {
        addInstance(result.data);
        onClose();
      } else {
        setError(result.error?.message ?? "创建失败，请重试。");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(560px,95vw)] max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl">
        <div className="p-6 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">新建实例</h2>
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <StepBar current={step} />

          {/* Content */}
          <div className="min-h-[260px]">
            {step === 0 && <Step1 form={form} onChange={onChange} />}
            {step === 1 && <Step2 form={form} onChange={onChange} />}
            {step === 2 && <Step3 form={form} onChange={onChange} />}
            {step === 3 && <Step4 form={form} onChange={onChange} />}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            >
              {step === 0 ? "取消" : "上一步"}
            </Button>
            <Button
              onClick={isLast ? () => void handleCreate() : () => setStep((s) => s + 1)}
              disabled={(isLast && !canFinish) || saving}
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
              ) : null}
              {saving ? "创建中..." : isLast ? "完成创建" : "下一步"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
