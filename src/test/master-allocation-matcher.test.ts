import { describe, it, expect } from "vitest";
import {
  DEFAULT_PINNED_MASTER,
  getCurrentPeriodTarget,
  selectCurrentMonthMasterAllocation,
  type DriveSpreadsheetCandidate,
} from "../lib/masterAllocationMatcher";

describe("Current Month & Year Master Allocation Matcher", () => {
  it("computes the period target for the given date", () => {
    const nov2026 = getCurrentPeriodTarget(new Date("2026-11-14T12:00:00Z"));
    expect(nov2026.year).toBe(2026);
    expect(nov2026.monthName).toBe("November");
    expect(nov2026.monthShort).toBe("Nov");
    expect(nov2026.monthNumber).toBe("11");
    expect(nov2026.periodLabel).toBe("November 2026");

    const jan2027 = getCurrentPeriodTarget(new Date("2027-01-05T12:00:00Z"));
    expect(jan2027.periodLabel).toBe("January 2027");
  });

  it("selects the exact current month and current year Master Allocation over prior months, wrong years, and collections", () => {
    const files: DriveSpreadsheetCandidate[] = [
      {
        id: "col-1",
        name: "Mahavtaar Daily Collection November 2026",
        modifiedTime: "2026-11-14T10:00:00Z",
      },
      {
        id: "old-year",
        name: "Mahavtaar Master Allocation November 2025",
        modifiedTime: "2025-11-15T10:00:00Z",
      },
      {
        id: "prev-month",
        name: "Mahavtaar Master Allocation October 2026",
        modifiedTime: "2026-10-30T10:00:00Z",
      },
      {
        id: "curr-month",
        name: "Mahavtaar Master Allocation November 2026",
        modifiedTime: "2026-11-01T10:00:00Z",
      },
    ];

    const result = selectCurrentMonthMasterAllocation(files, new Date("2026-11-14T12:00:00Z"));
    expect(result.matchType).toBe("EXACT_CURRENT_PERIOD");
    expect(result.selected.id).toBe("curr-month");
    expect(result.period.periodLabel).toBe("November 2026");
  });

  it("supports abbreviated month names and numeric month-year naming conventions", () => {
    const files: DriveSpreadsheetCandidate[] = [
      { id: "oct", name: "Master Allocation Oct 2026", modifiedTime: "2026-10-20T00:00:00Z" },
      { id: "dec", name: "Master Allocation 12-2026", modifiedTime: "2026-12-01T00:00:00Z" },
    ];

    const result = selectCurrentMonthMasterAllocation(files, new Date("2026-12-10T12:00:00Z"));
    expect(result.matchType).toBe("EXACT_CURRENT_PERIOD");
    expect(result.selected.id).toBe("dec");
  });

  it("falls back to latest Master Allocation or pinned default when current period sheet does not exist yet", () => {
    const onlyOlder: DriveSpreadsheetCandidate[] = [
      {
        id: "oct",
        name: "Mahavtaar Master Allocation October 2026",
        modifiedTime: "2026-10-28T00:00:00Z",
      },
      {
        id: "col",
        name: "Mahavtaar Daily Collection",
        modifiedTime: "2026-11-14T00:00:00Z",
      },
    ];

    const fallbackLatest = selectCurrentMonthMasterAllocation(
      onlyOlder,
      new Date("2026-11-14T12:00:00Z"),
    );
    expect(fallbackLatest.matchType).toBe("LATEST_MASTER_FALLBACK");
    expect(fallbackLatest.selected.id).toBe("oct");

    const fallbackPinned = selectCurrentMonthMasterAllocation([], new Date("2026-11-14T12:00:00Z"));
    expect(fallbackPinned.matchType).toBe("PINNED_DEFAULT");
    expect(fallbackPinned.selected.id).toBe(DEFAULT_PINNED_MASTER.id);
  });
});
