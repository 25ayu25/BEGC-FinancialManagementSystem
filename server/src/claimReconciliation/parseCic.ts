import * as XLSX from "xlsx";
import type { ClaimRow, RemittanceRow } from "./types";

/**
 * Helper: first non-empty value from a list of possible column names
 */
function getCell(row: any, keys: string[]): any {
  for (const key of keys) {
    if (key in row && row[key] != null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return undefined;
}

function asOptionalString(val: any): string | undefined {
  const s = String(val ?? "").trim();
  return s || undefined;
}

/**
 * Parse date from various formats
 */
function parseDate(val: any): Date | null {
  if (!val) return null;

  // Already a Date
  if (val instanceof Date) return val;

  // Excel serial date (number of days since 1900-01-01)
  if (typeof val === "number") {
    const excelEpoch = new Date(1900, 0, 1);
    const days = val - 1; // Excel counts from 1
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // String date
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
 * Parse CIC "Claims Submitted" Excel file
 *
 * Real CIC headers (from your screenshot):
 *  - Billing Date
 *  - Account Name
 *  - Scheme Name
 *  - Benefit Description
 *  - Member Number
 *  - Patient Name
 *  - Patient File No
 *  - Invoice No
 *  - Claim Type
 *  - Amount
 *
 * Test file headers:
 *  - Service Date
 *  - Billed Amount
 *  - (similar others)
 */
export function parseClaimsFile(buffer: Buffer): ClaimRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const claims: ClaimRow[] = [];

  for (const rawRow of data as any[]) {
    const row = rawRow || {};

    const memberNumberRaw = getCell(row, [
      "Member Number",
      "MEMBER NUMBER",
      "Membership No",
      "MEMBERSHIP NO",
      "Member No",
    ]);

    const serviceDateRaw = getCell(row, [
      "Service Date",
      "SERVICE DATE",
      "Billing Date",
      "BILLING DATE",
      "Bill Date",
      "BILL DATE",
    ]);

    const billedAmountRaw = getCell(row, [
      "Billed Amount",
      "BILLED AMOUNT",
      "Amount",
      "AMOUNT",
      "Claim Amount",
      "CLAIM AMOUNT",
    ]);

    // Skip completely empty rows
    if (!memberNumberRaw && !serviceDateRaw && !billedAmountRaw) continue;

    const serviceDate = parseDate(serviceDateRaw);
    if (!serviceDate) continue;

    const billedAmount = parseAmount(billedAmountRaw);
    if (billedAmount <= 0) continue;

    claims.push({
      memberNumber: String(memberNumberRaw ?? "").trim(),
      patientName: asOptionalString(
        getCell(row, ["Patient Name", "PATIENT NAME", "Member Name", "MEMBER NAME"])
      ),
      serviceDate,
      invoiceNumber: asOptionalString(
        getCell(row, ["Invoice Number", "INVOICE NO", "Invoice No"])
      ),
      claimType: asOptionalString(getCell(row, ["Claim Type", "CLAIM TYPE"])),
      schemeName: asOptionalString(getCell(row, ["Scheme Name", "SCHEME NAME"])),
      benefitDesc: asOptionalString(
        getCell(row, [
          "Benefit Description",
          "BENEFIT DESCRIPTION",
          "Benefit",
          "BENEFIT",
        ])
      ),
      billedAmount,
      currency: String(getCell(row, ["Currency", "CURRENCY"]) || "SSP").trim(),
    });
  }

  return claims;
}

/**
 * Parse CIC Remittance Excel file
 *
 * Real CIC headers (from your screenshot):
 *  - SL#
 *  - CORPORATE NAME
 *  - BILL NO
 *  - MEMBER NAME
 *  - MEMBERSHIP NO
 *  - PRIMARY MEMBER
 *  - CLAIM NO
 *  - LOSS DATE
 *  - CLAIM AMOUNT
 *  - PAY TO
 *  - PAYEE NAME
 *  - PAYABLE AMT.
 *  - IN ADMISSIBLE AMT
 *  - PAYMENT MODE
 *  - CHEQUE/EFT NO
 *  - CHEQUE/EFT DATE
 *  - REMARKS
 *  - REASONS
 */
export function parseRemittanceFile(buffer: Buffer): RemittanceRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

  const remittances: RemittanceRow[] = [];

  for (const rawRow of data as any[]) {
    const row = rawRow || {};

    const memberNumberRaw = getCell(row, [
      "Member Number",
      "MEMBER NUMBER",
      "Membership No",
      "MEMBERSHIP NO",
      "Member No",
    ]);

    const serviceDateRaw = getCell(row, [
      "Service Date",
      "SERVICE DATE",
      "Loss Date",
      "LOSS DATE",
      "Date of Service",
    ]);

    // Skip empty rows
    if (!memberNumberRaw && !serviceDateRaw) continue;

    const serviceDate = parseDate(serviceDateRaw);
    if (!serviceDate) continue;

    const claimAmountRaw = getCell(row, [
      "Claim Amount",
      "CLAIM AMOUNT",
      "Claimed Amount",
      "Amount",
      "AMOUNT",
    ]);

    const paidAmountRaw = getCell(row, [
      "Paid Amount",
      "Amount Paid",
      "PAYABLE AMT.",
      "Payable Amt.",
      "PAYABLE AMT",
      "Paid Amt",
      "PAID AMOUNT",
    ]);

    const claimAmount = parseAmount(claimAmountRaw ?? paidAmountRaw);
    const paidAmount = parseAmount(paidAmountRaw ?? claimAmountRaw);

    remittances.push({
      employerName: asOptionalString(
        getCell(row, [
          "Employer Name",
          "Employer",
          "CORPORATE NAME",
          "Corporate Name",
        ])
      ),
      patientName: asOptionalString(
        getCell(row, [
          "Patient Name",
          "PATIENT NAME",
          "Member Name",
          "MEMBER NAME",
          "Primary Member",
          "PRIMARY MEMBER",
        ])
      ),
      memberNumber: String(memberNumberRaw ?? "").trim(),
      claimNumber: asOptionalString(
        getCell(row, ["Claim Number", "Claim No", "CLAIM NO"])
      ),
      relationship: asOptionalString(getCell(row, ["Relationship"])),
      serviceDate,
      claimAmount,
      paidAmount,
      paymentNo: asOptionalString(
        getCell(row, [
          "Payment No",
          "Payment Number",
          "CHEQUE/EFT NO",
          "Cheque/EFT No",
        ])
      ),
      paymentMode: asOptionalString(
        getCell(row, ["Payment Mode", "Mode", "PAYMENT MODE"])
      ),
    });
  }

  return remittances;
}
