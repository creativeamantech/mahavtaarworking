// @ts-nocheck
import * as XLSX from "xlsx";
import { LoanRecord } from "../types/domain";

export function parseMainFile(fileBuffer: ArrayBuffer) {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  }) as LoanRecord[];

  return rows
    .map((row) => {
      const agreementid = String(
        row["agreementid"] ||
          row["AGREEMENTID"] ||
          row["Agreement ID"] ||
          row["agreement_id"] ||
          row["AgreementId"] ||
          row["Loan ID"] ||
          row["loan_id"] ||
          row["Loan Id"] ||
          row["Account No"] ||
          "",
      ).trim();

      const agreement_no = String(
        row["AGREEMENTNO"] ||
          row["AGREEMENT_NO"] ||
          row["Agreement No"] ||
          row["agreement_no"] ||
          row["loan_id"] ||
          row["Loan No"] ||
          agreementid,
      ).trim();

      const customer_name = String(
        row["CUSTOMERNAME"] ||
          row["Customer Name"] ||
          row["CUSTOMER_NAME"] ||
          row["customer_name"] ||
          row["customername"] ||
          row["Client Name"] ||
          row["Name"] ||
          "",
      ).trim();

      const bom_bkt =
        parseInt(
          row["bom_bkt"] || row["BOM BKT"] || row["Bucket"] || row["bucket"] || row["Bkt"] || "1",
        ) || 1;
      const emi_amt =
        parseFloat(row["emi_amt"] || row["EMI"] || row["emi"] || row["Emi Amount"] || "0") || 0;
      const principal_outstanding =
        parseFloat(
          row["principal_outstanding"] ||
            row["POS"] ||
            row["pos"] ||
            row["BOM POS"] ||
            row["Principal Outstanding"] ||
            "0",
        ) || 0;
      const bcc_pending = parseFloat(row["bcc_pending"] || row["BCC"] || row["bcc"] || "0") || 0;
      const penal_pending =
        parseFloat(row["penal_pending"] || row["Penal"] || row["penal"] || "0") || 0;
      const approx_forclosure =
        parseFloat(
          row["Approx Forclosure"] || row["approx_forclosure"] || row["Foreclosure"] || "0",
        ) || 0;
      const state = String(row["State"] || row["state"] || row["STATE"] || "")
        .trim()
        .toUpperCase();
      const city = String(row["City"] || row["city"] || row["CITY"] || "")
        .trim()
        .toUpperCase();

      const executive_name = String(
        row["Final EX. Name"] ||
          row["Final EX. name"] ||
          row["Final EX.NAME"] ||
          row["EX. Name"] ||
          row["EX. name"] ||
          row["EX.NAME"] ||
          row["Final Executive Name"] ||
          row["final_executive_name"] ||
          row["Final Executive"] ||
          row["final_executive"] ||
          row["Executive Name"] ||
          row["executive_name"] ||
          row["Executive"] ||
          row["executive"] ||
          row["FOS Name"] ||
          row["FOS"] ||
          "",
      ).trim();

      const allocation_date =
        row["Final Allocation Date"] ||
        row["final_allocation_date"] ||
        row["Allocation Date"] ||
        row["allocation_date"] ||
        row["AllocationDate"] ||
        null;

      const dac = parseFloat(row["DAC"] || row["dac"] || row["Collected DAC"] || "0") || 0;
      const ecs = parseFloat(row["ECS"] || row["ecs"] || "0") || 0;
      const special = parseFloat(row["Special"] || row["special"] || "0") || 0;
      const new_total =
        parseFloat(row["New Total"] || row["new_total"] || "0") || dac + ecs + special;
      const settlement_approved_amt =
        row["Settlement Approved Amount"] != null
          ? parseFloat(row["Settlement Approved Amount"])
          : null;
      const last_month_paid_flag = Boolean(
        row["Last Month Paid Flag"] || row["last_month_paid_flag"],
      );

      return {
        ...row,
        agreementid,
        agreement_no,
        customer_name,
        bom_bkt,
        bom_pos: principal_outstanding,
        emi_amt,
        principal_outstanding,
        bcc_pending,
        penal_pending,
        approx_forclosure,
        state,
        city,
        executive_name,
        allocation_date,
        dac,
        ecs,
        special,
        new_total,
        settlement_approved_amt,
        last_month_paid_flag,
        dac_source: "FILE" as const,
        ecs_source: "FILE" as const,
        special_source: "FILE" as const,
      };
    })
    .filter((r) => r.agreementid);
}

