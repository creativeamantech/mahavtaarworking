import React from "react";
import { Layers, AlertCircle, CheckCircle2, TrendingUp, Users, UserX } from "lucide-react";

export type QuickSegmentKey =
  | "all"
  | "unpaid"
  | "paid"
  | "high_pos"
  | "multi_case"
  | "unallocated";

interface QuickSegmentBarProps {
  activeSegment: QuickSegmentKey;
  onSelectSegment: (segment: QuickSegmentKey) => void;
  counts: {
    all: number;
    unpaid: number;
    paid: number;
    highPos: number;
    multiCase: number;
    unallocated: number;
  };
}

export function QuickSegmentBar({
  activeSegment,
  onSelectSegment,
  counts,
}: QuickSegmentBarProps) {
  const segments: {
    key: QuickSegmentKey;
    label: string;
    count: number;
    icon: React.ElementType;
    activeClass: string;
  }[] = [
    {
      key: "all",
      label: "All Portfolio",
      count: counts.all,
      icon: Layers,
      activeClass: "bg-primary text-primary-foreground border-primary",
    },
    {
      key: "unpaid",
      label: "Unpaid Pending",
      count: counts.unpaid,
      icon: AlertCircle,
      activeClass: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/35",
    },
    {
      key: "paid",
      label: "Cleared / Paid",
      count: counts.paid,
      icon: CheckCircle2,
      activeClass:
        "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/35",
    },
    {
      key: "high_pos",
      label: "High POS (> ₹1L)",
      count: counts.highPos,
      icon: TrendingUp,
      activeClass: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/35",
    },
    {
      key: "multi_case",
      label: "Multi-Case Borrowers",
      count: counts.multiCase,
      icon: Users,
      activeClass: "bg-primary/12 text-primary border-primary/35",
    },
    {
      key: "unallocated",
      label: "Unassigned Cases",
      count: counts.unallocated,
      icon: UserX,
      activeClass: "bg-[#81258c]/12 text-[#81258c] dark:text-purple-300 border-[#81258c]/35",
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
      {segments.map((s) => {
        const Icon = s.icon;
        const isActive = activeSegment === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelectSegment(isActive && s.key !== "all" ? "all" : s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 cursor-pointer whitespace-nowrap ${
              isActive
                ? s.activeClass
                : "bg-card border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{s.label}</span>
            <span className="font-mono text-[11px] opacity-80 tabular-nums">
              · {s.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
