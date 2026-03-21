import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "destructive" | "success";

const variants: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  secondary: "bg-secondary text-secondary-foreground border-transparent",
  outline: "border-border text-foreground",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  success: "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "secondary", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
