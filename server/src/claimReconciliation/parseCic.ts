// server/src/claimReconciliation/parseCic.ts

import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/** ---------- Helpers: normalisation, dates, amounts ---------- **/

function normalizeHeader(val: unknown): string {
  return String(val ?? "")
    .toLowerCase()
    .replace(/[\r\n]+/g, " ") // newlines -> space
    .replace(/[^a-z0-9]+/g, " ") // drop punctuation, keep letters/digits
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(val: any): Date | null {
  if (!val) return null;

  // Already a JS Date
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  // Excel serial date (e.g. 45567)
  if (typeof val === "number") {
    // Excel's "serial 1" is 1900-01-01, but there is an off-by-one bug with 1900 leap year.
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = val * 24 * 60 * 60 * 1000;
    const d = new Date(excelEpoch.getTime() + ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Strings like "8/31/2025", "2025-08-31", etc.
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

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
 * Given a 2D array of rows, find the most likely header row.
 * We look for a row that contains words like "member", "date" and "amount".
 */
function findHeaderRow(rows: any[][]): number {
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const norm = normalizeHeader(row.join(" "));

    if (!norm) continue;

    const hasMember = /member|card|membership/.test(norm);
    const hasDate = /date/.test(norm);
    const hasAmount = /amount|total|billed|claim/.test(norm);

    const score = Number(hasMember) + Number(hasDate) + Number(hasAmount);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }

    if (score >= 2) {
      // good enough – don't keep scanning forever
      break;
    }
  }

  // Fallback: first non-empty row
  if (bestIndex === -1) {
    bestIndex = rows.findIndex((row) =>
      row.some((cell) => normalizeHeader(cell))
    );
  }

  return bestIndex === -1 ? 0 : bestIndex;
}

function buildIndexMap(
  headers: any[],
  aliasGroups: Record<string, string[]>
): Record<string, number> {
  const result: Record<string, number> = {};
  const normHeaders = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(aliasGroups)) {
    const normAliases = aliases.map(normalizeHeader);
    let idx = -1;

    for (let i = 0; i < normHeaders.length; i++) {
      const h = normHeaders[i];
      if (!h) continue;
      for (const a of normAliases) {
        if (!a) continue;
        // exact, or one contains the other
        if (h === a || h.includes(a) || a.includes(h)) {
          idx = i;
          break;
        }
      }
      if (idx !== -1) break;
    }

    result[field] = idx;
  }

  return result;
}

/** ---------- Claims: CIC "claims submitted" parser ---------- **/

export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Use first sheet for now – CIC exports usually put claims on sheet 0
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  // 2D array of rows (each row is an array of cell values)
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    raw: false,
  }) as any[][];

  if (!rows.length) return [];

  const headerRowIndex = findHeaderRow(rows);
  const headerRow = rows[headerRowIndex] ?? [];
  const dataRows = rows.slice(headerRowIndex + 1);

  const aliases = {
    memberNumber: [
      "member number",
      "member no",
      "member no.",
      "membership number",
      "membership no",
      "card number",
      "card no",
      "member",
    ],
    patientName: [
      "patient name",
      "member name",
      "beneficiary name",
      "name",
    ],
    serviceDate: [
      "service date",
      "date of service",
      "claim date",
      "billing date",
      "bill date",
      "visit date",
      "date",
    ],
    invoiceNumber: [
      "invoice number",
      "invoice no",
      "invoice no.",
      "inv number",
      "inv no",
    ],
    claimType: ["claim type", "type"],
    schemeName: ["scheme name", "employer name", "account name"],
    benefitDesc: ["benefit description", "benefit", "description"],
    billedAmount: [
      "billed amount",
      "amount",
      "claim amount",
      "claimed amount",
      "gross amount",
      "total amount",
      "amount billed",
    ],
    currency: ["currency", "curr"],
  } as const;

  const indexMap = buildIndexMap(headerRow, aliases);

  const claims: ClaimRow[] = [];

  for (const row of dataRows) {
    const get = (field: keyof typeof aliases): any => {
      const idx = indexMap[field];
      return idx != null && idx >= 0 ? row[idx] : undefined;
    };

    const memberNumber = String(get("memberNumber") ?? "").trim();
    const serviceDate = parseDate(get("serviceDate"));
    const billedAmount = parseAmount(get("billedAmount"));

    if (!memberNumber || !serviceDate || billedAmount <= 0) {
      // Not a valid claim row – skip
      continue;
    }

    const patientNameRaw = String(get("patientName") ?? "").trim();
    const invoiceNumberRaw = String(get("invoiceNumber") ?? "").trim();
    const claimTypeRaw = String(get("claimType") ?? "").trim();
    const schemeNameRaw = String(get("schemeName") ?? "").trim();
    const benefitDescRaw = String(get("benefitDesc") ?? "").trim();
    const currencyRaw = String(get("currency") ?? "").trim() || "SSP";

    claims.push({
      memberNumber,
      serviceDate,
      billedAmount,
      currency: currencyRaw,
      patientName: patientNameRaw || undefined,
      invoiceNumber: invoiceNumberRaw || undefined,
      claimType: claimTypeRaw || undefined,
      schemeName: schemeNameRaw || undefined,
      benefitDesc: benefitDescRaw || undefined,
    });
  }

  return claims;
}

