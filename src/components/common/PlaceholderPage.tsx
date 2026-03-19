export interface PlaceholderPageProps {
  title: string;
  description: string;
  hint?: string;
}

export function PlaceholderPage({ title, description, hint }: PlaceholderPageProps): JSX.Element {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        {hint ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </section>
  );
}