/**
 * Merges incoming master rows into existing ledger records.
 * Retains all previous records not in the incoming batch,
 * updates matching records while preserving operational state (provisional collections, feedback, conflict tags),
 * and appends completely new loan records.
 */
export function mergeMainIntoRecords(
  existingRecords: LoanRecord[],
  incomingMainRows: LoanRecord[],
) {
  const existingMap = new Map<string, LoanRecord>();
  for (const rec of existingRecords) {
    if (rec.agreementid) {
      existingMap.set(String(rec.agreementid).trim(), rec);
    }
  }

  let newCount = 0;
  let updatedCount = 0;

  const mergedRows = incomingMainRows.map((newRec) => {
    const key = String(newRec.agreementid).trim();
    const existing = existingMap.get(key);
    if (existing) {
      updatedCount++;
      return {
        ...existing,
        ...newRec,
        // Preserve user provisional inputs, notes, feedback, and conflict states if present in existing
        provisional_dac:
          existing.provisional_dac !== undefined && existing.provisional_dac !== 0
            ? existing.provisional_dac
            : newRec.provisional_dac || 0,
        provisional_dac_raw: existing.provisional_dac_raw ?? newRec.provisional_dac_raw,
        is_conflict: existing.is_conflict ?? newRec.is_conflict,
        feedback: existing.feedback || newRec.feedback,
        settlement_approved_amt: newRec.settlement_approved_amt ?? existing.settlement_approved_amt,
      };
    } else {
      newCount++;
      return newRec;
    }
  });

  return { mergedRows, newCount, updatedCount };
}

export function parsePaidFile(fileBuffer: ArrayBuffer) {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  }) as LoanRecord[];

  return rows
    .map((row) => {
      const sfdc = parseFloat(row["SFDC"] || row["sfdc"]) || 0;
      const online = parseFloat(row["Online"] || row["online"]) || 0;
      return {
        agreementid: String(row["AGREEMENTID"] || row["agreementid"] || "").trim(),
        dac: sfdc + online,
        ecs: parseFloat(row["ECS"] || row["ecs"]) || 0,
        special: parseFloat(row["Special Pres"] || row["Special"] || row["special"]) || 0,
      };
    })
    .filter((r) => r.agreementid);
}

export function mergePaidIntoRecords(existingRecords: LoanRecord[], paidRows: LoanRecord[]) {
  const paidMap: Record<string, unknown> = {};
  paidRows.forEach((r) => {
    paidMap[r.agreementid] = r;
  });

  return existingRecords.map((rec) => {
    const match = paidMap[String(rec.agreementid)];
    if (match) {
      let newProv = rec.provisional_dac;
      let is_conflict = rec.is_conflict || false;

      const rawProv = rec.provisional_dac_raw || rec.provisional_dac;
      if (rawProv && match.dac > 0) {
        if (rawProv === match.dac) {
          newProv = 0;
          is_conflict = false;
        } else {
          is_conflict = true;
        }
      }

      return {
        ...rec,
        ...match,
        dac: match.dac,
        ecs: match.ecs,
        special: match.special,
        dac_source: "PAID_FILE",
        ecs_source: "PAID_FILE",
        special_source: "PAID_FILE",
        provisional_dac: newProv,
        is_conflict,
      };
    }
    return rec;
  });
}