/** ---------- Remittance: CIC remittance advice parser ---------- **/

export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    raw: false,
  }) as any[][];

  if (!rows.length) return [];

  const headerRowIndex = findHeaderRow(rows);
  const headerRow = rows[headerRowIndex] ?? [];
  const dataRows = rows.slice(headerRowIndex + 1);

  const aliases = {
    employerName: ["employer name", "employer", "account name", "company"],
    patientName: [
      "patient name",
      "member name",
      "beneficiary name",
      "name",
    ],
    memberNumber: [
      "member number",
      "member no",
      "member no.",
      "membership number",
      "membership no",
      "card number",
      "card no",
      "member",
    ],
    claimNumber: ["claim number", "claim no", "claim no.", "claim ref"],
    relationship: ["relationship", "rel"],
    serviceDate: [
      "service date",
      "date of service",
      "claim date",
      "billing date",
      "bill date",
      "date",
    ],
    claimAmount: [
      "claim amount",
      "claimed amount",
      "gross amount",
      "billed amount",
      "amount",
      "total amount",
    ],
    paidAmount: [
      "paid amount",
      "amount paid",
      "settled amount",
      "approved amount",
    ],
    paymentNo: [
      "payment no",
      "payment number",
      "payment ref",
      "payment reference",
      "transaction id",
    ],
    paymentMode: [
      "payment mode",
      "mode of payment",
      "payment method",
      "mode",
    ],
  } as const;

  const indexMap = buildIndexMap(headerRow, aliases);

  const remittances: RemittanceRow[] = [];

  for (const row of dataRows) {
    const get = (field: keyof typeof aliases): any => {
      const idx = indexMap[field];
      return idx != null && idx >= 0 ? row[idx] : undefined;
    };

    const memberNumber = String(get("memberNumber") ?? "").trim();
    const serviceDate = parseDate(get("serviceDate"));
    const paidAmount = parseAmount(get("paidAmount"));
    const claimAmount =
      parseAmount(get("claimAmount")) || paidAmount;

    if (!memberNumber || !serviceDate) {
      continue;
    }

    const employerNameRaw = String(get("employerName") ?? "").trim();
    const patientNameRaw = String(get("patientName") ?? "").trim();
    const claimNumberRaw = String(get("claimNumber") ?? "").trim();
    const relationshipRaw = String(get("relationship") ?? "").trim();
    const paymentNoRaw = String(get("paymentNo") ?? "").trim();
    const paymentModeRaw = String(get("paymentMode") ?? "").trim();

    remittances.push({
      memberNumber,
      serviceDate,
      claimAmount,
      paidAmount,
      employerName: employerNameRaw || undefined,
      patientName: patientNameRaw || undefined,
      claimNumber: claimNumberRaw || undefined,
      relationship: relationshipRaw || undefined,
      paymentNo: paymentNoRaw || undefined,
      paymentMode: paymentModeRaw || undefined,
    });
  }

  return remittances;
}
