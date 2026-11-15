import * as XLSX from "xlsx";
import { clearGoogleAccessToken, getGoogleAccessToken } from "./googleWorkspaceAuth";
import {
  DEFAULT_PINNED_COLLECTIONS,
  DEFAULT_PINNED_MASTER,
  selectCurrentMonthMasterAllocation,
  type DriveSpreadsheetCandidate,
  type MasterMatchType,
  type MasterPeriodTarget,
} from "./masterAllocationMatcher";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4";

export const APPROVED_WORKSPACE_SHEETS = {
  master: {
    id: DEFAULT_PINNED_MASTER.id,
    name: DEFAULT_PINNED_MASTER.name,
    preferredTab: "Data",
  },
  collections: {
    id: DEFAULT_PINNED_COLLECTIONS.id,
    name: DEFAULT_PINNED_COLLECTIONS.name,
    preferredTab: "Collections",
  },
} as const;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string | undefined;
  webViewLink?: string | undefined;
  size?: string | undefined;
  owners?: { displayName?: string | undefined; emailAddress?: string | undefined }[] | undefined;
}

export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount?: number | undefined;
  columnCount?: number | undefined;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl?: string | undefined;
  sheets: SpreadsheetTabInfo[];
}

export interface SheetReadResult {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  range: string;
  values: unknown[][];
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  buffer: ArrayBuffer;
  modifiedTime?: string | undefined;
  webViewLink?: string | undefined;
}

async function requireToken(): Promise<string> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED: Please sign in with Google to access Google Drive and Sheets.");
  }
  return token;
}

async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await requireToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    clearGoogleAccessToken();
    throw new Error("AUTH_EXPIRED: Google session expired. Please sign in with Google again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const apiMessage =
      (body as { error?: { message?: string } })?.error?.message ||
      `Google API error (${res.status})`;
    throw new Error(apiMessage);
  }

  return res.json() as Promise<T>;
}

/**
 * List Google Spreadsheets (or general files) from the authenticated user's Google Drive.
 */
