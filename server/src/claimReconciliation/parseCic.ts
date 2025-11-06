// server/src/claimReconciliation/parseCic.ts

import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Normalize a column header for fuzzy matching */
function normHeader(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Date parsing that handles Excel serials, strings, and Date objects */
function parseDate(val: any): Date | null {
  if (!val) return null;

  if (val instanceof Date) return val;

  // Excel serial date
  if (typeof val === "number" && Number.isFinite(val)) {
    // Excel epoch (1900-01-01), Excel counts from 1
    const excelEpoch = new Date(1900, 0, 1);
    const days = val - 1;
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Try obvious day/month/year variants
    const parts = trimmed.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      // Heuristic: if first part > 12, treat as DD/MM/YYYY
      const first = Number(a);
      const second = Number(b);
      const third = Number(c);
      if (Number.isFinite(first) && Number.isFinite(second) && Number.isFinite(third)) {
        if (first > 12 && third > 31) {
          // e.g. 24/03/2025 → 2025-03-24
          return new Date(Date.UTC(third, second - 1, first));
        }
      }
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/** Parse amount from various formats */
function parseAmount(val: any): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.\-]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Header detection                                                   */
/* ------------------------------------------------------------------ */

type ClaimsHeaderMap = {
  memberNumber?: string;
  patientName?: string;
  serviceDate?: string;
  invoiceNumber?: string;
  claimType?: string;
  schemeName?: string;
  benefitDesc?: string;
  billedAmount?: string;
  currency?: string;
};

type RemittanceHeaderMap = {
  employerName?: string;
  patientName?: string;
  memberNumber?: string;
  claimNumber?: string;
  relationship?: string;
  serviceDate?: string;
  claimAmount?: string;
  paidAmount?: string;
  paymentNo?: string;
  paymentMode?: string;
};

function buildClaimsHeaderMap(firstRow: any): ClaimsHeaderMap {
  const map: ClaimsHeaderMap = {};
  const entries = Object.keys(firstRow || {});

  for (const rawKey of entries) {
    const n = normHeader(rawKey);

    // Member number
    if (!map.memberNumber) {
      if (
        n.includes("member") &&
        (n.includes("no") || n.includes("num") || n.includes("number") || n.includes("id"))
      ) {
        map.memberNumber = rawKey;
        continue;
      }
    }

    // Patient name
    if (!map.patientName) {
      if (n.includes("patient") && (n.includes("name") || n === "patient")) {
        map.patientName = rawKey;
        continue;
      }
    }

    // Service / claim date
    if (!map.serviceDate) {
      if (
        n.includes("date") &&
        (n.includes("service") || n.includes("claim") || n.includes("treatment") || n === "date")
      ) {
        map.serviceDate = rawKey;
        continue;
      }
    }

    // Invoice
    if (!map.invoiceNumber) {
      if (n.includes("invoice") || n === "invno" || n === "invoiceno") {
        map.invoiceNumber = rawKey;
        continue;
      }
    }

    // Claim type
    if (!map.claimType) {
      if (n.includes("claimtype") || (n.includes("type") && n.includes("claim"))) {
        map.claimType = rawKey;
        continue;
      }
    }

    // Scheme / plan
    if (!map.schemeName) {
      if (n.includes("scheme") || n.includes("plan")) {
        map.schemeName = rawKey;
        continue;
      }
    }

    // Benefit / description
    if (!map.benefitDesc) {
      if (n.includes("benefit") || n.includes("description") || n.includes("diagnosis")) {
        map.benefitDesc = rawKey;
        continue;
      }
    }

    // Billed / claim amount
    if (!map.billedAmount) {
      if (
        n.includes("amount") &&
        !n.includes("paid") && // avoid mixing with paid amount
        (n.includes("billed") ||
          n.includes("claim") ||
          n.includes("gross") ||
          n.includes("total") ||
          n.includes("charges"))
      ) {
        map.billedAmount = rawKey;
        continue;
      }
    }

    // Currency
    if (!map.currency) {
      if (n.includes("currency") || n === "cur" || n === "curr") {
        map.currency = rawKey;
        continue;
      }
    }
  }

  return map;
}

function buildRemittanceHeaderMap(firstRow: any): RemittanceHeaderMap {
  const map: RemittanceHeaderMap = {};
  const entries = Object.keys(firstRow || {});

  for (const rawKey of entries) {
    const n = normHeader(rawKey);

    if (!map.memberNumber) {
      if (
        n.includes("member") &&
        (n.includes("no") || n.includes("num") || n.includes("number") || n.includes("id"))
      ) {
        map.memberNumber = rawKey;
        continue;
      }
    }

    if (!map.patientName) {
      if (n.includes("patient") && (n.includes("name") || n === "patient")) {
        map.patientName = rawKey;
        continue;
      }
    }

    if (!map.employerName) {
      if (n.includes("employer") || n.includes("company")) {
        map.employerName = rawKey;
        continue;
      }
    }

    if (!map.claimNumber) {
      if (n.includes("claim") && (n.includes("no") || n.includes("num") || n.includes("number"))) {
        map.claimNumber = rawKey;
        continue;
      }
    }

    if (!map.relationship) {
      if (n.includes("relationship") || n.includes("relat")) {
        map.relationship = rawKey;
        continue;
      }
    }

    if (!map.serviceDate) {
      if (
        n.includes("date") &&
        (n.includes("service") || n.includes("claim") || n.includes("treatment") || n === "date")
      ) {
        map.serviceDate = rawKey;
        continue;
      }
    }

    if (!map.claimAmount) {
      if (
        n.includes("amount") &&
        (n.includes("claim") || n.includes("gross") || n.includes("billed") || n.includes("total"))
      ) {
        map.claimAmount = rawKey;
        continue;
      }
    }

    if (!map.paidAmount) {
      if (
        n.includes("amount") &&
        (n.includes("paid") || n.includes("settled") || n.includes("net"))
      ) {
        map.paidAmount = rawKey;
        continue;
      }
    }

    if (!map.paymentNo) {
      if (n.includes("payment") && (n.includes("no") || n.includes("number") || n.includes("ref"))) {
        map.paymentNo = rawKey;
        continue;
      }
    }

    if (!map.paymentMode) {
      if (n.includes("mode") || n.includes("method") || n.includes("channel")) {
        map.paymentMode = rawKey;
        continue;
      }
    }
  }

  return map;
}

/* ------------------------------------------------------------------ */
/* Claims file parser                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse Claims Submitted Excel file.
 * We now accept a wide range of header names and formats (CIC, UAP, etc.).
 */
export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });

  if (!rows.length) return [];

  const headerMap = buildClaimsHeaderMap(rows[0]);

  const claims: ClaimRow[] = [];

  for (const row of rows) {
    const memberRaw =
      (headerMap.memberNumber && row[headerMap.memberNumber]) ??
      row["Member Number"] ??
      row["Member No"] ??
      row["Member No."];

    const serviceDateRaw =
      (headerMap.serviceDate && row[headerMap.serviceDate]) ?? row["Service Date"];

    const billedRaw =
      (headerMap.billedAmount && row[headerMap.billedAmount]) ??
      row["Billed Amount"] ??
      row["Amount"] ??
      row["Claim Amount"];

    // Skip rows that are completely empty
    if (!memberRaw && !serviceDateRaw && !billedRaw) continue;

    const serviceDate = parseDate(serviceDateRaw);
    if (!serviceDate) continue;

    const billedAmount = parseAmount(billedRaw);
    if (!billedAmount || billedAmount <= 0) continue;

    const patientNameRaw =
      (headerMap.patientName && row[headerMap.patientName]) ?? row["Patient Name"];

    const invoiceRaw =
      (headerMap.invoiceNumber && row[headerMap.invoiceNumber]) ?? row["Invoice Number"];

    const claimTypeRaw =
      (headerMap.claimType && row[headerMap.claimType]) ?? row["Claim Type"];

    const schemeNameRaw =
      (headerMap.schemeName && row[headerMap.schemeName]) ?? row["Scheme Name"];

    const benefitRaw =
      (headerMap.benefitDesc && row[headerMap.benefitDesc]) ??
      row["Benefit Description"] ??
      row["Benefit"];

    const currencyRaw =
      (headerMap.currency && row[headerMap.currency]) ?? row["Currency"] ?? "SSP";

    claims.push({
      memberNumber: String(memberRaw ?? "").trim(),
      patientName: String(patientNameRaw ?? "").trim() || undefined,
      serviceDate,
      invoiceNumber: String(invoiceRaw ?? "").trim() || undefined,
      claimType: String(claimTypeRaw ?? "").trim() || undefined,
      schemeName: String(schemeNameRaw ?? "").trim() || undefined,
      benefitDesc: String(benefitRaw ?? "").trim() || undefined,
      billedAmount,
      currency: String(currencyRaw ?? "SSP").trim() || "SSP",
    });
  }

  console.log(
    "[claim-recon] Parsed claims file:",
    claims.length,
    "valid rows"
  );
  if (!claims.length && rows.length) {
    console.warn(
      "[claim-recon] Claims file had rows but none were valid. Headers detected:",
      Object.keys(rows[0])
    );
  }

  return claims;
}

