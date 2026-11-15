export interface DriveSpreadsheetCandidate {
  id: string;
  name: string;
  modifiedTime?: string | null | undefined;
  webViewLink?: string | null | undefined;
}

export interface MasterPeriodTarget {
  year: number;
  monthIndex: number; // 0-based
  monthNumber: string; // "01".."12"
  monthName: string; // e.g. "November"
  monthShort: string; // e.g. "Nov"
  periodLabel: string; // e.g. "November 2026"
}

export type MasterMatchType = "EXACT_CURRENT_PERIOD" | "LATEST_MASTER_FALLBACK" | "PINNED_DEFAULT";

export interface SelectedMasterSheetRecord {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetTitle: string;
  periodLabel: string;
  matchType: MasterMatchType;
  webViewLink?: string | undefined;
  rowCount?: number | undefined;
  selectedAt: string;
}

export const DEFAULT_PINNED_MASTER: DriveSpreadsheetCandidate = {
  id: "1w4ROwnbOmDlzCOfLAuWIQRpKQR3sa3f8GNDGFqb-P_Q",
  name: "Mahavtaar Master Allocation November 2026",
  webViewLink:
    "https://docs.google.com/spreadsheets/d/1w4ROwnbOmDlzCOfLAuWIQRpKQR3sa3f8GNDGFqb-P_Q/edit",
};

export const DEFAULT_PINNED_COLLECTIONS: DriveSpreadsheetCandidate = {
  id: "1AXLakW3subO9H-O9iWIpXJyjT4JLXRTG5uiL3dWsY5g",
  name: "Mahavtaar Daily Collection",
  webViewLink:
    "https://docs.google.com/spreadsheets/d/1AXLakW3subO9H-O9iWIpXJyjT4JLXRTG5uiL3dWsY5g/edit",
};

const ALL_MONTHS = [
  { full: "january", short: "jan" },
  { full: "february", short: "feb" },
  { full: "march", short: "mar" },
  { full: "april", short: "apr" },
  { full: "may", short: "may" },
  { full: "june", short: "jun" },
  { full: "july", short: "jul" },
  { full: "august", short: "aug" },
  { full: "september", short: "sep" },
  { full: "october", short: "oct" },
  { full: "november", short: "nov" },
  { full: "december", short: "dec" },
] as const;

const SELECTED_MASTER_STORAGE_KEY = "mahavtaar_selected_master_sheet";

