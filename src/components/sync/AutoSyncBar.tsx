// @ts-nocheck
import { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle2, AlertCircle, Play, Pause } from 'lucide-react';
import { 
  getAutoSyncStatus, 
  setAutoSyncInterval, 
  executeAutoSync, 
  subscribeAutoSync, 
  type AutoSyncStatus, 
  type AutoSyncInterval 
} from '../../lib/autoSyncEngine';
import { toast } from 'sonner';

interface AutoSyncBarProps {
  className?: string;
  userName?: string;
  compact?: boolean;
}

export function AutoSyncBar({ className = '', userName = 'User', compact = false }: AutoSyncBarProps) {
  const [status, setStatus] = useState<AutoSyncStatus>(getAutoSyncStatus());
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const unsub = subscribeAutoSync((newStatus) => {
      setStatus(newStatus);
    });
    return unsub;
  }, []);

  // Countdown timer calculation
  useEffect(() => {
    if (status.interval === 0 || !status.nextSyncAt) {
      setTimeRemaining('');
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const target = new Date(status.nextSyncAt!).getTime();
      const diffMs = target - now;

      if (diffMs <= 0) {
        setTimeRemaining('Syncing soon...');
      } else {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimeRemaining(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [status.interval, status.nextSyncAt]);

  const handleIntervalChange = (val: string) => {
    const num = Number(val) as AutoSyncInterval;
    setAutoSyncInterval(num);
    if (num > 0) {
      toast.success(`Google Sheets auto-sync enabled (Every ${num} minutes)`);
    } else {
      toast.info('Google Sheets auto-sync paused');
    }
  };

  const handleManualSync = async () => {
    if (status.savedSheetsCount === 0) {
      toast.info('No saved Google Sheets to sync. Connect a sheet first below.');
      return;
    }

    try {
      const res = await executeAutoSync(userName);
      if (res.errors.length > 0) {
        toast.warning(`Synced with issues: ${res.errors.join('; ')}`);
      } else {
        toast.success(
          `All sheets synced: ${res.newRows} new loans, ${res.updatedRows} updated (${res.totalRows} processed)`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      toast.error(`Sync error: ${msg}`);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs font-medium ${className}`}>
        <button
          type="button"
          onClick={handleManualSync}
          disabled={status.isSyncing || status.savedSheetsCount === 0}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors disabled:opacity-50"
          title="Sync all connected Google Sheets"
        >
          <RefreshCw className={`h-3 w-3 text-emerald-600 dark:text-emerald-400 ${status.isSyncing ? 'animate-spin' : ''}`} />
          <span className="font-mono tabular-nums">{status.isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        {status.interval > 0 && timeRemaining && (
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {timeRemaining}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-card/70 border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              Background Auto-Sync
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {status.savedSheetsCount} {status.savedSheetsCount === 1 ? 'Sheet' : 'Sheets'} configured
            </span>
            {status.interval > 0 && timeRemaining && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-primary font-mono tabular-nums font-medium">
                  Next in {timeRemaining}
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {status.lastSyncAt
              ? `Last synced: ${new Date(status.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Auto-sync active when intervals are set'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <select
          value={String(status.interval)}
          onChange={(e) => handleIntervalChange(e.target.value)}
          disabled={status.isSyncing}
          className="h-8 px-2.5 text-xs bg-background border border-input rounded-md text-foreground outline-none focus:ring-1 focus:ring-primary font-medium"
        >
          <option value="0">Auto-Sync: Off</option>
          <option value="5">Every 5 minutes</option>
          <option value="15">Every 15 minutes</option>
          <option value="30">Every 30 minutes</option>
          <option value="60">Every 1 hour</option>
        </select>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={status.isSyncing || status.savedSheetsCount === 0}
          className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 whitespace-nowrap"
          title="Sync all connected Google Sheets immediately"
        >
          <RefreshCw className={`h-3 w-3 ${status.isSyncing ? 'animate-spin' : ''}`} />
          <span>{status.isSyncing ? 'Syncing...' : 'Sync All Now'}</span>
        </button>
      </div>
    </div>
  );
}
