// server/src/claimReconciliation/parseCic.ts

import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/**
 * Normalize any cell value to a lowercase string (safe for .includes).
 */
function norm(val: unknown): string {
  if (val == null) return "";
  return String(val).trim().toLowerCase();
}

/**
 * Clean ID-like cells to avoid Excel artifacts:
 * - trims
 * - removes commas
 * - converts "644472.0" -> "644472"
 */
function cleanId(val: unknown): string {
  const s = String(val ?? "").trim().replace(/,/g, "");
  if (!s) return "";
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  return s;
}

/**
 * Parse date from various Excel / text formats.
 */
function parseDate(val: any): Date | null {
  if (!val) return null;

  // Already a Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }

  // Excel serial date number
  if (typeof val === "number") {
    const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
    const millis = val * 24 * 60 * 60 * 1000;
    const d = new Date(excelEpoch.getTime() + millis);
    return isNaN(d.getTime()) ? null : d;
  }

  // Strings like "8/1/2025 1:01:11 PM" or "01-Aug-2025"
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Try Date constructor first
    const d1 = new Date(trimmed);
    if (!isNaN(d1.getTime())) return d1;

    // Try splitting off time if present
    const parts = trimmed.split(/\s+/);
    const maybeDate = parts[0];
    const d2 = new Date(maybeDate);
    if (!isNaN(d2.getTime())) return d2;
  }

  return null;
}

/**
 * Parse numeric amounts from various formats.
 */
function parseAmount(val: any): number {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : 0;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.\-]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Utilities for flexible header detection                            */
/* ------------------------------------------------------------------ */

type RowArray = any[];

/**
 * Read sheet as an array of row arrays.
 * defval: "" ensures we never get `undefined` cells.
 */
function readRows(sheet: XLSX.WorkSheet): RowArray[] {
  return XLSX.utils.sheet_to_json<RowArray>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown as RowArray[];
}

/**
 * Find the (zero-based) index of the row that looks like the header,
 * based on a set of detector functions.
 */
function findHeaderRowIndex(
  rows: RowArray[],
  detectors: Array<(texts: string[]) => boolean>
): number {
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
 * Given a header row and list of candidate header labels,
 * find the column index (or undefined if not found).
 */
function findColumnIndex(
  headerRow: RowArray,
  candidates: string[]
): number | undefined {
  const headerNorm = headerRow.map(norm);

  for (const candidate of candidates) {
    const candNorm = candidate.toLowerCase();

    // exact match first
    let idx = headerNorm.findIndex((h) => h === candNorm);
    if (idx !== -1) return idx;

    // then substring ("amount" vs "amount (ssp)")
    idx = headerNorm.findIndex(
      (h) => typeof h === "string" && h.includes(candNorm)
    );
    if (idx !== -1) return idx;
  }

  return undefined;
}

/**
 * Check if a row contains a member number/ID column header
 */
function hasMemberHeader(texts: string[]): boolean {
  return texts.some(
    (t) =>
      (t.includes("member") &&
        (t.includes("number") || t.includes("no") || t.includes("id"))) ||
      t.includes("membernumber") ||
      t.includes("membershipno") ||
      t.includes("membership_no")
  );
}

/**
 * Check if a row contains either patient name OR amount column header
 */
function hasPatientOrAmountHeader(texts: string[]): boolean {
  return (
    texts.some(
      (t) =>
        (t.includes("patient") && t.includes("name")) ||
        t.includes("patientname") ||
        t.includes("patient_name")
    ) ||
    texts.some((t) => t.includes("amount") || t.includes("billed") || t.includes("claim"))
  );
}

/* ------------------------------------------------------------------ */
/* Claims Submitted (Smart Billing Utility Report)                     */
/* ------------------------------------------------------------------ */

/**
 * Detect currency from file content.
 * Looks for "USD" / "SSP" in header rows (clinic name, title, etc.)
 * Defaults to USD for CIC provider.
 */
function detectCurrency(rows: RowArray[]): string {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    for (const cell of row) {
      const cellText = norm(cell);
      if (cellText.includes("usd")) return "USD";
      if (cellText.includes("ssp")) return "SSP";
    }
  }

  return "USD";
}

