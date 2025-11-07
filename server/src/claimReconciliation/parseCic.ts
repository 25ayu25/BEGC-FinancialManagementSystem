// server/src/claimReconciliation/parseCic.ts
import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/* ------------------ utilities ------------------ */

function isLikelyHeaderRow(row: any[]): boolean {
  const joined = row.map(v => String(v || "").toLowerCase()).join(" ");
  // Any hint that this row contains a header-ish set of labels
  return /member|m\/?no|patient|invoice|claim|date|service|billed|amount|employer/.test(joined);
}

function toCleanString(v: any): string {
  return String(v ?? "").trim();
}

function parseAmountLoose(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  // strings like "SSP 1,234.50" or "1 234,50"
  let s = String(v).trim();
  // normalize decimal comma -> dot if needed
  const hasCommaAsDecimal =
    /,\d{1,2}$/.test(s.replace(/[^0-9,.-]/g, "")) && (s.match(/\./g)?.length || 0) <= 1;
  s = s.replace(/[^\d,.\-]/g, "");
  if (hasCommaAsDecimal && s.indexOf(",") >= 0 && s.indexOf(".") === -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function excelSerialToDate(n: number): Date {
  // Excel epoch 1899-12-30 for js-xlsx (handles the 1900 leap year bug)
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round(n * 24 * 60 * 60 * 1000);
  return new Date(epoch.getTime() + ms);
}

function parseDateLoose(v: any): Date | null {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number" && isFinite(v)) {
    const d = excelSerialToDate(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;

  // Try known patterns first (DD/MM/YYYY and MM/DD/YYYY)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let d = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;

    // If DD>12, then it's DD/MM; else let Date decide (but swap if needed)
    if (d > 12 && mo <= 12) {
      // DD/MM/YYYY
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    // try MM/DD/YYYY then DD/MM/YYYY fallback
    const mmdd = new Date(Date.UTC(y, d - 1, mo));
    if (!isNaN(mmdd.getTime())) return mmdd;
    const ddmm = new Date(Date.UTC(y, mo - 1, d));
    if (!isNaN(ddmm.getTime())) return ddmm;
  }

  // Fallback: Date parser
  const dflt = new Date(s);
  return isNaN(dflt.getTime()) ? null : dflt;
}

/* ------------------ header mapping ------------------ */

type MapSpec = Record<string, string[]>;

const CLAIMS_MAP: MapSpec = {
  memberNumber: [
    "member number", "member no", "member #", "membership no", "m/no", "m no", "card no",
    "member", "membership number"
  ],
  patientName:  ["patient name", "name", "beneficiary", "dependent"],
  serviceDate:  ["service date", "date of service", "claim date", "treatment date", "billing date", "date"],
  invoiceNumber:["invoice number", "invoice no", "inv no", "invoice"],
  claimType:    ["claim type", "type"],
  schemeName:   ["scheme name", "scheme", "plan"],
  benefitDesc:  ["benefit description", "benefit", "service", "description", "diagnosis"],
  billedAmount: ["billed amount", "amount", "claim amount", "gross amount", "total", "billed"],
  currency:     ["currency"]
};

const REMIT_MAP: MapSpec = {
  employerName: ["employer name", "employer", "company"],
  patientName:  ["patient name", "name", "beneficiary", "dependent"],
  memberNumber: ["member number", "member no", "member #", "membership no", "m/no", "m no", "card no", "member"],
  claimNumber:  ["claim number", "claim no", "claim #", "reference"],
  relationship: ["relationship", "rel"],
  serviceDate:  ["service date", "date of service", "claim date", "treatment date", "billing date", "date"],
  claimAmount:  ["claim amount", "claimed amount", "billed amount", "amount"],
  paidAmount:   ["paid amount", "amount paid", "net amount", "payment amount", "paid"],
  paymentNo:    ["payment no", "payment number", "payment ref", "cheque no", "check no"],
  paymentMode:  ["payment mode", "mode", "method"]
};

function buildIndexMap(headers: string[], spec: MapSpec): Record<keyof MapSpec, number | -1> {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const map: Record<any, any> = {};
  const H = headers.map(norm);

  for (const key of Object.keys(spec)) {
    map[key] = -1;
    for (const alias of spec[key as keyof MapSpec]) {
      const pos = H.indexOf(norm(alias));
      if (pos !== -1) { map[key] = pos; break; }
    }
  }
  return map as any;
}

/* ------------------ parsing helpers ------------------ */

function pickFirstSheetWith(headersNeeded: string[], wb: XLSX.WorkBook): string | null {
  for (const name of wb.SheetNames) {
    const sh = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(sh, { header: 1, raw: true });
    // find header row
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      if (row.filter(Boolean).length < 2) continue;
      if (isLikelyHeaderRow(row)) {
        const lower = row.map(v => String(v || "").toLowerCase());
        const hasAny = headersNeeded.some(h =>
          lower.some(c => String(c).includes(h))
        );
        if (hasAny) return name;
      }
    }
  }
  return null;
}

function findHeaderRow(rows: any[][]): { header: string[]; startIndex: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const nonEmpty = r.filter(Boolean);
    if (nonEmpty.length < 2) continue;
    if (isLikelyHeaderRow(r)) {
      // normalize header labels to strings
      return { header: r.map(toCleanString), startIndex: i + 1 };
    }
  }
  return null;
}

/* ------------------ public API ------------------ */

export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const targetSheet =
    pickFirstSheetWith(["member", "date", "amount"], wb) ?? wb.SheetNames[0];
  const sh = wb.Sheets[targetSheet];
  const rows = XLSX.utils.sheet_to_json<any[]>(sh, { header: 1, raw: true });

  const headerInfo = findHeaderRow(rows);
  if (!headerInfo) return [];

  const { header, startIndex } = headerInfo;
  const idx = buildIndexMap(header, CLAIMS_MAP);

  const out: ClaimRow[] = [];
  for (let r = startIndex; r < rows.length; r++) {
    const row = rows[r] || [];
    const memberRaw = row[idx.memberNumber];
    const dateRaw = row[idx.serviceDate];
    const amtRaw = row[idx.billedAmount];

    // minimal guard
    if (!memberRaw && !dateRaw) continue;

    const serviceDate = parseDateLoose(dateRaw);
    const billedAmount = parseAmountLoose(amtRaw);

    // must have a date and a positive amount
    if (!serviceDate || billedAmount <= 0) continue;

    out.push({
      memberNumber: toCleanString(memberRaw),
      patientName: toCleanString(row[idx.patientName]),
      serviceDate,
      invoiceNumber: toCleanString(row[idx.invoiceNumber]) || undefined,
      claimType: toCleanString(row[idx.claimType]) || undefined,
      schemeName: toCleanString(row[idx.schemeName]) || undefined,
      benefitDesc: toCleanString(row[idx.benefitDesc]) || undefined,
      billedAmount,
      currency: (toCleanString(row[idx.currency]) || "SSP").toUpperCase(),
    });
  }
  return out;
}

