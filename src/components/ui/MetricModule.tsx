import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricModuleProps {
  id?: string | undefined;
  title: string;
  value: string | number;
  subtitle?: string | undefined;
  icon?: LucideIcon | undefined;
  iconColor?: string | undefined;
  badge?:
    | {
        text: string;
        variant?: "success" | "warning" | "danger" | "info" | "neutral";
      }
    | undefined;
  trend?:
    | {
        value: string;
        isPositive?: boolean;
        label?: string;
      }
    | undefined;
  progress?:
    | {
        value: number;
        color?: string;
      }
    | undefined;
  footer?: ReactNode | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

export function MetricModule({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  badge,
  trend,
  progress,
  footer,
  onClick,
  className,
}: MetricModuleProps) {
  const statusTextColors = {
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
    info: "text-primary",
    neutral: "text-muted-foreground",
  };

  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        "metric-kpi-card",
        onClick ? "cursor-pointer hover:border-primary/40" : "",
        className,
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 min-w-0 truncate">
            {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />}
            <span className="truncate">{title}</span>
          </span>
          {badge && (
            <span
              className={cn(
                "text-[11px] font-semibold whitespace-nowrap shrink-0",
                statusTextColors[badge.variant || "neutral"],
              )}
            >
              {badge.text}
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 mt-1">
          <div className="text-2xl font-extrabold text-foreground tracking-tight font-tabular">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                "text-xs font-bold font-tabular flex items-center gap-0.5 shrink-0",
                trend.isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{subtitle}</p>
        )}
      </div>

      {progress && (
        <div className="mt-3">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                progress.color || "bg-primary",
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
            />
          </div>
        </div>
      )}

      {footer && (
        <div className="mt-3 pt-2.5 border-t border-border/70 text-xs text-muted-foreground flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}
