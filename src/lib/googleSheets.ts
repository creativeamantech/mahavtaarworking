// @ts-nocheck
/**
 * Google Sheets Integration Helper for Mahavtaar Ledger
 * Supports direct Google Sheet URL / Sheet ID extraction, public/shared CSV fetching,
 * GID parsing, ArrayBuffer conversion, and preset storage.
 */
import * as XLSX from "xlsx";

export interface GoogleSheetInfo {
  sheetId: string;
  gid: string;
  isPublishedWeb: boolean;
  cleanUrl: string;
}

export interface SheetPreviewResult {
  sheetId: string;
  gid: string;
  rowCount: number;
  columns: string[];
  sampleRows: Record<string, unknown>[];
  hasAgreementId: boolean;
  buffer: ArrayBuffer;
  csvText: string;
}

export interface SavedSheetPreset {
  id: string;
  name: string;
  url: string;
  sheetId: string;
  gid: string;
  type: "MAIN_DATA" | "PAID_FILE" | "ADDITIONAL_COLLECTION_FILE" | "CORRECTED_DAC_FILE";
  lastSyncedAt?: string;
  lastRecordCount?: number;
}

const SAVED_SHEETS_KEY = "mahavtaar_saved_sheets";

/**
 * Extracts spreadsheetId and gid from full Google Sheet URL or raw ID
 */
export function extractSheetInfo(input: string): GoogleSheetInfo | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // Case 1: Published to web link (e.g., https://docs.google.com/spreadsheets/d/e/2PACX-.../pub...)
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch && pubMatch[1]) {
    const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
    const gid = gidMatch && gidMatch[1] ? gidMatch[1] : "0";
    return {
      sheetId: pubMatch[1],
      gid,
      isPublishedWeb: true,
      cleanUrl: `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv&gid=${gid}`,
    };
  }

  // Case 2: Standard Google Sheet URL (e.g., https://docs.google.com/spreadsheets/d/{id}/edit#gid=0)
  const stdMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (stdMatch && stdMatch[1]) {
    const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
    const gid = gidMatch && gidMatch[1] ? gidMatch[1] : "0";
    return {
      sheetId: stdMatch[1],
      gid,
      isPublishedWeb: false,
      cleanUrl: `https://docs.google.com/spreadsheets/d/${stdMatch[1]}/edit#gid=${gid}`,
    };
  }

  // Case 3: Raw Sheet ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return {
      sheetId: trimmed,
      gid: "0",
      isPublishedWeb: false,
      cleanUrl: `https://docs.google.com/spreadsheets/d/${trimmed}/edit#gid=0`,
    };
  }

  return null;
}

/**
 * Fetches the CSV content from Google Sheets via Google Visualization API or Direct Export
 */
export async function fetchGoogleSheetCsv(
  info: GoogleSheetInfo,
): Promise<{ csvText: string; buffer: ArrayBuffer }> {
  const urlsToTry: string[] = [];

  if (info.isPublishedWeb) {
    urlsToTry.push(
      `https://docs.google.com/spreadsheets/d/e/${info.sheetId}/pub?output=csv&gid=${info.gid}`,
    );
  } else {
    // URL 1: Google Visualization API CSV output (supports CORS headers)
    urlsToTry.push(
      `https://docs.google.com/spreadsheets/d/${info.sheetId}/gviz/tq?tqx=out:csv&gid=${info.gid}`,
    );
    // URL 2: Standard CSV export endpoint
    urlsToTry.push(
      `https://docs.google.com/spreadsheets/d/${info.sheetId}/export?format=csv&gid=${info.gid}`,
    );
  }

  let lastError: Error | null = null;
  let csvText = "";

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/csv, text/plain, */*",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("PERMISSION_DENIED");
        }
        if (response.status === 404) {
          throw new Error("NOT_FOUND");
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();

      // Check if Google returned an HTML login page instead of CSV
      if (
        text.includes("<!DOCTYPE html>") ||
        text.includes("<html") ||
        text.includes("accounts.google.com")
      ) {
        throw new Error("PERMISSION_DENIED");
      }

      // Check if CSV content is empty or valid
      if (text.trim().length > 0) {
        csvText = text;
        break;
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message === "PERMISSION_DENIED" || lastError.message === "NOT_FOUND") {
        break; // Don't try next URL if permissions or sheet existence is the issue
      }
    }
  }

  if (!csvText) {
    if (lastError?.message === "PERMISSION_DENIED") {
      throw new Error(
        'Google Sheet is private. Please open the Google Sheet, click "Share" (top-right), and set General Access to "Anyone with the link can view".',
      );
    }
    if (lastError?.message === "NOT_FOUND") {
      throw new Error("Google Sheet not found. Please double-check the Sheet ID or URL.");
    }
    throw new Error(
      lastError?.message ||
        'Failed to fetch CSV from Google Sheets. Ensure the sheet is shared as "Anyone with the link can view".',
    );
  }

  const encoder = new TextEncoder();
  const buffer = encoder.encode(csvText).buffer;
  return { csvText, buffer };
}

/**
 * Inspects the fetched sheet, parsing headers and previewing rows
 */
export async function previewGoogleSheet(input: string): Promise<SheetPreviewResult> {
  const info = extractSheetInfo(input);
  if (!info) {
    throw new Error(
      "Invalid Google Sheet URL or ID. Please paste a valid docs.google.com/spreadsheets/d/... link.",
    );
  }

  const { csvText, buffer } = await fetchGoogleSheetCsv(info);

  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The Google Sheet appears to be empty.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheetName], {
    defval: "",
  });
  if (rows.length === 0) {
    throw new Error("No data rows found in this sheet tab.");
  }

  const columns = Object.keys(rows[0] || {});
  const sampleRows = rows.slice(0, 5);

  // Check for agreement ID column variants
  const agreementKeywords = [
    "agreementid",
    "agreement_id",
    "agreement no",
    "agreementno",
    "loan id",
    "loan_id",
    "account no",
  ];
  const hasAgreementId = columns.some((c) => agreementKeywords.includes(c.toLowerCase().trim()));

  return {
    sheetId: info.sheetId,
    gid: info.gid,
    rowCount: rows.length,
    columns,
    sampleRows,
    hasAgreementId,
    buffer,
    csvText,
  };
}

/**
 * Saved presets helper functions
 */
export function getSavedSheets(): SavedSheetPreset[] {
  try {
    const raw = localStorage.getItem(SAVED_SHEETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSheetPreset(preset: Omit<SavedSheetPreset, "id">): SavedSheetPreset {
  const sheets = getSavedSheets();
  const existingIdx = sheets.findIndex((s) => s.sheetId === preset.sheetId && s.gid === preset.gid);
  const updatedPreset: SavedSheetPreset = {
    ...preset,
    id: existingIdx >= 0 ? sheets[existingIdx]!.id : crypto.randomUUID(),
  };

  if (existingIdx >= 0) {
    sheets[existingIdx] = updatedPreset;
  } else {
    sheets.unshift(updatedPreset);
  }

  try {
    localStorage.setItem(SAVED_SHEETS_KEY, JSON.stringify(sheets.slice(0, 20)));
  } catch (err) {
    console.error("Failed to save sheet preset:", err);
  }

  return updatedPreset;
}

export function removeSheetPreset(id: string): void {
  const sheets = getSavedSheets().filter((s) => s.id !== id);
  try {
    localStorage.setItem(SAVED_SHEETS_KEY, JSON.stringify(sheets));
  } catch (err) {
    console.error("Failed to delete sheet preset:", err);
  }
}