export function getCurrentPeriodTarget(referenceDate: Date = new Date()): MasterPeriodTarget {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const monthNumber = String(monthIndex + 1).padStart(2, "0");
  const monthName = referenceDate.toLocaleString("en-US", { month: "long" });
  const monthShort = referenceDate.toLocaleString("en-US", { month: "short" });
  return {
    year,
    monthIndex,
    monthNumber,
    monthName,
    monthShort,
    periodLabel: `${monthName} ${year}`,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreMasterCandidate(
  file: DriveSpreadsheetCandidate,
  target: MasterPeriodTarget,
): {
  score: number;
  isMasterAllocation: boolean;
  matchesCurrentMonth: boolean;
  matchesCurrentYear: boolean;
} {
  const lower = file.name.toLowerCase();

  // Exclude collections/feedback/attendance sheets from master allocation matching
  const isCollectionOrAux =
    /\b(daily\s*collection|collections|feedback|attendance|audit)\b/i.test(lower) &&
    !/\bmaster\b/i.test(lower);

  const hasMaster = /\bmaster\b/i.test(lower);
  const hasAllocation = /\ballocation\b/i.test(lower);
  const hasMahavtaar = /\bmahavtaar\b/i.test(lower);
  const isMasterAllocation = !isCollectionOrAux && (hasMaster || hasAllocation);

  const yearStr = String(target.year);
  const shortYear = yearStr.slice(-2);
  const matchesCurrentYear =
    new RegExp(`\\b${escapeRegExp(yearStr)}\\b`).test(lower) ||
    new RegExp(`[-_\\s/]${escapeRegExp(shortYear)}\\b`).test(lower);

  const otherYearMatches = lower.match(/\b(20\d{2})\b/g) || [];
  const hasWrongYear = otherYearMatches.some((y) => y !== yearStr) && !matchesCurrentYear;

  const targetMonth = ALL_MONTHS[target.monthIndex]!;
  const matchesMonthWord =
    new RegExp(`\\b${targetMonth.full}\\b`, "i").test(lower) ||
    new RegExp(`\\b${targetMonth.short}\\b`, "i").test(lower);
  const matchesNumericMonthYear =
    new RegExp(`(?:^|[^\\d])${target.monthNumber}[-_/]${yearStr}(?:$|[^\\d])`).test(lower) ||
    new RegExp(`(?:^|[^\\d])${yearStr}[-_/]${target.monthNumber}(?:$|[^\\d])`).test(lower);

  const matchesCurrentMonth = matchesMonthWord || matchesNumericMonthYear;

  const hasWrongMonth =
    !matchesCurrentMonth &&
    ALL_MONTHS.some(
      (m, idx) =>
        idx !== target.monthIndex &&
        (new RegExp(`\\b${m.full}\\b`, "i").test(lower) ||
          new RegExp(`\\b${m.short}\\b`, "i").test(lower)),
    );

  let score = 0;
  if (isCollectionOrAux) score -= 200;
  if (hasMaster) score += 45;
  if (hasAllocation) score += 35;
  if (hasMahavtaar) score += 15;
  if (matchesCurrentMonth) score += 60;
  if (matchesCurrentYear) score += 45;
  if (hasWrongMonth) score -= 45;
  if (hasWrongYear) score -= 60;

  return { score, isMasterAllocation, matchesCurrentMonth, matchesCurrentYear };
}

/**
 * Selects the current month's Master Allocation spreadsheet for the current year
 * from Google Drive files, ranking exact current-period matches first.
 */
export function selectCurrentMonthMasterAllocation(
  files: DriveSpreadsheetCandidate[],
  referenceDate: Date = new Date(),
): {
  selected: DriveSpreadsheetCandidate;
  matchType: MasterMatchType;
  period: MasterPeriodTarget;
  candidates: DriveSpreadsheetCandidate[];
} {
  const period = getCurrentPeriodTarget(referenceDate);
  const deduped = new Map<string, DriveSpreadsheetCandidate>();
  for (const file of files) {
    if (file.id && file.name && !deduped.has(file.id)) {
      deduped.set(file.id, file);
    }
  }
  const uniqueFiles = Array.from(deduped.values());

  const evaluated = uniqueFiles
    .map((file) => ({
      file,
      ...scoreMasterCandidate(file, period),
      modifiedMs: file.modifiedTime ? Date.parse(file.modifiedTime) || 0 : 0,
    }))
    .sort((a, b) => b.score - a.score || b.modifiedMs - a.modifiedMs);

  const masterCandidates = evaluated
    .filter((entry) => entry.isMasterAllocation || entry.score > 20)
    .map((entry) => entry.file);

  const exactMatch = evaluated.find(
    (entry) => entry.isMasterAllocation && entry.matchesCurrentMonth && entry.matchesCurrentYear,
  );
  if (exactMatch) {
    return {
      selected: exactMatch.file,
      matchType: "EXACT_CURRENT_PERIOD",
      period,
      candidates: masterCandidates.length > 0 ? masterCandidates : [exactMatch.file],
    };
  }

  const latestMaster = evaluated.find((entry) => entry.isMasterAllocation);
  if (latestMaster) {
    return {
      selected: latestMaster.file,
      matchType: "LATEST_MASTER_FALLBACK",
      period,
      candidates: masterCandidates.length > 0 ? masterCandidates : [latestMaster.file],
    };
  }

  return {
    selected: DEFAULT_PINNED_MASTER,
    matchType: "PINNED_DEFAULT",
    period,
    candidates: [DEFAULT_PINNED_MASTER],
  };
}

export function getSavedSelectedMasterSheet(): SelectedMasterSheetRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELECTED_MASTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedMasterSheetRecord;
    return parsed?.spreadsheetId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSelectedMasterSheet(record: SelectedMasterSheetRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SELECTED_MASTER_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent("mahavtaar_master_sheet_selected", { detail: record }));
  } catch (err) {
    console.error("Failed to persist selected master sheet metadata:", err);
  }
}

export function clearSavedSelectedMasterSheet(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SELECTED_MASTER_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
