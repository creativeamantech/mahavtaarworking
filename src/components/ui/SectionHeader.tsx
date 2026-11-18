import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string | undefined;
  badge?: string | undefined;
  icon?: LucideIcon | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  icon: Icon,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-border/80",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {badge && (
            <span className="text-xs font-semibold text-primary whitespace-nowrap">
              · {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
}