/* ------------------------------------------------------------------ */
/* Remittance file parser                                             */
/* ------------------------------------------------------------------ */

export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });

  if (!rows.length) return [];

  const headerMap = buildRemittanceHeaderMap(rows[0]);

  const remittances: RemittanceRow[] = [];

  for (const row of rows) {
    const memberRaw =
      (headerMap.memberNumber && row[headerMap.memberNumber]) ??
      row["Member Number"] ??
      row["Member No"] ??
      row["Member No."];

    const serviceDateRaw =
      (headerMap.serviceDate && row[headerMap.serviceDate]) ?? row["Service Date"];

    if (!memberRaw && !serviceDateRaw) continue;

    const serviceDate = parseDate(serviceDateRaw);
    if (!serviceDate) continue;

    const paidRaw =
      (headerMap.paidAmount && row[headerMap.paidAmount]) ??
      row["Paid Amount"] ??
      row["Amount Paid"];

    const claimAmountRaw =
      (headerMap.claimAmount && row[headerMap.claimAmount]) ??
      row["Claim Amount"] ??
      row["Claimed Amount"] ??
      paidRaw;

    const paidAmount = parseAmount(paidRaw);
    const claimAmount = parseAmount(claimAmountRaw || paidRaw);

    const employerRaw =
      (headerMap.employerName && row[headerMap.employerName]) ??
      row["Employer Name"] ??
      row["Employer"];

    const patientNameRaw =
      (headerMap.patientName && row[headerMap.patientName]) ?? row["Patient Name"];

    const claimNumberRaw =
      (headerMap.claimNumber && row[headerMap.claimNumber]) ??
      row["Claim Number"] ??
      row["Claim No"];

    const relationshipRaw =
      (headerMap.relationship && row[headerMap.relationship]) ?? row["Relationship"];

    const paymentNoRaw =
      (headerMap.paymentNo && row[headerMap.paymentNo]) ??
      row["Payment No"] ??
      row["Payment Number"];

    const paymentModeRaw =
      (headerMap.paymentMode && row[headerMap.paymentMode]) ??
      row["Payment Mode"] ??
      row["Mode"];

    remittances.push({
      employerName: String(employerRaw ?? "").trim() || undefined,
      patientName: String(patientNameRaw ?? "").trim() || undefined,
      memberNumber: String(memberRaw ?? "").trim(),
      claimNumber: String(claimNumberRaw ?? "").trim() || undefined,
      relationship: String(relationshipRaw ?? "").trim() || undefined,
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo: String(paymentNoRaw ?? "").trim() || undefined,
      paymentMode: String(paymentModeRaw ?? "").trim() || undefined,
    });
  }

  console.log(
    "[claim-recon] Parsed remittance file:",
    remittances.length,
    "rows"
  );
  if (!remittances.length && rows.length) {
    console.warn(
      "[claim-recon] Remittance file had rows but none were valid. Headers detected:",
      Object.keys(rows[0])
    );
  }

  return remittances;
}
