import { describe, it, expect, beforeEach } from "vitest";
import {
  formatSyncRelativeTime,
  getDefaultMasterSyncMeta,
  getMasterSyncMeta,
  saveMasterSyncMeta,
  sheetValuesToXlsxBuffer,
} from "../lib/masterSyncStore";
import * as XLSX from "xlsx";

describe("Master Sheets Sync Store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("formats relative sync timestamps accurately", () => {
    const now = Date.UTC(2026, 10, 14, 18, 30, 0);

    expect(formatSyncRelativeTime(null, now).shortLabel).toBe("Not synced");

    const justNow = new Date(now - 15 * 1000).toISOString();
    expect(formatSyncRelativeTime(justNow, now).shortLabel).toBe("Just now");

    const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
    expect(formatSyncRelativeTime(fiveMinsAgo, now).shortLabel).toBe("5m ago");
  });

  it("persists and updates master sync metadata in localStorage", () => {
    const initial = getMasterSyncMeta();
    expect(initial.lastSyncedAt).toBeNull();
    expect(initial.spreadsheetId).toBe(getDefaultMasterSyncMeta().spreadsheetId);

    const timestamp = "2026-11-14T18:30:00.000Z";
    saveMasterSyncMeta({
      lastSyncedAt: timestamp,
      rowCount: 1420,
      spreadsheetName: "Mahavtaar Master Allocation November 2026",
      lastError: null,
    });

    const updated = getMasterSyncMeta();
    expect(updated.lastSyncedAt).toBe(timestamp);
    expect(updated.rowCount).toBe(1420);
    expect(updated.lastError).toBeNull();
  });

  it("converts 2D Google Sheets values into a readable XLSX ArrayBuffer", () => {
    const buffer = sheetValuesToXlsxBuffer(
      [
        ["AGREEMENTID", "CUSTOMER_NAME", "BOM_BKT"],
        ["LN-100", "Rahul Sharma", 1],
      ],
      "Data",
    );
    const wb = XLSX.read(buffer, { type: "array" });
    expect(wb.SheetNames[0]).toBe("Data");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Data"]!);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["AGREEMENTID"]).toBe("LN-100");
  });
});