export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const targetSheet =
    pickFirstSheetWith(["member", "date", "paid"], wb) ?? wb.SheetNames[0];
  const sh = wb.Sheets[targetSheet];
  const rows = XLSX.utils.sheet_to_json<any[]>(sh, { header: 1, raw: true });

  const headerInfo = findHeaderRow(rows);
  if (!headerInfo) return [];

  const { header, startIndex } = headerInfo;
  const idx = buildIndexMap(header, REMIT_MAP);

  const out: RemittanceRow[] = [];
  for (let r = startIndex; r < rows.length; r++) {
    const row = rows[r] || [];
    const memberRaw = row[idx.memberNumber];
    const dateRaw = row[idx.serviceDate];

    if (!memberRaw && !dateRaw) continue;

    const serviceDate = parseDateLoose(dateRaw);
    if (!serviceDate) continue;

    const claimAmount = parseAmountLoose(row[idx.claimAmount]);
    const paidAmount = parseAmountLoose(row[idx.paidAmount]);

    out.push({
      employerName: toCleanString(row[idx.employerName]) || undefined,
      patientName: toCleanString(row[idx.patientName]) || undefined,
      memberNumber: toCleanString(memberRaw),
      claimNumber: toCleanString(row[idx.claimNumber]) || undefined,
      relationship: toCleanString(row[idx.relationship]) || undefined,
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo: toCleanString(row[idx.paymentNo]) || undefined,
      paymentMode: toCleanString(row[idx.paymentMode]) || undefined,
    });
  }
  return out;
}