/**
 * Parse Claims Submitted Excel file (CIC Smart Billing report).
 */
export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = readRows(sheet);
  if (rows.length === 0) return [];

  const detectedCurrency = detectCurrency(rows);

  const headerIdx = findHeaderRowIndex(rows, [
    (texts) => hasMemberHeader(texts) && hasPatientOrAmountHeader(texts),
  ]);

  if (headerIdx === -1) {
    console.error("[parseClaimsFile] Could not detect header row – returning empty result");
    return [];
  }

  const headerRow = rows[headerIdx];

  const colMemberNumber = findColumnIndex(headerRow, [
    "member number",
    "membership no",
    "member no",
    "membernumber",
    "membershipno",
    "membership_no",
    "member_number",
    "member id",
    "memberid",
  ]);

  const colPatientName = findColumnIndex(headerRow, [
    "patient name",
    "patientname",
    "patient_name",
    "patient",
    "name",
  ]);

  const colServiceDate = findColumnIndex(headerRow, [
    "service date",
    "billing date",
    "bill date",
    "billingdate",
    "billing_date",
    "servicedate",
    "service_date",
    "date",
  ]);

  const colInvoiceNumber = findColumnIndex(headerRow, [
    "invoice no",
    "invoice number",
    "bill no",
    "invoiceno",
    "invoice_no",
    "invoice_number",
  ]);

  const colClaimType = findColumnIndex(headerRow, [
    "claim type",
    "type",
    "claimtype",
    "claim_type",
  ]);

  const colSchemeName = findColumnIndex(headerRow, [
    "scheme name",
    "schemename",
    "scheme_name",
    "scheme",
  ]);

  const colBenefitDesc = findColumnIndex(headerRow, [
    "benefit description",
    "benefit desc",
    "benefit",
    "benefitdescription",
    "benefit_description",
    "benefitdesc",
    "benefit_desc",
  ]);

  const colAmount = findColumnIndex(headerRow, [
    "amount",
    "billed amount",
    "claim amount",
    "billedamount",
    "billed_amount",
    "claimamount",
    "claim_amount",
  ]);

  const colCurrency = findColumnIndex(headerRow, ["currency"]);

  const results: ClaimRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const memberRaw = colMemberNumber != null ? row[colMemberNumber] : undefined;
    const serviceRaw = colServiceDate != null ? row[colServiceDate] : undefined;
    const amountRaw = colAmount != null ? row[colAmount] : undefined;

    const memberNumber = cleanId(memberRaw);
    const serviceDate = parseDate(serviceRaw) ?? undefined;
    const billedAmount = parseAmount(amountRaw);

    const invoiceNumber =
      colInvoiceNumber != null ? cleanId(row[colInvoiceNumber]) : "";

    // Skip obviously empty rows
    if (!memberNumber && !serviceDate && !invoiceNumber && billedAmount === 0) continue;

    // Require positive amount
    if (billedAmount <= 0) continue;

    // Accept if invoice exists OR date exists (fallback matching uses date+amount)
    if (!invoiceNumber && !serviceDate) continue;

    const patientName = colPatientName != null ? String(row[colPatientName] ?? "").trim() : "";
    const claimType = colClaimType != null ? String(row[colClaimType] ?? "").trim() : "";
    const schemeName = colSchemeName != null ? String(row[colSchemeName] ?? "").trim() : "";
    const benefitDesc = colBenefitDesc != null ? String(row[colBenefitDesc] ?? "").trim() : "";

    let currency = detectedCurrency;
    if (colCurrency != null) {
      const cellCurrency = String(row[colCurrency] ?? "").trim();
      if (cellCurrency) currency = cellCurrency.toUpperCase();
    }

    results.push({
      memberNumber,
      patientName: patientName || undefined,
      serviceDate,
      invoiceNumber: invoiceNumber || undefined,
      claimType: claimType || undefined,
      schemeName: schemeName || undefined,
      benefitDesc: benefitDesc || undefined,
      billedAmount,
      currency,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* Remittance Advice                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse Remittance Advice Excel file.
 */
export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = readRows(sheet);
  if (rows.length === 0) return [];

  // Header detection: require membership + (bill/claim/payable signals)
  const headerIdx = findHeaderRowIndex(rows, [
    (texts) =>
      texts.some((t) => t.includes("membership")) &&
      (texts.some((t) => t.includes("member name")) || texts.some((t) => t.includes("member"))) &&
      (texts.some((t) => t.includes("bill")) ||
        texts.some((t) => t.includes("claim")) ||
        texts.some((t) => t.includes("payable")) ||
        texts.some((t) => t.includes("paid amount"))),
  ]);

  if (headerIdx === -1) {
    console.error("[parseRemittanceFile] Could not detect header row – returning empty result");
    return [];
  }

  const headerRow = rows[headerIdx];

  const colEmployerName = findColumnIndex(headerRow, [
    "corporate name",
    "employer name",
    "corporate",
  ]);

  const colPatientName = findColumnIndex(headerRow, [
    "member name",
    "patient name",
  ]);

  const colMemberNumber = findColumnIndex(headerRow, [
    "membership no",
    "member number",
    "member no",
    "membership number",
  ]);

  // ✅ BILL NO is the key that matches CIC invoice number
  const colBillNo = findColumnIndex(headerRow, [
    "bill no",
    "bill number",
    "bill#",
    "invoice no",
    "invoice number",
  ]);

  const colClaimNumber = findColumnIndex(headerRow, ["claim no", "claim number"]);

  const colRelationship = findColumnIndex(headerRow, ["relationship"]);

  const colServiceDate = findColumnIndex(headerRow, [
    "loss date",
    "service date",
    "date of service",
  ]);

  const colClaimAmount = findColumnIndex(headerRow, [
    "claim amount",
    "claim amt",
    "claimed amount",
  ]);

  const colPaidAmount = findColumnIndex(headerRow, [
    "paid amount",
    "payable amt",
    "payable amount",
    "amount paid",
  ]);

  const colPaymentNo = findColumnIndex(headerRow, [
    "cheque/eft no",
    "cheque no",
    "payment no",
    "payment number",
  ]);

  const colPaymentMode = findColumnIndex(headerRow, ["payment mode", "mode"]);

  const results: RemittanceRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const memberRaw = colMemberNumber != null ? row[colMemberNumber] : undefined;
    const memberNumber = cleanId(memberRaw);

    const billNo = colBillNo != null ? cleanId(row[colBillNo]) : "";

    const claimNumber =
      colClaimNumber != null ? cleanId(row[colClaimNumber]) : "";

    const serviceRaw = colServiceDate != null ? row[colServiceDate] : undefined;
    const serviceDate = parseDate(serviceRaw) ?? undefined;

    // Keep rows if we have member + (bill/claim id), even if date is missing
    const hasAnyId = !!billNo || !!claimNumber;
    if (!memberNumber && !hasAnyId && !serviceDate) continue;

    const employerName = colEmployerName != null ? String(row[colEmployerName] ?? "").trim() : "";
    const patientName = colPatientName != null ? String(row[colPatientName] ?? "").trim() : "";
    const relationship = colRelationship != null ? String(row[colRelationship] ?? "").trim() : "";

    const claimAmountRaw = colClaimAmount != null ? row[colClaimAmount] : undefined;
    const paidAmountRaw = colPaidAmount != null ? row[colPaidAmount] : undefined;

    const claimAmount = parseAmount(claimAmountRaw);
    const paidAmount = parseAmount(paidAmountRaw);

    const paymentNo = colPaymentNo != null ? cleanId(row[colPaymentNo]) : "";
    const paymentMode = colPaymentMode != null ? String(row[colPaymentMode] ?? "").trim() : "";

    // If there is literally nothing meaningful, skip it
    if (!memberNumber && !hasAnyId && claimAmount === 0 && paidAmount === 0) continue;

    results.push({
      employerName: employerName || undefined,
      patientName: patientName || undefined,
      memberNumber,
      billNo: billNo || undefined, // ✅ ADDED
      claimNumber: claimNumber || undefined,
      relationship: relationship || undefined,
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo: paymentNo || undefined,
      paymentMode: paymentMode || undefined,
    });
  }

  return results;
}
