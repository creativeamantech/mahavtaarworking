import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SOURCES = {
  master: {
    id: "1w4ROwnbOmDlzCOfLAuWIQRpKQR3sa3f8GNDGFqb-P_Q",
    name: "Mahavtaar Master Allocation November 2026",
    range: "Data!A1:GU",
  },
  collections: {
    id: "1AXLakW3subO9H-O9iWIpXJyjT4JLXRTG5uiL3dWsY5g",
    name: "Mahavtaar Daily Collection",
    range: "Collections!A1:AA",
  },
} as const;

type SourceKey = keyof typeof SOURCES;

async function gatewayRequest(base: string, path: string, apiKeyName: string) {
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
  return response.json();
}

/** Read-only access to the two approved workspace spreadsheets. */
export const fetchMahavtaarWorkspaceSheet = createServerFn({ method: "GET" })
  .inputValidator(z.object({ source: z.enum(["master", "collections"]) }))
  .handler(async ({ data }) => {
    const { requireSession } = await import("./auth.server");
    await requireSession();
    const source: SourceKey = data.source;
    const config = SOURCES[source];
    const sheetsBase = "https://connector-gateway.lovable.dev/google_sheets/v4";
    const driveBase = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

    const [sheet, file] = await Promise.all([
      gatewayRequest(
        sheetsBase,
        `/spreadsheets/${config.id}/values/${encodeURIComponent(config.range)}`,
        "GOOGLE_SHEETS_API_KEY",
      ),
      gatewayRequest(
        driveBase,
        `/files/${config.id}?fields=id,name,mimeType,modifiedTime,webViewLink`,
        "GOOGLE_DRIVE_API_KEY",
      ),
    ]);

    const values = Array.isArray(sheet?.values) ? sheet.values : [];
    if (values.length < 2) {
      throw new Error(`${config.name} has no data rows in ${config.range.split("!")[0]}.`);
    }

    return {
      source,
      spreadsheetId: config.id,
      spreadsheetName: file?.name || config.name,
      modifiedTime: file?.modifiedTime || null,
      webViewLink: file?.webViewLink || null,
      range: sheet?.range || config.range,
      values,
      rowCount: Math.max(0, values.length - 1),
      fetchedAt: new Date().toISOString(),
    };
  });
