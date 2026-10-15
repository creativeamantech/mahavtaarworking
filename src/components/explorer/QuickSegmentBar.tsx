import React from 'react';
import { Layers, AlertCircle, CheckCircle2, TrendingUp, Users, UserX } from 'lucide-react';

export type QuickSegmentKey = 'all' | 'unpaid' | 'paid' | 'high_pos' | 'multi_case' | 'unallocated';

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
      key: 'all',
      label: 'All Portfolio',
      count: counts.all,
      icon: Layers,
      activeClass: 'bg-primary text-primary-foreground border-primary shadow-xs',
    },
    {
      key: 'unpaid',
      label: 'Unpaid Pending',
      count: counts.unpaid,
      icon: AlertCircle,
      activeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    },
    {
      key: 'paid',
      label: 'Cleared / Paid',
      count: counts.paid,
      icon: CheckCircle2,
      activeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    },
    {
      key: 'high_pos',
      label: 'High POS (> ₹1L)',
      count: counts.highPos,
      icon: TrendingUp,
      activeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    },
    {
      key: 'multi_case',
      label: 'Multi-Case Borrowers',
      count: counts.multiCase,
      icon: Users,
      activeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    },
    {
      key: 'unallocated',
      label: 'Unassigned Cases',
      count: counts.unallocated,
      icon: UserX,
      activeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
      {segments.map((s) => {
        const Icon = s.icon;
        const isActive = activeSegment === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelectSegment(isActive && s.key !== 'all' ? 'all' : s.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 cursor-pointer ${
              isActive
                ? s.activeClass
                : 'bg-muted/40 border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{s.label}</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                isActive
                  ? 'bg-foreground/10 text-inherit font-bold'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
