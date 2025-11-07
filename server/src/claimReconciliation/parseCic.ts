// server/src/claimReconciliation/parseCic.ts

import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/**
 * Helpers
 */

function norm(val: any): string {
  return String(val ?? "").trim().toLowerCase();
}

function parseDate(val: any): Date | null {
  if (!val) return null;

  // Already a Date
  if (val instanceof Date) return val;

  // Excel serial date
  if (typeof val === "number") {
    // Excel dates are days since 1900-01-01 (with the classic off-by-one)
    const excelEpoch = new Date(1900, 0, 1);
    const days = val - 1;
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // String
  if (typeof val === "string") {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function parseAmount(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function asOptionalString(val: any): string | undefined {
  const s = String(val ?? "").trim();
  return s ? s : undefined;
}

/**
 * Find the index of the header row by scanning for key column titles.
 * We scan every row and pick the first that looks like:
 *  - has a member column
 *  - has a date column
 *  - has an amount column
 */
function findHeaderRowIndex(rows: any[][], detectors: ((rowTexts: string[]) => boolean)[]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const texts = row.map(norm);
    if (detectors.some((fn) => fn(texts))) {
      return i;
    }
  }
  return -1;
}

/**
 * Find a column index in a header row by matching against multiple possible labels.
 */
function findColumnIndex(headerRow: any[], candidates: string[]): number | undefined {
  const headerNorm = headerRow.map(norm);

  for (const candidate of candidates) {
    const candNorm = candidate.toLowerCase();
    // exact match first
    let idx = headerNorm.findIndex((h) => h === candNorm);
    if (idx !== -1) return idx;

    // then "contains" match (e.g. "claim amount" vs "claim amount (ssp)")
    idx = headerNorm.findIndex((h) => h.includes(candNorm));
    if (idx !== -1) return idx;
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/* Claims Submitted (CIC Smart Billing Utility Report)                */
/* ------------------------------------------------------------------ */
/**
 * Expected CIC-like columns, *somewhere* on the sheet:
 *
 *  No. | Billing Date | Account Name | Scheme Name | Benefit Description |
 *  Member Number | Patient Name | Patient File No | Invoice No | Claim Type | Amount
 *
 * But there may be several title rows above this, so we:
 *  - read the sheet as arrays
 *  - scan to find the real header row
 */
export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // 2D array of rows
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    raw: false,
  }) as any[][];

  if (!rows || rows.length === 0) return [];

  // Find header row
  const headerIdx = findHeaderRowIndex(rows, [
    // needs member + date + amount-ish
    (texts) => {
      const hasMember =
        texts.some((t) => t.includes("member number")) ||
        texts.some((t) => t.includes("membership no")) ||
        texts.some((t) => t.includes("member no"));

      const hasDate =
        texts.some((t) => t.includes("service date")) ||
        texts.some((t) => t.includes("billing date")) ||
        texts.some((t) => t.includes("loss date"));

      const hasAmount = texts.some((t) => t.includes("amount"));

      return hasMember && hasDate && hasAmount;
    },
  ]);

  if (headerIdx === -1) {
    console.error("[parseClaimsFile] Could not locate header row in claims file");
    return [];
  }

  const headerRow = rows[headerIdx];

  // Map columns (with multiple synonyms each)
  const memberCol = findColumnIndex(headerRow, [
    "Member Number",
    "Membership No",
    "Member No",
    "Membership Number",
  ]);

  const serviceDateCol = findColumnIndex(headerRow, [
    "Service Date",
    "Billing Date",
    "Loss Date",
    "Billing Date & Time",
  ]);

  const billedAmountCol = findColumnIndex(headerRow, [
    "Billed Amount",
    "Amount",
    "Claim Amount",
    "Amount (SSP)",
  ]);

  const patientNameCol = findColumnIndex(headerRow, [
    "Patient Name",
    "Member Name",
    "Primary Member",
  ]);

  const invoiceCol = findColumnIndex(headerRow, [
    "Invoice No",
    "Invoice Number",
    "Bill No",
  ]);

  const claimTypeCol = findColumnIndex(headerRow, ["Claim Type"]);
  const schemeCol = findColumnIndex(headerRow, ["Scheme Name"]);
  const benefitCol = findColumnIndex(headerRow, ["Benefit Description", "Benefit"]);
  const currencyCol = findColumnIndex(headerRow, ["Currency"]);

  const claims: ClaimRow[] = [];

  // Data rows: everything after headerIdx
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const memberRaw = memberCol != null ? row[memberCol] : undefined;
    const dateRaw = serviceDateCol != null ? row[serviceDateCol] : undefined;
    const amountRaw = billedAmountCol != null ? row[billedAmountCol] : undefined;

    // Skip empty rows
    if (!memberRaw && !dateRaw && !amountRaw) continue;

    const serviceDate = parseDate(dateRaw);
    if (!serviceDate) continue;

    const billedAmount = parseAmount(amountRaw);
    if (billedAmount <= 0) continue;

    claims.push({
      memberNumber: String(memberRaw ?? "").trim(),
      patientName: patientNameCol != null ? asOptionalString(row[patientNameCol]) : undefined,
      serviceDate,
      invoiceNumber: invoiceCol != null ? asOptionalString(row[invoiceCol]) : undefined,
      claimType: claimTypeCol != null ? asOptionalString(row[claimTypeCol]) : undefined,
      schemeName: schemeCol != null ? asOptionalString(row[schemeCol]) : undefined,
      benefitDesc: benefitCol != null ? asOptionalString(row[benefitCol]) : undefined,
      billedAmount,
      currency:
        currencyCol != null
          ? String(row[currencyCol] || "SSP").trim() || "SSP"
          : "SSP",
    });
  }

  return claims;
}

/* ------------------------------------------------------------------ */
/* Remittance Advice (CIC)                                            */
/* ------------------------------------------------------------------ */
/**
 * Expected remittance-style columns somewhere on the sheet:
 *
 *  SL# | CORPORATE NAME | BILL NO | MEMBER NAME | MEMBERSHIP NO | PRIMARY MEMBER |
 *  CLAIM NO | LOSS DATE | CLAIM AMOUNT | ... PAYABLE AMT. | ... etc
 */
export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    raw: false,
  }) as any[][];

  if (!rows || rows.length === 0) return [];

  const headerIdx = findHeaderRowIndex(rows, [
    (texts) => {
      const hasMember =
        texts.some((t) => t.includes("member number")) ||
        texts.some((t) => t.includes("membership no")) ||
        texts.some((t) => t.includes("member name"));

      const hasDate =
        texts.some((t) => t.includes("loss date")) ||
        texts.some((t) => t.includes("service date")) ||
        texts.some((t) => t.includes("date"));

      const hasClaimAmount =
        texts.some((t) => t.includes("claim amount")) ||
        texts.some((t) => t.includes("payable amt"));

      return hasMember && hasDate && hasClaimAmount;
    },
  ]);

  if (headerIdx === -1) {
    console.error("[parseRemittanceFile] Could not locate header row in remittance file");
    return [];
  }

  const headerRow = rows[headerIdx];

  const memberCol = findColumnIndex(headerRow, [
    "Member Number",
    "Membership No",
    "Member No",
    "Membership Number",
  ]);

  const patientNameCol = findColumnIndex(headerRow, [
    "Patient Name",
    "Member Name",
    "Primary Member",
  ]);

  const claimNumberCol = findColumnIndex(headerRow, [
    "Claim Number",
    "Claim No",
  ]);

  const serviceDateCol = findColumnIndex(headerRow, [
    "Service Date",
    "Loss Date",
    "Date of Loss",
    "Date",
  ]);

  const claimedAmountCol = findColumnIndex(headerRow, [
    "Claim Amount",
    "Claimed Amount",
    "Amount Claimed",
  ]);

  const paidAmountCol = findColumnIndex(headerRow, [
    "Paid Amount",
    "Amount Paid",
    "Payable Amt",
    "Payable Amount",
  ]);

  const employerCol = findColumnIndex(headerRow, [
    "Employer Name",
    "Corporate Name",
    "Corporate",
  ]);

  const paymentNoCol = findColumnIndex(headerRow, [
    "Payment No",
    "Cheque/EFT No",
    "Cheque No",
  ]);

  const paymentModeCol = findColumnIndex(headerRow, [
    "Payment Mode",
    "Mode",
  ]);

  const remittances: RemittanceRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const memberRaw = memberCol != null ? row[memberCol] : undefined;
    const dateRaw = serviceDateCol != null ? row[serviceDateCol] : undefined;
    const paidRaw = paidAmountCol != null ? row[paidAmountCol] : undefined;
    const claimedRaw = claimedAmountCol != null ? row[claimedAmountCol] : undefined;

    // Skip totally empty rows
    if (!memberRaw && !dateRaw && !paidRaw && !claimedRaw) continue;

    const serviceDate = parseDate(dateRaw);
    if (!serviceDate) continue;

    const paidAmount = parseAmount(paidRaw);
    const claimAmount = claimedAmountCol != null ? parseAmount(claimedRaw) : paidAmount;

    remittances.push({
      employerName: employerCol != null ? asOptionalString(row[employerCol]) : undefined,
      patientName: patientNameCol != null ? asOptionalString(row[patientNameCol]) : undefined,
      memberNumber: String(memberRaw ?? "").trim(),
      claimNumber: claimNumberCol != null ? asOptionalString(row[claimNumberCol]) : undefined,
      relationship: undefined, // not present in CIC remittance exports
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo: paymentNoCol != null ? asOptionalString(row[paymentNoCol]) : undefined,
      paymentMode: paymentModeCol != null ? asOptionalString(row[paymentModeCol]) : undefined,
    });
  }

  return remittances;
}
