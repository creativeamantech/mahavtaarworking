import React from 'react';

interface BucketBadgeProps {
  bkt: string | number;
  className?: string;
}

export function BucketBadge({ bkt, className = '' }: BucketBadgeProps) {
  const strBkt = String(bkt ?? '').trim();
  const num = Number(strBkt);

  if (strBkt.toUpperCase() === 'NPA' || strBkt.toUpperCase().includes('NPA')) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 font-tabular ${className}`}>
        NPA
      </span>
    );
  }

  if (isNaN(num) || strBkt === '' || strBkt === '-') {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground font-tabular ${className}`}>
        —
      </span>
    );
  }

  if (num <= 1) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 font-tabular ${className}`}>
        BKT {num}
      </span>
    );
  }

  if (num === 2) {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25 font-tabular ${className}`}>
        BKT {num}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25 font-tabular ${className}`}>
      BKT {num}
    </span>
  );
}

export function getBucketRowBorder(bkt: string | number): string {
  const str = String(bkt ?? '').trim();
  const num = Number(str);
  if (str.toUpperCase().includes('NPA') || num >= 3) {
    return 'border-l-2 border-l-red-500';
  }
  if (num === 2) {
    return 'border-l-2 border-l-orange-500';
  }
  if (num <= 1 && !isNaN(num)) {
    return 'border-l-2 border-l-yellow-500';
  }
  return 'border-l-2 border-l-transparent';
}
