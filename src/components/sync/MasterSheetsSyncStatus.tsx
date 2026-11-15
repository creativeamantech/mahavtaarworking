import { useEffect, useState } from "react";
import { RefreshCw, FileSpreadsheet } from "lucide-react";
import { useMasterSheetsSync } from "@/hooks/useMasterSheetsSync";
import { formatSyncRelativeTime } from "@/lib/masterSyncStore";

interface MasterSheetsSyncStatusProps {
  compact?: boolean | undefined;
  className?: string | undefined;
}

export function MasterSheetsSyncStatus({
  compact = false,
  className = "",
}: MasterSheetsSyncStatusProps) {
  const { meta, isSyncing, forceRefreshMaster } = useMasterSheetsSync();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const { shortLabel, exactLabel } = formatSyncRelativeTime(meta.lastSyncedAt, nowMs);

  const statusColor = isSyncing
    ? "bg-primary animate-pulse"
    : meta.lastError
      ? "bg-destructive"
      : meta.lastSyncedAt
        ? "bg-emerald-500"
        : "bg-amber-500";

  const tooltipText = [
    `Master Sheet: ${meta.spreadsheetName} (${meta.periodLabel})`,
    exactLabel,
    meta.rowCount !== null ? `${meta.rowCount.toLocaleString()} records` : null,
    meta.lastError ? `Last error: ${meta.lastError}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[11px] ${className}`}
        title={tooltipText}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} aria-hidden="true" />
        <span className="max-w-[70px] truncate font-mono font-medium tabular-nums text-foreground">
          {isSyncing ? "Syncing" : shortLabel}
        </span>
        <button
          type="button"
          onClick={() => void forceRefreshMaster()}
          disabled={isSyncing}
          aria-label="Force Refresh Master Allocation from Google Sheets"
          title="Force Refresh Master Allocation from Google Sheets"
          className="inline-flex h-6 items-center gap-1 rounded border border-border/80 bg-card px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
          <span className="hidden xs:inline">Refresh</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs ${className}`}
      title={tooltipText}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} aria-hidden="true" />
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="hidden xl:inline text-[11px] font-medium text-muted-foreground">
            Sheets:
          </span>
          <span
            className="font-mono text-[11px] font-semibold tabular-nums text-foreground"
            data-testid="master-last-sync-time"
          >
            {isSyncing ? "Syncing…" : shortLabel}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void forceRefreshMaster()}
        disabled={isSyncing}
        aria-label="Force Refresh Master Allocation from Google Sheets"
        title="Force Refresh Master Allocation from Google Sheets"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
        <span>{isSyncing ? "Refreshing…" : "Force Refresh"}</span>
      </button>
    </div>
  );
}
