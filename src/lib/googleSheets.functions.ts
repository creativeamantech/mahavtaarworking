import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  DEFAULT_PINNED_COLLECTIONS,
  DEFAULT_PINNED_MASTER,
  selectCurrentMonthMasterAllocation,
  type DriveSpreadsheetCandidate,
} from "./masterAllocationMatcher";

const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function hasLovableConnectors(): boolean {
  return Boolean(
    process.env["LOVABLE_API_KEY"] &&
    process.env["GOOGLE_SHEETS_API_KEY"] &&
    process.env["GOOGLE_DRIVE_API_KEY"],
  );
}

async function gatewayWriteRequest<T>(
  base: string,
  path: string,
  apiKeyName: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env[apiKeyName];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Workspace connection is not configured on the server.");
  }

  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Google Workspace write error", response.status, detail.slice(0, 500));
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Google Workspace connection authorization failed."
        : `Google Workspace write failed (${response.status}).`,
    );
  }
  return response.json() as Promise<T>;
}

async function gatewayRequest<T>(base: string, path: string, apiKeyName: string): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env[apiKeyName];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Workspace connection is not configured on the server.");
  }

  const response = await fetch(`${base}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Google Workspace gateway error", response.status, detail.slice(0, 500));
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Google Workspace connection authorization failed."
        : `Google Workspace request failed (${response.status}).`,
    );
  }
  return response.json() as Promise<T>;
}

async function listDriveSpreadsheetsViaConnector(): Promise<DriveSpreadsheetCandidate[]> {
  const params = new URLSearchParams({
    q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
    orderBy: "modifiedTime desc",
    pageSize: "50",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const data = await gatewayRequest<{ files?: DriveSpreadsheetCandidate[] }>(
    DRIVE_GATEWAY,
    `/files?${params.toString()}`,
    "GOOGLE_DRIVE_API_KEY",
  );
  return Array.isArray(data?.files) ? data.files : [];
}

async function resolveTabViaConnector(
  spreadsheetId: string,
  preferredTab: string,
): Promise<{ spreadsheetTitle: string | undefined; sheetTitle: string }> {
  const meta = await gatewayRequest<{
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(
    SHEETS_GATEWAY,
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties(title)`,
    "GOOGLE_SHEETS_API_KEY",
  );
  const tabs = (meta?.sheets || [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));

  const matched =
    tabs.find((t) => t.toLowerCase() === preferredTab.toLowerCase()) || tabs[0] || preferredTab;

  return {
    spreadsheetTitle: meta?.properties?.title,
    sheetTitle: matched,
  };
}

function toSerializableCandidate(c: DriveSpreadsheetCandidate): {
  id: string;
  name: string;
  modifiedTime: string | null;
  webViewLink: string | null;
} {
  return {
    id: c.id,
    name: c.name,
    modifiedTime: c.modifiedTime ?? null,
    webViewLink: c.webViewLink ?? null,
  };
}

/** Reports whether Lovable's server-side Google Drive & Sheets connectors are active. */
export const getWorkspaceConnectorStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    lovableConfigured: hasLovableConnectors(),
    hasSheetsKey: Boolean(process.env["GOOGLE_SHEETS_API_KEY"]),
    hasDriveKey: Boolean(process.env["GOOGLE_DRIVE_API_KEY"]),
  };
});

/** Lists Google Drive Master Allocation candidates via Lovable's Drive connector. */
export const listMasterAllocationsFromConnector = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireSession } = await import("./auth.server");
    await requireSession("Admin");
    const files = await listDriveSpreadsheetsViaConnector();
    const res = selectCurrentMonthMasterAllocation(files);
    return {
      selected: toSerializableCandidate(res.selected),
      matchType: res.matchType,
      period: res.period,
      candidates: res.candidates.map(toSerializableCandidate),
    };
  },
);

