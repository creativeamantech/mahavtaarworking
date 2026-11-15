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
