import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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

// Insert schemas
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

// ---- NEW: Insurance insert schemas ----
export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaims).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInsurancePaymentSchema = createInsertSchema(insurancePayments).omit({
  id: true,
  createdAt: true,
});

// Types
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

// ---- NEW: Insurance types ----
export type InsuranceClaim = typeof insuranceClaims.$inferSelect;
export type InsertInsuranceClaim = z.infer<typeof insertInsuranceClaimSchema>;

export type InsurancePayment = typeof insurancePayments.$inferSelect;
export type InsertInsurancePayment = z.infer<typeof insertInsurancePaymentSchema>;
