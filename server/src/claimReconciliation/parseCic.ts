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
    const date = XLSX.SSF.parse_date_code(val);
    return new Date(date.y, date.m - 1, date.d);
  }
  
  // If it's a string
  if (typeof val === "string") {
    const parsed = new Date(val);
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
 * Parse Claims Submitted Excel file
 * Expected columns: Member Number, Patient Name, Service Date, Invoice Number,
 * Claim Type, Scheme Name, Benefit Description, Billed Amount
 */
export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const claims: ClaimRow[] = [];

  for (const row of data as any[]) {
    // Skip empty rows
    if (!row["Member Number"] && !row["Service Date"]) continue;

    const serviceDate = parseDate(row["Service Date"]);
    if (!serviceDate) continue;

    const billedAmount = parseAmount(row["Billed Amount"] || row["Amount"] || 0);
    if (billedAmount <= 0) continue;

    claims.push({
      memberNumber: String(row["Member Number"] || "").trim(),
      patientName: String(row["Patient Name"] || "").trim() || undefined,
      serviceDate,
      invoiceNumber: String(row["Invoice Number"] || "").trim() || undefined,
      claimType: String(row["Claim Type"] || "").trim() || undefined,
      schemeName: String(row["Scheme Name"] || "").trim() || undefined,
      benefitDesc: String(row["Benefit Description"] || row["Benefit"] || "").trim() || undefined,
      billedAmount,
      currency: String(row["Currency"] || "SSP").trim(),
    });
  }

  return claims;
}

/**
 * Parse Remittance Advice Excel file
 * Expected columns: Employer Name, Patient Name, Member Number, Claim Number,
 * Relationship, Service Date, Claim Amount, Paid Amount, Payment No, Payment Mode
 */
export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const remittances: RemittanceRow[] = [];

  for (const row of data as any[]) {
    // Skip empty rows
    if (!row["Member Number"] && !row["Service Date"]) continue;

    const serviceDate = parseDate(row["Service Date"]);
    if (!serviceDate) continue;

    const paidAmount = parseAmount(row["Paid Amount"] || row["Amount Paid"] || 0);
    const claimAmount = parseAmount(row["Claim Amount"] || row["Claimed Amount"] || paidAmount);

    remittances.push({
      employerName: String(row["Employer Name"] || row["Employer"] || "").trim() || undefined,
      patientName: String(row["Patient Name"] || "").trim() || undefined,
      memberNumber: String(row["Member Number"] || "").trim(),
      claimNumber: String(row["Claim Number"] || row["Claim No"] || "").trim() || undefined,
      relationship: String(row["Relationship"] || "").trim() || undefined,
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo: String(row["Payment No"] || row["Payment Number"] || "").trim() || undefined,
      paymentMode: String(row["Payment Mode"] || row["Mode"] || "").trim() || undefined,
    });
  }

  return remittances;
}
