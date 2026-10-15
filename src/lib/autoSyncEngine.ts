/**
 * Google Sheets Background Auto-Sync Engine
 * Manages automated interval fetching, countdown timers, and background sync broadcasts.
 */

import { getSavedSheets, previewGoogleSheet, saveSheetPreset, SavedSheetPreset } from './googleSheets';
import { db } from './db';
import { parseMainFile, mergeMainIntoRecords, parsePaidFile, mergePaidIntoRecords, parseAdditionalFile, mergeAdditionalIntoRecords, parseCorrectedFile, mergeCorrectedIntoRecords } from './fileParser';
import { atomicFileImport } from './repositories/loanRepository';

export type AutoSyncInterval = 0 | 5 | 15 | 30 | 60; // 0 = Off

const AUTOSYNC_INTERVAL_KEY = 'mahavtaar_autosync_interval';
const AUTOSYNC_LAST_KEY = 'mahavtaar_autosync_last_time';

export interface AutoSyncStatus {
  interval: AutoSyncInterval;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  isSyncing: boolean;
  savedSheetsCount: number;
}

type SyncListener = (status: AutoSyncStatus) => void;
const listeners = new Set<SyncListener>();

let currentInterval: AutoSyncInterval = 0;
let isCurrentlySyncing = false;
let timerId: NodeJS.Timeout | null = null;
let countdownTimerId: NodeJS.Timeout | null = null;

export function getAutoSyncInterval(): AutoSyncInterval {
  try {
    const val = localStorage.getItem(AUTOSYNC_INTERVAL_KEY);
    return val ? (Number(val) as AutoSyncInterval) : 0;
  } catch {
    return 0;
  }
}

export function setAutoSyncInterval(interval: AutoSyncInterval): void {
  currentInterval = interval;
  try {
    localStorage.setItem(AUTOSYNC_INTERVAL_KEY, String(interval));
  } catch (err) {
    console.error('Failed to store autosync interval', err);
  }
  reconfigureTimer();
  notifyListeners();
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(AUTOSYNC_LAST_KEY);
  } catch {
    return null;
  }
}

function updateLastSyncTime(): void {
  const now = new Date().toISOString();
  try {
    localStorage.setItem(AUTOSYNC_LAST_KEY, now);
  } catch {
    // ignore
  }
}

export function getNextSyncTime(): string | null {
  const interval = getAutoSyncInterval();
  if (interval === 0) return null;
  const last = getLastSyncTime();
  if (!last) return null;
  const nextDate = new Date(new Date(last).getTime() + interval * 60 * 1000);
  return nextDate.toISOString();
}

export function getAutoSyncStatus(): AutoSyncStatus {
  const interval = getAutoSyncInterval();
  const sheets = getSavedSheets();
  return {
    interval,
    lastSyncAt: getLastSyncTime(),
    nextSyncAt: getNextSyncTime(),
    isSyncing: isCurrentlySyncing,
    savedSheetsCount: sheets.length,
  };
}

export function subscribeAutoSync(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(getAutoSyncStatus());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  const status = getAutoSyncStatus();
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      // ignore
    }
  });
}

/**
 * Performs synchronization for all saved sheets sequentially
 */
