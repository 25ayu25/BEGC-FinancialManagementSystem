import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  decimal, 
  numeric, // Added for new tables
  timestamp, 
  boolean, 
  integer, 
  jsonb, 
  serial, 
  date, 
  uniqueIndex // Added for new tables
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // "admin", "manager", "staff", "viewer"
  location: text("location").notNull().default("south_sudan"), // "usa", "south_sudan"
  status: text("status").notNull().default("active"), // "active", "inactive"
  permissions: jsonb("permissions").notNull().default("[]"), // JSON array of permissions
  defaultCurrency: text("default_currency").default("SSP"), // "USD", "SSP"
  emailNotifications: boolean("email_notifications").default(true),
  reportAlerts: boolean("report_alerts").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // CON, LAB, ULTRASOUND, XRAY, PHARMACY
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insuranceProviders = pgTable("insurance_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // CIC, UAP, CIGNA, etc.
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "income", "expense"
  departmentId: varchar("department_id").references(() => departments.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"), // USD, SSP
  description: text("description"),
  date: timestamp("date").notNull().defaultNow(),
  receiptPath: text("receipt_path"), // path to uploaded receipt
  insuranceProviderId: varchar("insurance_provider_id").references(() => insuranceProviders.id),
  // Enhanced expense categorization for detailed staff and operational tracking
  expenseCategory: text("expense_category"), // "clinic_operations", "doctor_payments", "lab_tech_payments", "radiographer_payments", "insurance_payments", "general"
  staffType: text("staff_type"), // "doctor", "lab_tech", "radiographer" - for staff payment tracking
  createdBy: varchar("created_by").notNull().references(() => users.id),
  syncStatus: text("sync_status").notNull().default("pending"), // "pending", "synced", "failed"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const monthlyReports = pgTable("monthly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  totalIncome: decimal("total_income", { precision: 10, scale: 2 }).notNull(),
  totalExpenses: decimal("total_expenses", { precision: 10, scale: 2 }).notNull(),
  netIncome: decimal("net_income", { precision: 10, scale: 2 }).notNull(),
  departmentBreakdown: jsonb("department_breakdown").notNull(), // JSON with department totals
  insuranceBreakdown: jsonb("insurance_breakdown").notNull(), // JSON with insurance totals
  status: text("status").notNull().default("draft"), // "draft", "approved", "locked"
  pdfPath: text("pdf_path"), // path to generated PDF
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull().references(() => transactions.id),
  filePath: text("file_path").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const patientVolume = pgTable("patient_volume", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  departmentId: varchar("department_id").references(() => departments.id),
  patientCount: integer("patient_count").notNull().default(0),
  notes: text("notes"), // Optional notes about the day
  recordedBy: varchar("recorded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* =======================
   Insurance Management
   ======================= */

// One claim per provider per month/period
export const insuranceClaims = pgTable("insurance_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  providerId: varchar("provider_id").notNull().references(() => insuranceProviders.id),
  periodYear: integer("period_year").notNull(),           // e.g. 2025
  periodMonth: integer("period_month").notNull(),         // 1..12
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),

  currency: text("currency").notNull().default("USD"),    // "USD" | "SSP"
  claimedAmount: decimal("claimed_amount", { precision: 10, scale: 2 }).notNull(),

  status: text("status").notNull().default("submitted"),  // "submitted" | "partially_paid" | "paid" | "rejected" | "written_off"
  notes: text("notes"),

  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cash received from insurers (optionally linked to a claim)
export const insurancePayments = pgTable("insurance_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  providerId: varchar("provider_id").notNull().references(() => insuranceProviders.id),
  claimId: varchar("claim_id").references(() => insuranceClaims.id), // optional

  paymentDate: timestamp("payment_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),    // "USD" | "SSP"

  reference: text("reference"),                            // bank ref / receipt #
  notes: text("notes"),

  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NEW: monthly lab portion of submitted claims
export const insuranceDepartmentPortions = pgTable("insurance_department_portions", {
  id: serial("id").primaryKey(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(), // 1-12
  departmentCode: varchar("department_code", { length: 32 }).notNull(), // e.g., 'LAB'
  currency: varchar("currency", { length: 8 }).notNull(), // 'SSP' | 'USD'
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqPeriodDept: uniqueIndex("uniq_lab_portion_period_dept")
    .on(t.periodYear, t.periodMonth, t.departmentCode),
}));

// --- NEW: individual payments you make to the lab tech (from insurance share)
export const insuranceLabPayments = pgTable("insurance_lab_payments", {
  id: serial("id").primaryKey(),
  payDate: date("pay_date").notNull(),
  periodYear: integer("period_year").notNull(),   // which month this payment is applied to
  periodMonth: integer("period_month").notNull(), // (can pay later and still apply to old month)
  currency: varchar("currency", { length: 8 }).notNull(), // 'SSP' | 'USD'
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  note: text("note"),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* =======================
   Claim Reconciliation
   ======================= */

// 1) Reconciliation run (per provider + period)
export const claimReconRuns = pgTable("claim_recon_runs", {
  id: serial("id").primaryKey(),
  providerName: varchar("provider_name", { length: 128 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // summary stats
  totalClaimRows: integer("total_claim_rows").notNull().default(0),
  totalRemittanceRows: integer("total_remittance_rows").notNull().default(0),
  autoMatched: integer("auto_matched").notNull().default(0),
  partialMatched: integer("partial_matched").notNull().default(0),
  manualReview: integer("manual_review").notNull().default(0),
});

// 2) Raw "Claims Submitted" rows
export const claimReconClaims = pgTable("claim_recon_claims", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => claimReconRuns.id, { onDelete: "cascade" }),

  // Provider and period tracking for staged workflow
  providerName: varchar("provider_name", { length: 128 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),

  memberNumber: varchar("member_number", { length: 64 }).notNull(),
  patientName: varchar("patient_name", { length: 256 }),
  serviceDate: date("service_date").notNull(),
  invoiceNumber: varchar("invoice_number", { length: 64 }),
  claimType: varchar("claim_type", { length: 64 }),
  schemeName: varchar("scheme_name", { length: 256 }),
  benefitDesc: varchar("benefit_desc", { length: 256 }),

  billedAmount: decimal("billed_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("SSP"),

  // reconciliation fields
  // Status values: "awaiting_remittance", "matched", "partially_paid", "unpaid", "manual_review"
  status: varchar("status", { length: 32 }).notNull().default("awaiting_remittance"),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  remittanceLineId: integer("remittance_line_id"),

  compositeKey: varchar("composite_key", { length: 128 }).notNull(),

  rawRow: jsonb("raw_row"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 3) Raw remittance lines
export const claimReconRemittances = pgTable("claim_recon_remittances", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => claimReconRuns.id, { onDelete: "cascade" }),

  // Provider and period tracking for staged workflow
  providerName: varchar("provider_name", { length: 128 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),

  employerName: varchar("employer_name", { length: 256 }),
  patientName: varchar("patient_name", { length: 256 }),
  memberNumber: varchar("member_number", { length: 64 }).notNull(),
  claimNumber: varchar("claim_number", { length: 64 }),
  relationship: varchar("relationship", { length: 64 }),
  serviceDate: date("service_date").notNull(),
  claimAmount: decimal("claim_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull(),
  paymentNo: varchar("payment_no", { length: 64 }),
  paymentMode: varchar("payment_mode", { length: 64 }),

  compositeKey: varchar("composite_key", { length: 128 }).notNull(),

  matchedClaimId: integer("matched_claim_id"),
  matchType: varchar("match_type", { length: 32 }),
  // Status for orphan remittances: "orphan_remittance" means no matching claim found
  status: varchar("status", { length: 32 }),
  rawRow: jsonb("raw_row"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


/* =======================
   Insert Schemas (Zod)
   ======================= */

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
});

export const insertInsuranceProviderSchema = createInsertSchema(insuranceProviders).omit({
  id: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
});

export const insertPatientVolumeSchema = createInsertSchema(patientVolume).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.string().transform((str) => new Date(str)),
});

// ---- Insurance insert schemas ----
export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInsurancePaymentSchema = createInsertSchema(insurancePayments).omit({
  id: true,
  createdAt: true,
});

// ---- NEW: Insurance Departments & Payments insert schemas ----
export const insertInsuranceDepartmentPortionSchema = createInsertSchema(insuranceDepartmentPortions).omit({
  id: true,
  createdAt: true,
});

export const insertInsuranceLabPaymentSchema = createInsertSchema(insuranceLabPayments).omit({
  id: true,
  createdAt: true,
});

// ---- Reconciliation insert schemas ----
export const insertClaimReconRunSchema = createInsertSchema(claimReconRuns).omit({
  id: true,
  createdAt: true,
});

export const insertClaimReconClaimSchema = createInsertSchema(claimReconClaims).omit({
  id: true,
});

export const insertClaimReconRemittanceSchema = createInsertSchema(claimReconRemittances).omit({
  id: true,
});


/* =======================
   Types
   ======================= */

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type InsuranceProvider = typeof insuranceProviders.$inferSelect;
export type InsertInsuranceProvider = z.infer<typeof insertInsuranceProviderSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;

export type PatientVolume = typeof patientVolume.$inferSelect;
export type InsertPatientVolume = z.infer<typeof insertPatientVolumeSchema>;

// ---- Insurance types ----
export type InsuranceClaim = typeof insuranceClaims.$inferSelect;
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;

export type InsurancePayment = typeof insurancePayments.$inferSelect;
export type InsertInsurancePayment = z.infer<typeof insertInsurancePaymentSchema>;

// ---- NEW: Insurance Departments & Payments types ----
export type InsuranceDepartmentPortion = typeof insuranceDepartmentPortions.$inferSelect;
export type InsertInsuranceDepartmentPortion = z.infer<typeof insertInsuranceDepartmentPortionSchema>;

export type InsuranceLabPayment = typeof insuranceLabPayments.$inferSelect;
export type InsertInsuranceLabPayment = z.infer<typeof insertInsuranceLabPaymentSchema>;

// ---- Reconciliation types ----
export type ClaimReconRun = typeof claimReconRuns.$inferSelect;
export type InsertClaimReconRun = z.infer<typeof insertClaimReconRunSchema>;

export type ClaimReconClaim = typeof claimReconClaims.$inferSelect;
export type InsertClaimReconClaim = z.infer<typeof insertClaimReconClaimSchema>;

export type ClaimReconRemittance = typeof claimReconRemittances.$inferSelect;
export type InsertClaimReconRemittance = z.infer<typeof insertClaimReconRemittanceSchema>;
