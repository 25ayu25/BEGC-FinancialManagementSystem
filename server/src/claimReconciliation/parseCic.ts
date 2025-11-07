// server/src/claimReconciliation/parseCic.ts

import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/**
 * Parse date from various formats
 */
function parseDate(val: any): Date | null {
  if (!val) return null;

  // If it's already a Date
  if (val instanceof Date) return val;

  // If it's a number (Excel serial date)
  if (typeof val === "number") {
    // Excel dates are days since 1900-01-01 (with adjustments for Excel bug)
    const excelEpoch = new Date(1900, 0, 1);
    const days = val - 1; // Excel counts from 1, not 0
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    return date;
  }

  // If it's a string
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * Parse amount from various formats
 */
function parseAmount(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Safely read the first non-empty cell for any of the candidate column names.
 * This lets us support both our test files and the real CIC exports.
 */
function getCell(row: any, keys: string[]): any {
  for (const key of keys) {
    if (key in row && row[key] != null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return undefined;
}

/**
 * Parse Claims Submitted Excel file (SMART Billing Utility report)
 *
 * Supports:
 *  - Test files: "Member Number", "Service Date", "Billed Amount"
 *  - CIC files:  "Member Number", "Billing Date", "Amount"
 */
export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const claims: ClaimRow[] = [];

  for (const row of data as any[]) {
    // --- detect "non-empty" rows using either old or new columns ---
    const rawMemberNumber = getCell(row, [
      "Member Number",
      "MEMBER NUMBER",
      "Membership No",
      "MEMBERSHIP NO",
      "MEMBER NO",
    ]);

    const rawService = getCell(row, [
      "Service Date",
      "SERVICE DATE",
      "Billing Date",
      "BILLING DATE",
      "Loss Date",
      "LOSS DATE",
    ]);

    if (!rawMemberNumber && !rawService) continue;

    const serviceDate = parseDate(rawService);
    if (!serviceDate) continue;

    const billedAmount = parseAmount(
      getCell(row, [
        "Billed Amount",
        "BILLED AMOUNT",
        "Amount",
        "AMOUNT",
      ]) ?? 0
    );
    if (billedAmount <= 0) continue;

    const memberNumber = String(rawMemberNumber ?? "").trim();

    claims.push({
      memberNumber,
      patientName:
        (String(
          getCell(row, ["Patient Name", "PATIENT NAME"]) ?? ""
        ).trim()) || undefined,
      serviceDate,
      invoiceNumber:
        (String(
          getCell(row, ["Invoice Number", "Invoice No", "INVOICE NO"]) ?? ""
        ).trim()) || undefined,
      claimType:
        (String(
          getCell(row, ["Claim Type", "CLAIM TYPE"]) ?? ""
        ).trim()) || undefined,
      schemeName:
        (String(
          getCell(row, ["Scheme Name", "SCHEME NAME"]) ?? ""
        ).trim()) || undefined,
      benefitDesc:
        (String(
          getCell(row, [
            "Benefit Description",
            "BENEFIT DESCRIPTION",
            "Benefit",
            "BENEFIT",
          ]) ?? ""
        ).trim()) || undefined,
      billedAmount,
      currency:
        String(getCell(row, ["Currency", "CURRENCY"]) ?? "SSP").trim() || "SSP",
    });
  }

  return claims;
}

/**
 * Parse Remittance Advice Excel file
 *
 * Supports:
 *  - Generic/test:  "Member Number", "Service Date",
 *                   "Paid Amount", "Claim Amount"
 *  - CIC remittance: "MEMBERSHIP NO", "LOSS DATE",
 *                    "PAYABLE AMT.", "CLAIM AMOUNT",
 *                    "CORPORATE NAME", "CLAIM NO", "PAYMENT MODE", etc.
 */
export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const remittances: RemittanceRow[] = [];

  for (const row of data as any[]) {
    const rawMemberNumber = getCell(row, [
      "Member Number",
      "MEMBER NUMBER",
      "Membership No",
      "MEMBERSHIP NO",
      "MEMBER NO",
    ]);

    const rawService = getCell(row, [
      "Service Date",
      "SERVICE DATE",
      "Loss Date",
      "LOSS DATE",
      "Billing Date",
      "BILLING DATE",
    ]);

    // Skip completely empty lines
    if (!rawMemberNumber && !rawService) continue;

    const serviceDate = parseDate(rawService);
    if (!serviceDate) continue;

    const claimAmount = parseAmount(
      getCell(row, [
        "Claim Amount",
        "CLAIM AMOUNT",
        "Claimed Amount",
        "CLAIMED AMOUNT",
        "Amount",
        "AMOUNT",
      ]) ?? 0
    );

    const paidAmount = parseAmount(
      getCell(row, [
        "Paid Amount",
        "PAID AMOUNT",
        "Amount Paid",
        "AMOUNT PAID",
        "PAYABLE AMT.",
        "Payable Amt.",
        "Payable Amount",
      ]) ?? 0
    );

    // If we don't have any meaningful money values, skip
    if (claimAmount <= 0 && paidAmount <= 0) continue;

    const memberNumber = String(rawMemberNumber ?? "").trim();

    remittances.push({
      employerName:
        (String(
          getCell(row, ["Employer Name", "Employer", "CORPORATE NAME"]) ?? ""
        ).trim()) || undefined,
      patientName:
        (String(
          getCell(row, ["Patient Name", "PATIENT NAME", "MEMBER NAME"]) ?? ""
        ).trim()) || undefined,
      memberNumber,
      claimNumber:
        (String(
          getCell(row, ["Claim Number", "Claim No", "CLAIM NO"]) ?? ""
        ).trim()) || undefined,
      relationship:
        (String(getCell(row, ["Relationship"]) ?? "").trim()) || undefined,
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo:
        (String(
          getCell(row, [
            "Payment No",
            "Payment Number",
            "CHEQUE/EFT NO",
            "Cheque/EFT No",
          ]) ?? ""
        ).trim()) || undefined,
      paymentMode:
        (String(
          getCell(row, ["Payment Mode", "Mode", "PAYMENT MODE"]) ?? ""
        ).trim()) || undefined,
    });
  }

  return remittances;
}
