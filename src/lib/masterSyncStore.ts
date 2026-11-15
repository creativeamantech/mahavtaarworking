import * as XLSX from "xlsx";
import { DEFAULT_PINNED_MASTER, getCurrentPeriodTarget } from "./masterAllocationMatcher";

export interface MasterSyncMeta {
  lastSyncedAt: string | null;
  spreadsheetId: string;
  spreadsheetName: string;
  sheetTitle: string;
  periodLabel: string;
  rowCount: number | null;
  lastError: string | null;
}

const MASTER_SYNC_META_KEY = "mahavtaar_master_sync_meta";
export const MASTER_SYNC_EVENT = "mahavtaar_master_sync_updated";

let syncingInFlight = false;
const syncingListeners = new Set<(syncing: boolean) => void>();

export function isMasterSyncInFlight(): boolean {
  return syncingInFlight;
}

export function setMasterSyncInFlight(syncing: boolean): void {
  syncingInFlight = syncing;
  for (const listener of syncingListeners) {
    try {
      listener(syncing);
    } catch {
      // ignore listener error
    }
  }
}

export function subscribeMasterSyncInFlight(listener: (syncing: boolean) => void): () => void {
  syncingListeners.add(listener);
  listener(syncingInFlight);
  return () => {
    syncingListeners.delete(listener);
  };
}

export function getDefaultMasterSyncMeta(): MasterSyncMeta {
  return {
    lastSyncedAt: null,
    spreadsheetId: DEFAULT_PINNED_MASTER.id,
    spreadsheetName: DEFAULT_PINNED_MASTER.name,
    sheetTitle: "Data",
    periodLabel: getCurrentPeriodTarget().periodLabel,
    rowCount: null,
    lastError: null,
  };
}

export function getMasterSyncMeta(): MasterSyncMeta {
  if (typeof window === "undefined") {
    return getDefaultMasterSyncMeta();
  }
  try {
    const raw = localStorage.getItem(MASTER_SYNC_META_KEY);
    if (!raw) return getDefaultMasterSyncMeta();
    const parsed = JSON.parse(raw) as Partial<MasterSyncMeta>;
    return {
      ...getDefaultMasterSyncMeta(),
      ...parsed,
    };
  } catch {
    return getDefaultMasterSyncMeta();
  }
}

export function saveMasterSyncMeta(patch: Partial<MasterSyncMeta>): MasterSyncMeta {
  const next: MasterSyncMeta = {
    ...getMasterSyncMeta(),
    ...patch,
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MASTER_SYNC_META_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<MasterSyncMeta>(MASTER_SYNC_EVENT, { detail: next }));
    } catch (err) {
      console.error("Failed to persist master sync metadata:", err);
    }
  }
  return next;
}

export function formatSyncRelativeTime(
  isoTimestamp: string | null,
  nowMs: number = Date.now(),
): { shortLabel: string; exactLabel: string } {
  if (!isoTimestamp) {
    return { shortLabel: "Not synced", exactLabel: "Not synced yet with Google Sheets" };
  }
  const ts = Date.parse(isoTimestamp);
  if (Number.isNaN(ts)) {
    return { shortLabel: "Not synced", exactLabel: "Not synced yet with Google Sheets" };
  }

  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  const exactDate = new Date(ts);
  const clockStr = exactDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fullStr = exactDate.toLocaleString();

  if (diffSec < 45) {
    return { shortLabel: "Just now", exactLabel: `Last synced at ${fullStr}` };
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return { shortLabel: `${diffMin}m ago`, exactLabel: `Last synced at ${fullStr}` };
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return { shortLabel: clockStr, exactLabel: `Last synced at ${fullStr}` };
  }
  return {
    shortLabel: exactDate.toLocaleDateString([], { month: "short", day: "numeric" }),
    exactLabel: `Last synced at ${fullStr}`,
  };
}

export function sheetValuesToXlsxBuffer(values: unknown[][], sheetTitle = "Data"): ArrayBuffer {
  const headers = (values[0] || []).map((v, i) => {
    const text = String(v ?? "").trim();
    return text || `Column_${i + 1}`;
  });
  const rows = values
    .slice(1)
    .map((rowValues) =>
      Object.fromEntries(headers.map((header, index) => [header, rowValues[index] ?? ""])),
    );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    (sheetTitle || "Data").slice(0, 31),
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