/** Reads the current-month Master Allocation (or Daily Collections) via Lovable's connectors. */
export const fetchMahavtaarWorkspaceSheet = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      source: z.enum(["master", "collections"]),
      spreadsheetId: z.string().trim().min(10).optional(),
      tabTitle: z.string().trim().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./auth.server");
    const source = data.source;
    // Master Allocation contains the full portfolio and is an administrator-only source.
    await requireSession(source === "master" ? "Admin" : undefined);

    let targetId =
      data.spreadsheetId ||
      (source === "master" ? DEFAULT_PINNED_MASTER.id : DEFAULT_PINNED_COLLECTIONS.id);
    let fallbackName =
      source === "master" ? DEFAULT_PINNED_MASTER.name : DEFAULT_PINNED_COLLECTIONS.name;
    let matchType: "EXACT_CURRENT_PERIOD" | "LATEST_MASTER_FALLBACK" | "PINNED_DEFAULT" =
      "PINNED_DEFAULT";
    let periodLabel = "";
    let candidates: Array<{
      id: string;
      name: string;
      modifiedTime: string | null;
      webViewLink: string | null;
    }> = [];

    if (source === "master") {
      const files = await listDriveSpreadsheetsViaConnector().catch(() => []);
      const selection = selectCurrentMonthMasterAllocation(files);
      periodLabel = selection.period.periodLabel;
      candidates = selection.candidates.map(toSerializableCandidate);

      if (!data.spreadsheetId) {
        targetId = selection.selected.id;
        fallbackName = selection.selected.name;
        matchType = selection.matchType;
      } else {
        const chosen = files.find((f) => f.id === data.spreadsheetId);
        if (chosen) fallbackName = chosen.name;
      }
    }

    const preferredTab = data.tabTitle || (source === "master" ? "Data" : "Collections");
    const resolvedMeta = await resolveTabViaConnector(targetId, preferredTab).catch(() => ({
      spreadsheetTitle: undefined,
      sheetTitle: preferredTab,
    }));

    const escapedTab = `'${resolvedMeta.sheetTitle.replace(/'/g, "''")}'`;
    const range = `${escapedTab}!A1:GU`;

    const [sheet, file] = await Promise.all([
      gatewayRequest<{ range?: string; values?: Array<Array<string | number | boolean | null>> }>(
        SHEETS_GATEWAY,
        `/spreadsheets/${encodeURIComponent(targetId)}/values/${encodeURIComponent(range)}`,
        "GOOGLE_SHEETS_API_KEY",
      ),
      gatewayRequest<{
        id?: string;
        name?: string;
        modifiedTime?: string;
        webViewLink?: string;
      }>(
        DRIVE_GATEWAY,
        `/files/${encodeURIComponent(targetId)}?fields=id,name,mimeType,modifiedTime,webViewLink&supportsAllDrives=true`,
        "GOOGLE_DRIVE_API_KEY",
      ).catch(() => null),
    ]);

    const rawValues = Array.isArray(sheet?.values) ? sheet.values : [];
    const values: Array<Array<string | number | boolean | null>> = rawValues.map((row) =>
      Array.isArray(row)
        ? row.map((cell) =>
            cell === null ||
            cell === undefined ||
            typeof cell === "string" ||
            typeof cell === "number" ||
            typeof cell === "boolean"
              ? (cell ?? null)
              : String(cell),
          )
        : [],
    );
    if (values.length < 2) {
      throw new Error(`${fallbackName} has no data rows in ${resolvedMeta.sheetTitle}.`);
    }

    return {
      source,
      spreadsheetId: targetId,
      spreadsheetName: file?.name || resolvedMeta.spreadsheetTitle || fallbackName,
      sheetTitle: resolvedMeta.sheetTitle,
      modifiedTime: file?.modifiedTime || null,
      webViewLink: file?.webViewLink || `https://docs.google.com/spreadsheets/d/${targetId}/edit`,
      range: sheet?.range || range,
      values,
      rowCount: Math.max(0, values.length - 1),
      fetchedAt: new Date().toISOString(),
      matchType,
      periodLabel,
      candidates,
    };
  });

/**
 * Appends validated rows to an explicitly selected Mahavtaar worksheet.
 * This is intentionally an append-only primitive; callers must not treat it as
 * an upsert until agreement-ID deduplication and retry/idempotency are implemented.
 */
export const appendMahavtaarWorkspaceRows = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      source: z.enum(["master", "collections"]),
      spreadsheetId: z.string().trim().min(10).max(200),
      tabTitle: z.string().trim().min(1).max(100),
      rows: z.array(
        z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).min(1).max(200),
      ).min(1).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./auth.server");
    await requireSession(data.source === "master" ? "Admin" : undefined);

    const meta = await resolveTabViaConnector(data.spreadsheetId, data.tabTitle);
    if (meta.sheetTitle.toLowerCase() !== data.tabTitle.toLowerCase()) {
      throw new Error("The requested worksheet was not found. No rows were written.");
    }

    const range = `'${meta.sheetTitle.replace(/'/g, "''")}'!A:GU`;
    const params = new URLSearchParams({
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    });
    const result = await gatewayWriteRequest<{
      updates?: { updatedRows?: number; updatedRange?: string };
    }>(
      SHEETS_GATEWAY,
      `/spreadsheets/${encodeURIComponent(data.spreadsheetId)}/values/${encodeURIComponent(range)}:append?${params.toString()}`,
      "GOOGLE_SHEETS_API_KEY",
      "POST",
      { majorDimension: "ROWS", values: data.rows },
    );

    return {
      success: true,
      updatedRows: result.updates?.updatedRows ?? 0,
      updatedRange: result.updates?.updatedRange ?? null,
      spreadsheetId: data.spreadsheetId,
      sheetTitle: meta.sheetTitle,
      writtenAt: new Date().toISOString(),
    };
  });

