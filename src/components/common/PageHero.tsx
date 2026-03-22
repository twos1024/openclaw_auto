import type { ReactNode } from "react";

export interface PageHeroProps {
  title: string;
  description: string;
  meta?: string;
  action?: ReactNode;
}

export function PageHero({ title, description, meta, action }: PageHeroProps): JSX.Element {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-2">
        <h2 className="m-0 text-xl font-semibold text-foreground">{title}</h2>
        <p className="m-0 max-w-[860px] text-muted-foreground">{description}</p>
        {meta ? <p className="m-0 text-[13px] text-muted-foreground/70">{meta}</p> : null}
      </div>
      {action}
    </header>
  );
}