export function parseAdditionalFile(fileBuffer: ArrayBuffer) {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  }) as LoanRecord[];

  const aggregated: Record<string, { amount: number; dates: string[]; firstRow: any }> = {};

  rows.forEach((row) => {
    const agreementid = String(
      row["AGREEMENTID"] || row["agreementid"] || row["Loan ID"] || row["loan_id"] || "",
    ).trim();
    if (!agreementid) return;

    // Attempt to read generic collection amount
    const amt =
      parseFloat(
        row["Amount"] ||
          row["amount"] ||
          row["Collection Amount"] ||
          row["collection_amount"] ||
          row["Collected"] ||
          row["DAC"] ||
          row["dac"] ||
          row["Provisional Amount"],
      ) || 0;

    let dt = String(
      row["Date"] || row["date"] || row["Collection Date"] || row["collection_date"] || "",
    ).trim();
    if (!dt) dt = "Unknown";

    if (!aggregated[agreementid]) aggregated[agreementid] = { amount: 0, dates: [], firstRow: row };
    aggregated[agreementid].amount += amt;
    if (dt !== "Unknown" && !aggregated[agreementid].dates.includes(dt)) {
      aggregated[agreementid].dates.push(dt);
    }
  });

  return Object.entries(aggregated).map(([agreementid, data]) => ({
    ...data.firstRow,
    agreementid,
    provisional_dac: data.amount,
    collection_dates: data.dates.length > 0 ? data.dates.join(", ") : "Unknown",
  }));
}

export function mergeAdditionalIntoRecords(
  existingRecords: LoanRecord[],
  additionalRows: LoanRecord[],
) {
  const additionalMap: Record<string, unknown> = {};
  additionalRows.forEach((r) => {
    additionalMap[r.agreementid] = r;
  });

  let newConflicts = 0;
  let newValidProv = 0;
  let alreadyCorrected = 0;
  let alreadyConfirmed = 0;

  const merged = existingRecords.map((rec) => {
    const match = additionalMap[String(rec.agreementid)];
    if (match) {
      if (rec.dac_source === "CORRECTED" || rec.is_corrected) {
        alreadyCorrected++;
        return rec; // Rule: REJECT/IGNORE already corrected records. Do not overwrite or recreate conflict.
      }

      let provisional_dac = match.provisional_dac;
      const currentConfirmedDac = rec.dac || 0;
      let is_conflict = false;

      if (currentConfirmedDac === provisional_dac && currentConfirmedDac > 0) {
        // Exact confirmation, so zero out provisional
        provisional_dac = 0;
        alreadyConfirmed++;
      } else if (currentConfirmedDac > 0 && currentConfirmedDac !== provisional_dac) {
        // Mismatch
        is_conflict = true;
        newConflicts++;
      } else {
        newValidProv++;
      }

      return {
        ...rec,
        ...match,
        provisional_dac: provisional_dac,
        provisional_dac_raw: match.provisional_dac, // store raw just in case
        provisional_collection_dates: match.collection_dates,
        is_conflict,
      };
    }
    return rec;
  });

  return {
    merged,
    stats: {
      newConflicts,
      newValidProv,
      alreadyCorrected,
      alreadyConfirmed,
      uniqueLoans: additionalRows.length,
    },
  };
}

export function parseCorrectedFile(fileBuffer: ArrayBuffer) {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  }) as LoanRecord[];

  return rows
    .map((row) => ({
      agreementid: String(
        row["AGREEMENTID"] || row["agreementid"] || row["Loan ID"] || row["loan_id"] || "",
      ).trim(),
      corrected_dac:
        parseFloat(
          row["Confirmed DAC"] ||
            row["confirmed_dac"] ||
            row["DAC"] ||
            row["dac"] ||
            row["Corrected DAC"] ||
            row["corrected_dac"],
        ) || 0,
    }))
    .filter((r) => r.agreementid);
}

export function mergeCorrectedIntoRecords(
  existingRecords: LoanRecord[],
  correctedRows: LoanRecord[],
) {
  const map: Record<string, unknown> = {};
  correctedRows.forEach((r) => {
    map[r.agreementid] = r;
  });

  let matched = 0;
  const merged = existingRecords.map((rec) => {
    const match = map[String(rec.agreementid)];
    if (match) {
      matched++;
      return {
        ...rec,
        ...match,
        dac: match.corrected_dac,
        dac_source: "CORRECTED",
        is_corrected: true,
        provisional_dac: 0,
        is_conflict: false,
      };
    }
    return rec;
  });
  return { merged, matched, total: correctedRows.length };
}
export function detectColumns(fileBuffer: ArrayBuffer) {
  const wb = XLSX.read(fileBuffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as LoanRecord[];
  if (rows.length === 0) return { headers: [], rowCount: 0, sample: [] };
  const headers = Object.keys(rows[0]);
  return { headers, rowCount: rows.length, sample: rows.slice(0, 3) };
}