export async function executeAutoSync(userName = 'Auto-Sync Scheduler'): Promise<{
  totalSheets: number;
  totalRows: number;
  newRows: number;
  updatedRows: number;
  errors: string[];
}> {
  if (isCurrentlySyncing) {
    return { totalSheets: 0, totalRows: 0, newRows: 0, updatedRows: 0, errors: ['Sync already in progress'] };
  }

  const sheets = getSavedSheets();
  if (sheets.length === 0) {
    return { totalSheets: 0, totalRows: 0, newRows: 0, updatedRows: 0, errors: [] };
  }

  isCurrentlySyncing = true;
  notifyListeners();

  let totalRows = 0;
  let newRows = 0;
  let updatedRows = 0;
  const errors: string[] = [];

  try {
    for (const preset of sheets) {
      try {
        const preview = await previewGoogleSheet(preset.url);

        if (preset.type === 'MAIN_DATA') {
          const parsed = parseMainFile(preview.buffer);
          const allDbRecords = await db.loan_records.toArray();
          const { mergedRows, newCount, updatedCount } = mergeMainIntoRecords(allDbRecords, parsed);

          const entry = {
            id: crypto.randomUUID(),
            type: 'MAIN_DATA' as const,
            fileName: preset.name,
            recordCount: parsed.length,
            uploadedBy: userName,
            createdAt: new Date().toISOString(),
          };

          await atomicFileImport(mergedRows, entry);
          totalRows += parsed.length;
          newRows += newCount;
          updatedRows += updatedCount;
        } else if (preset.type === 'PAID_FILE') {
          const paidRows = parsePaidFile(preview.buffer);
          const allDbRecords = await db.loan_records.toArray();
          const mergedData = mergePaidIntoRecords(allDbRecords, paidRows);
          const entry = {
            id: crypto.randomUUID(),
            type: 'PAID_FILE' as const,
            fileName: preset.name,
            recordCount: paidRows.length,
            uploadedBy: userName,
            createdAt: new Date().toISOString(),
          };
          await atomicFileImport(mergedData, entry);
          totalRows += paidRows.length;
        } else if (preset.type === 'ADDITIONAL_COLLECTION_FILE') {
          const additionalRows = parseAdditionalFile(preview.buffer);
          const allDbRecords = await db.loan_records.toArray();
          const { merged } = mergeAdditionalIntoRecords(allDbRecords, additionalRows);
          const entry = {
            id: crypto.randomUUID(),
            type: 'ADDITIONAL_COLLECTION_FILE' as const,
            fileName: preset.name,
            recordCount: additionalRows.length,
            uploadedBy: userName,
            createdAt: new Date().toISOString(),
          };
          await atomicFileImport(merged, entry);
          totalRows += additionalRows.length;
        } else if (preset.type === 'CORRECTED_DAC_FILE') {
          const correctedRows = parseCorrectedFile(preview.buffer);
          const allDbRecords = await db.loan_records.toArray();
          const { merged } = mergeCorrectedIntoRecords(allDbRecords, correctedRows);
          const entry = {
            id: crypto.randomUUID(),
            type: 'CORRECTED_DAC_FILE' as const,
            fileName: preset.name,
            recordCount: correctedRows.length,
            uploadedBy: userName,
            createdAt: new Date().toISOString(),
          };
          await atomicFileImport(merged, entry);
          totalRows += correctedRows.length;
        }

        // Update last synced for this preset
        saveSheetPreset({
          ...preset,
          lastSyncedAt: new Date().toISOString(),
          lastRecordCount: preview.rowCount,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${preset.name}: ${msg}`);
      }
    }

    updateLastSyncTime();

    // Broadcast change so DataContext reloads records in memory
    window.dispatchEvent(
      new CustomEvent('mahavtaar_data_synced', {
        detail: { totalRows, newRows, updatedRows, errors },
      })
    );
  } finally {
    isCurrentlySyncing = false;
    notifyListeners();
  }

  return {
    totalSheets: sheets.length,
    totalRows,
    newRows,
    updatedRows,
    errors,
  };
}

function reconfigureTimer(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }

  const interval = getAutoSyncInterval();
  if (interval <= 0) return;

  // Periodic heartbeat to update countdown every 10 seconds
  countdownTimerId = setInterval(() => {
    notifyListeners();
  }, 10000);

  // Periodic sync check every 30 seconds
  timerId = setInterval(async () => {
    const nextStr = getNextSyncTime();
    if (!nextStr) {
      await executeAutoSync();
      return;
    }
    const nextTime = new Date(nextStr).getTime();
    if (Date.now() >= nextTime) {
      await executeAutoSync();
    }
  }, 30000);
}

// Initialize on module load
if (typeof window !== 'undefined') {
  currentInterval = getAutoSyncInterval();
  if (currentInterval > 0) {
    reconfigureTimer();
  }
}