/**
 * Updates existing worksheet rows by Agreement ID. Ambiguous or missing IDs
 * are rejected before any write, so a retry cannot append duplicate loans.
 */
export const updateMahavtaarWorkspaceRows = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      source: z.enum(["master", "collections"]),
      spreadsheetId: z.string().trim().min(10).max(200),
      tabTitle: z.string().trim().min(1).max(100),
      updates: z.array(z.object({
        agreementId: z.string().trim().min(1).max(200),
        values: z.record(z.string().max(100), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      }).refine((item) => Object.keys(item.values).length > 0, "At least one field is required.")).min(1).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const { requireSession } = await import("./auth.server");
    await requireSession(data.source === "master" ? "Admin" : undefined);

    const meta = await resolveTabViaConnector(data.spreadsheetId, data.tabTitle);
    if (meta.sheetTitle.toLowerCase() !== data.tabTitle.toLowerCase()) {
      throw new Error("The requested worksheet was not found. No rows were updated.");
    }
    const escapedTab = "'" + meta.sheetTitle.replace(/'/g, "''") + "'";
    const readRange = escapedTab + "!A1:GU";
    const sheet = await gatewayRequest<{ values?: Array<Array<string | number | boolean | null>> }>(
      SHEETS_GATEWAY,
      "/spreadsheets/" + encodeURIComponent(data.spreadsheetId) + "/values/" + encodeURIComponent(readRange),
      "GOOGLE_SHEETS_API_KEY",
    );
    const rows = Array.isArray(sheet.values) ? sheet.values : [];
    if (rows.length < 2) throw new Error("The worksheet has no data rows.");

    const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const headers = rows[0].map((value) => String(value ?? "").trim());
    const agreementAliases = ["agreementid", "agreementno", "agreementnumber", "loanid", "accountno"];
    const agreementColumn = headers.findIndex((header) => agreementAliases.includes(normalize(header)));
    if (agreementColumn < 0) throw new Error("Agreement ID column was not found. No rows were updated.");

    const rowIndexByAgreement = new Map<string, number[]>();
    for (let index = 1; index < rows.length; index++) {
      const id = String(rows[index]?.[agreementColumn] ?? "").trim();
      if (!id) continue;
      const matches = rowIndexByAgreement.get(id) ?? [];
      matches.push(index + 1);
      rowIndexByAgreement.set(id, matches);
    }

    const columnIndexByName = new Map<string, number>();
    headers.forEach((header, index) => {
      const key = normalize(header);
      if (key && !columnIndexByName.has(key)) columnIndexByName.set(key, index);
    });
    const columnLetter = (zeroBased: number) => {
      let value = zeroBased + 1;
      let result = "";
      while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
      }
      return result;
    };

    const dataValues: Array<{ range: string; values: Array<Array<string | number | boolean | null>> }> = [];
    const missing: string[] = [];
    const ambiguous: string[] = [];
    for (const item of data.updates) {
      const rowMatches = rowIndexByAgreement.get(item.agreementId) ?? [];
      if (rowMatches.length === 0) { missing.push(item.agreementId); continue; }
      if (rowMatches.length > 1) { ambiguous.push(item.agreementId); continue; }
      for (const [field, value] of Object.entries(item.values)) {
        if (field.endsWith("_source")) continue;
        const column = columnIndexByName.get(normalize(field));
        if (column === undefined) throw new Error("Column not found for field: " + field + ". No rows were updated.");
        dataValues.push({
          range: escapedTab + "!" + columnLetter(column) + rowMatches[0],
          values: [[value]],
        });
      }
    }
    if (missing.length || ambiguous.length) {
      throw new Error(
        (missing.length ? "Agreement IDs not found: " + missing.slice(0, 10).join(", ") + ". " : "") +
        (ambiguous.length ? "Duplicate Agreement IDs; update refused: " + ambiguous.slice(0, 10).join(", ") + "." : "") +
        " No rows were updated.",
      );
    }
    if (dataValues.length === 0) throw new Error("No writable fields were supplied.");

    const result = await gatewayWriteRequest<{ totalUpdatedCells?: number; totalUpdatedRows?: number }>(
      SHEETS_GATEWAY,
      "/spreadsheets/" + encodeURIComponent(data.spreadsheetId) + "/values:batchUpdate",
      "GOOGLE_SHEETS_API_KEY",
      "POST",
      { valueInputOption: "RAW", data: dataValues },
    );
    return { success: true, updatedCells: result.totalUpdatedCells ?? 0, updatedRows: result.totalUpdatedRows ?? 0 };
  });
