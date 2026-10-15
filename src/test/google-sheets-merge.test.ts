import { describe, it, expect } from "vitest";
import { extractSheetInfo } from "../lib/googleSheets";
import { mergeMainIntoRecords, parseMainFile } from "../lib/fileParser";
import * as XLSX from "xlsx";

describe("Google Sheets Helper & Multi-File Merge Engine", () => {
  it("extracts spreadsheet ID and GID from diverse URL formats", () => {
    // Standard edit URL with GID
    const url1 =
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=12345";
    const info1 = extractSheetInfo(url1);
    expect(info1).not.toBeNull();
    expect(info1?.sheetId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(info1?.gid).toBe("12345");
    expect(info1?.isPublishedWeb).toBe(false);

    // Standard view URL without GID (defaulting to 0)
    const url2 =
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view";
    const info2 = extractSheetInfo(url2);
    expect(info2?.sheetId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(info2?.gid).toBe("0");

    // Published web link
    const url3 =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRExample123456789/pubhtml?gid=98765";
    const info3 = extractSheetInfo(url3);
    expect(info3?.sheetId).toBe("2PACX-1vRExample123456789");
    expect(info3?.gid).toBe("98765");
    expect(info3?.isPublishedWeb).toBe(true);

    // Raw Sheet ID
    const rawId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
    const info4 = extractSheetInfo(rawId);
    expect(info4?.sheetId).toBe(rawId);
    expect(info4?.gid).toBe("0");
  });

  it("merges multiple master data files cumulatively without dropping existing loans", () => {
    // Existing records in IndexedDB from File 1
    const existingRecords = [
      {
        agreementid: "LN1001",
        customer_name: "Amit Kumar",
        city: "DELHI",
        bom_bkt: 1,
        bom_pos: 50000,
        principal_outstanding: 50000,
        provisional_dac: 4500,
        feedback: "Spoke with borrower, promised payment",
      },
      {
        agreementid: "LN1002",
        customer_name: "Priya Sharma",
        city: "MUMBAI",
        bom_bkt: 2,
        bom_pos: 80000,
        principal_outstanding: 80000,
        provisional_dac: 0,
        feedback: "",
      },
    ];

    // Incoming records from File 2 (one existing updated, one completely new)
    const incomingRecords = [
      {
        agreementid: "LN1002", // updated
        customer_name: "Priya Sharma Updated",
        city: "MUMBAI",
        bom_bkt: 2,
        bom_pos: 75000,
        principal_outstanding: 75000,
      },
      {
        agreementid: "LN1003", // brand new loan
        customer_name: "Rajesh Verma",
        city: "BANGALORE",
        bom_bkt: 1,
        bom_pos: 60000,
        principal_outstanding: 60000,
      },
    ];

    const { mergedRows, newCount, updatedCount } = mergeMainIntoRecords(
      existingRecords as unknown as LoanRecord[],
      incomingRecords as unknown as LoanRecord[],
    );

    expect(newCount).toBe(1); // LN1003 is new
    expect(updatedCount).toBe(1); // LN1002 was updated

    // LN1002 should have updated POS, and LN1003 should be present
    const updatedLoan = mergedRows.find((r) => r.agreementid === "LN1002");
    expect(updatedLoan?.principal_outstanding).toBe(75000);

    const newLoan = mergedRows.find((r) => r.agreementid === "LN1003");
    expect(newLoan?.customer_name).toBe("Rajesh Verma");
  });

  it("parses CSV ArrayBuffer generated from Google Sheets with varied headers", () => {
    const csvContent = `Agreement ID,Customer Name,Bucket,POS,City,Executive Name\nAG-901,Vikas Gupta,1,45000,DELHI,Suresh`;
    const wb = XLSX.read(csvContent, { type: "string" });
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const parsed = parseMainFile(buffer);
    expect(parsed.length).toBe(1);
    expect(parsed[0].agreementid).toBe("AG-901");
    expect(parsed[0].customer_name).toBe("Vikas Gupta");
    expect(parsed[0].bom_bkt).toBe(1);
    expect(parsed[0].principal_outstanding).toBe(45000);
    expect(parsed[0].city).toBe("DELHI");
    expect(parsed[0].executive_name).toBe("Suresh");
  });
});