export async function listDriveSpreadsheets(
  searchQuery = "",
  pageSize = 30,
): Promise<DriveFileItem[]> {
  const clauses = ["mimeType = 'application/vnd.google-apps.spreadsheet'", "trashed = false"];
  const cleanQuery = searchQuery.trim().replace(/'/g, "\\'");
  if (cleanQuery) {
    clauses.push(`name contains '${cleanQuery}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName,emailAddress))",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });

  const data = await googleFetch<{ files?: DriveFileItem[] }>(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
  );
  return data.files || [];
}

/**
 * Fetch metadata for a specific Google Drive file.
 */
export async function getDriveFileMetadata(fileId: string): Promise<DriveFileItem> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,modifiedTime,webViewLink,size,owners(displayName,emailAddress)",
    supportsAllDrives: "true",
  });
  return googleFetch<DriveFileItem>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
  );
}

/**
 * Fetch spreadsheet metadata and tab list without hardcoding "Sheet1".
 */
export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields:
      "spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,index,gridProperties)",
  });

  const raw = await googleFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        index?: number;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>(`${SHEETS_API_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`);

  const sheets: SpreadsheetTabInfo[] = (raw.sheets || []).map((s, idx) => ({
    sheetId: s.properties?.sheetId ?? idx,
    title: s.properties?.title || `Sheet${idx + 1}`,
    index: s.properties?.index ?? idx,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  }));

  return {
    spreadsheetId: raw.spreadsheetId || spreadsheetId,
    title: raw.properties?.title || "Untitled Spreadsheet",
    spreadsheetUrl: raw.spreadsheetUrl,
    sheets,
  };
}

/**
 * Resolve the target tab name dynamically using spreadsheet metadata.
 */
export function resolveTargetTab(
  metadata: SpreadsheetMetadata,
  preferredTab?: string,
  gid?: string,
): string {
  if (gid && gid !== "0") {
    const numericGid = Number(gid);
    const byGid = metadata.sheets.find((s) => s.sheetId === numericGid);
    if (byGid) return byGid.title;
  }
  if (preferredTab) {
    const exact = metadata.sheets.find((s) => s.title.toLowerCase() === preferredTab.toLowerCase());
    if (exact) return exact.title;
  }
  return metadata.sheets[0]?.title || "Data";
}

function escapeSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/**
 * Read values from a Google Sheet via the official Sheets v4 API and convert to Workbook ArrayBuffer.
 */
export async function readGoogleSheet(
  spreadsheetId: string,
  options: { preferredTab?: string; gid?: string; range?: string } = {},
): Promise<SheetReadResult> {
  const [metadata, fileMeta] = await Promise.all([
    getSpreadsheetMetadata(spreadsheetId),
    getDriveFileMetadata(spreadsheetId).catch(() => null),
  ]);

  const sheetTitle = resolveTargetTab(metadata, options.preferredTab, options.gid);
  const range = options.range || `${escapeSheetTitle(sheetTitle)}!A1:ZZ`;

  const response = await googleFetch<{ range?: string; values?: unknown[][] }>(
    `${SHEETS_API_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
  );

  const values = Array.isArray(response.values) ? response.values : [];
  if (values.length < 2) {
    throw new Error(`No data rows found in tab "${sheetTitle}" of "${metadata.title}".`);
  }

  const headers = (values[0] || []).map((h, i) => {
    const text = String(h ?? "").trim();
    return text || `Column_${i + 1}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < values.length; r++) {
    const rawRow = values[r] || [];
    const hasContent = rawRow.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasContent) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = rawRow[c] ?? "";
    }
    rows.push(obj);
  }

  if (rows.length === 0) {
    throw new Error(
      `Tab "${sheetTitle}" of "${metadata.title}" only contains headers and no rows.`,
    );
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetTitle.slice(0, 31));
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return {
    spreadsheetId,
    spreadsheetTitle: fileMeta?.name || metadata.title,
    sheetTitle,
    range: response.range || range,
    values,
    headers,
    rows,
    rowCount: rows.length,
    buffer,
    modifiedTime: fileMeta?.modifiedTime,
    webViewLink: fileMeta?.webViewLink || metadata.spreadsheetUrl,
  };
}

/**
 * Create a new Google Spreadsheet in the user's Google Drive and optionally populate initial rows.
 * IMPORTANT: Callers MUST obtain explicit user confirmation via a dialog before calling this!
 */
export async function createGoogleSpreadsheet(params: {
  title: string;
  sheetTitle?: string;
  rows?: (string | number | boolean | null)[][];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string; sheetTitle: string }> {
  const sheetTitle = params.sheetTitle?.trim() || "Data";

  const created = await googleFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
  }>(`${SHEETS_API_BASE}/spreadsheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: params.title },
      sheets: [{ properties: { title: sheetTitle } }],
    }),
  });

  if (params.rows && params.rows.length > 0) {
    await writeGoogleSheetValues(
      created.spreadsheetId,
      `${escapeSheetTitle(sheetTitle)}!A1`,
      params.rows,
    );
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    title: created.properties?.title || params.title,
    sheetTitle,
  };
}

/**
 * Write or overwrite cell values in an existing Google Sheet.
 * IMPORTANT: Callers MUST obtain explicit user confirmation via a dialog before calling this!
 */
export async function writeGoogleSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
): Promise<{ updatedRows: number; updatedCells: number }> {
  const res = await googleFetch<{ updatedRows?: number; updatedCells?: number }>(
    `${SHEETS_API_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values,
      }),
    },
  );
  return {
    updatedRows: res.updatedRows ?? values.length,
    updatedCells: res.updatedCells ?? 0,
  };
}

/**
 * Append rows to an existing Google Sheet.
 * IMPORTANT: Callers MUST obtain explicit user confirmation via a dialog before calling this!
 */
export async function appendGoogleSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
): Promise<{ updatedRows: number }> {
  const res = await googleFetch<{ updates?: { updatedRows?: number } }>(
    `${SHEETS_API_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values,
      }),
    },
  );
  return {
    updatedRows: res.updates?.updatedRows ?? values.length,
  };
}

/**
 * Move a file in Google Drive to trash.
 * IMPORTANT: Callers MUST obtain explicit user confirmation via a dialog before calling this!
 */
export async function trashDriveFile(fileId: string): Promise<void> {
  await googleFetch(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    },
  );
}

/**
 * Searches Google Drive for the current month and current year Master Allocation spreadsheet.
 */
export async function discoverCurrentMonthMasterCandidates(
  referenceDate: Date = new Date(),
): Promise<{
  selected: DriveSpreadsheetCandidate;
  matchType: MasterMatchType;
  period: MasterPeriodTarget;
  candidates: DriveSpreadsheetCandidate[];
}> {
  const files = await listDriveSpreadsheets("", 50);
  return selectCurrentMonthMasterAllocation(files, referenceDate);
}

/**
 * Discovers the current month/year Master Allocation via Google Drive API and reads it via Sheets v4.
 */
export async function readCurrentMonthMasterAllocation(
  options: { overrideSpreadsheetId?: string | undefined; referenceDate?: Date | undefined } = {},
): Promise<{
  readResult: SheetReadResult;
  matchType: MasterMatchType;
  period: MasterPeriodTarget;
  candidates: DriveSpreadsheetCandidate[];
}> {
  const discovery = await discoverCurrentMonthMasterCandidates(options.referenceDate);
  const targetId = options.overrideSpreadsheetId || discovery.selected.id;
  const readResult = await readGoogleSheet(targetId, { preferredTab: "Data" });
  return {
    readResult,
    matchType: options.overrideSpreadsheetId ? "PINNED_DEFAULT" : discovery.matchType,
    period: discovery.period,
    candidates: discovery.candidates,
  };
}
