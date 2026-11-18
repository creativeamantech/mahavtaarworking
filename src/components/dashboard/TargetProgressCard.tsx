import React from "react";
import { Target, Clock, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react";
import { fmtCur } from "@/lib/formatters";

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  percentage,
  size = 52,
  strokeWidth = 4.5,
  color,
  bgColor = "stroke-muted/60",
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;
  const defaultColor =
    clampedPct >= 80
      ? "stroke-emerald-500"
      : clampedPct >= 50
        ? "stroke-primary"
        : "stroke-rose-500";

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          className={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${color || defaultColor} transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (
          <span className="text-[11px] font-bold font-tabular tracking-tight">
            {Math.round(clampedPct)}%
          </span>
        )}
      </div>
    </div>
  );
}

interface TargetProgressCardProps {
  totalPOS: number;
  paidPOS: number;
  totalCollection: number;
  neededPOS: number;
  dailyRequiredPOS: number;
  targetPct?: number;
  remainingDays?: number;
}

export function TargetProgressCard({
  totalPOS,
  paidPOS,
  neededPOS,
  dailyRequiredPOS,
  targetPct = 85,
  remainingDays = 7,
}: TargetProgressCardProps) {
  const currentPct = totalPOS > 0 ? (paidPOS / totalPOS) * 100 : 0;
  const isTargetAchieved = neededPOS <= 0;
  const status = isTargetAchieved
    ? {
        text: "Target Achieved",
        textColor: "text-emerald-600 dark:text-emerald-400",
        Icon: CheckCircle2,
      }
    : currentPct >= targetPct * 0.7
      ? {
          text: "On Track",
          textColor: "text-primary",
          Icon: TrendingUp,
        }
      : {
          text: "Pacing Deficit",
          textColor: "text-rose-600 dark:text-rose-400",
          Icon: AlertCircle,
        };

  const StatusIcon = status.Icon;

  return (
    <div className="metric-kpi-card relative overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground block truncate">
              Target Velocity &amp; DRR
            </span>
            <div className={`flex items-center gap-1 mt-0.5 text-xs font-semibold ${status.textColor}`}>
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{status.text}</span>
            </div>
          </div>
        </div>

        <ProgressRing percentage={currentPct} size={48} strokeWidth={4}>
          <span className="text-[11px] font-bold font-tabular">{currentPct.toFixed(1)}%</span>
        </ProgressRing>
      </div>

      <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/70 bg-muted/25 -mx-4 px-4 my-1">
        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">
            Needed Recovery
          </span>
          <span className="text-sm font-bold font-tabular text-rose-600 dark:text-rose-400">
            {isTargetAchieved ? "₹0" : fmtCur(neededPOS)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-end gap-1">
            <Clock className="w-3 h-3 text-amber-500" /> Daily Run-Rate
          </span>
          <span className="text-sm font-bold font-tabular text-amber-600 dark:text-amber-400">
            {isTargetAchieved ? "Goal Met" : `${fmtCur(dailyRequiredPOS)}/d`}
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Target: <strong className="text-foreground font-tabular">{targetPct}%</strong> of POS
        </span>
        <span className="font-tabular font-medium">{remainingDays} days left</span>
      </div>
    </div>
  );
}
