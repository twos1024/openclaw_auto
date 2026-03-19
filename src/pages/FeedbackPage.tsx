import { useState } from "react";
import { MessageCircle, Mail, Github, Heart, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function FeedbackPage(): JSX.Element {
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const isEmpty = !text.trim();

  const handleSubmit = async () => {
    setTouched(true);
    if (isEmpty) return;
    setSubmitting(true);
    // Simulate submission — replace with real API call when endpoint is available
    await new Promise<void>((r) => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1
          className="page-heading"
        >
          反馈
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          告诉我们你遇到的问题或改进建议
        </p>
      </div>

      {/* Feedback form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <CardTitle>提交反馈</CardTitle>
          </div>
          <CardDescription>描述你遇到的问题、功能请求或任何建议</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">感谢你的反馈！</p>
                <p className="text-sm text-muted-foreground mt-1">我们会认真阅读每一条反馈并持续改进产品。</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setText(""); setEmail(""); }}>
                再次反馈
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Textarea
                  placeholder="描述你的问题或建议..."
                  value={text}
                  onChange={(e) => { setText(e.target.value); if (touched) setTouched(false); }}
                  className={cn("min-h-[120px]", touched && isEmpty && "border-destructive focus-visible:ring-destructive")}
                />
                {touched && isEmpty && (
                  <p className="text-xs text-destructive">请填写反馈内容后再提交</p>
                )}
              </div>
              <Input
                type="email"
                placeholder="联系邮箱（可选）"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {submitting ? "提交中..." : "提交反馈"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact channels */}
      <Card>
        <CardHeader>
          <CardTitle>联系方式</CardTitle>
          <CardDescription>其他联系渠道</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: Mail, label: "邮件支持", value: "support@apimart.io", href: "mailto:support@apimart.io" },
            { icon: Github, label: "GitHub Issues", value: "github.com/openclaw", href: "https://github.com" },
          ].map(({ icon: Icon, label, value, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{value}</p>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>

      {/* Thanks */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Heart className="h-3.5 w-3.5 text-red-500" fill="currentColor" />
        <span>感谢使用 OpenClaw Manager，你的反馈让产品更好。</span>
      </div>
    </div>
  );
}
