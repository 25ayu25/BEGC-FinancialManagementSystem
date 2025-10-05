import {
  users,
  departments,
  insuranceProviders,
  transactions,
  monthlyReports,
  receipts,
  patientVolume,
  // NEW: insurance
  insuranceClaims,
  insurancePayments,
  // Types
  type User,
  type InsertUser,
  type Department,
  type InsertDepartment,
  type InsuranceProvider,
  type InsertInsuranceProvider,
  type Transaction,
  type InsertTransaction,
  type MonthlyReport,
  type InsertMonthlyReport,
  type Receipt,
  type InsertReceipt,
  type PatientVolume,
  type InsertPatientVolume,
  // NEW: insurance types
  type InsuranceClaim,
  type InsertInsuranceClaim,
  type InsurancePayment,
  type InsertInsurancePayment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lt, sql } from "drizzle-orm";

/* ---------- helpers: half-open window & month math ---------- */

function isUtcMidnight(d: Date) {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/** Treat endDate as **exclusive**. For backward-compat:
 *  - If endDate is at 00:00:00.000 UTC (date-only), bump by +1 day.
 *  - Otherwise, use as-is (assumed already exclusive).
 */
function toEndExclusive(end?: Date): Date | undefined {
  if (!end) return undefined;
  if (isUtcMidnight(end)) {
    return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
  }
  return end;
}

function monthStartUTC(y: number, m1_12: number) {
  return new Date(Date.UTC(y, m1_12 - 1, 1, 0, 0, 0, 0));
}
function nextMonthUTC(y: number, m1_12: number) {
  return m1_12 === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m1_12, 1));
}

/* ---------- storage interface ---------- */

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // Departments
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;

  // Insurance Providers
  getInsuranceProviders(): Promise<InsuranceProvider[]>;
  createInsuranceProvider(provider: InsertInsuranceProvider): Promise<InsuranceProvider>;

  // Transactions
  getTransactions(filters?: {
    startDate?: Date; // inclusive
    endDate?: Date; // exclusive (date-only is auto-bumped to next day)
    departmentId?: string;
    insuranceProviderId?: string;
    currency?: "SSP" | "USD";
    type?: "income" | "expense";
    limit?: number;
  }): Promise<Transaction[]>;

  getTransactionsPaginated(filters?: {
    startDate?: Date; // inclusive
    endDate?: Date; // exclusive (date-only is auto-bumped to next day)
    departmentId?: string;
    insuranceProviderId?: string;
    currency?: "SSP" | "USD";
    type?: "income" | "expense";
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    transactions: (Transaction & {
      departmentName: string | null;
      insuranceProviderName: string | null;
    })[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }>;

  getTransactionsBetween(
    startInclusive: Date,
    endExclusive: Date,
    opts?: {
      departmentId?: string;
      insuranceProviderId?: string;
      currency?: "SSP" | "USD";
      type?: "income" | "expense";
      limit?: number;
      offset?: number;
    }
  ): Promise<
    (Transaction & { departmentName: string | null; insuranceProviderName: string | null })[]
  >;

  getTransactionById(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<void>;

  // Monthly Reports
  getMonthlyReport(year: number, month: number): Promise<MonthlyReport | undefined>;
  createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport>;
  getMonthlyReports(limit?: number): Promise<MonthlyReport[]>;
  deleteMonthlyReport(reportId: string): Promise<void>;

  // Receipts
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceiptsByTransaction(transactionId: string): Promise<Receipt[]>;

  // Patient Volume
  createPatientVolume(volume: InsertPatientVolume): Promise<PatientVolume>;
  getPatientVolumeByDate(date: Date, departmentId?: string): Promise<PatientVolume[]>;
  getPatientVolumeForMonth(year: number, month: number): Promise<PatientVolume[]>;
  getPatientVolumeByDateRange(startDate: Date, endDate: Date): Promise<PatientVolume[]>;
  updatePatientVolume(id: string, updates: Partial<PatientVolume>): Promise<PatientVolume | undefined>;
  deletePatientVolume(id: string): Promise<void>;

  // Analytics
  getDashboardData(args: {
    year: number;
    month: number;
    range: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalIncome: string;
    totalIncomeSSP: string;
    totalIncomeUSD: string; // Insurance (USD) only
    totalExpenses: string;
    totalExpensesSSP: string;
    totalExpensesUSD: string;
    netIncome: string;
    netIncomeSSP: string;
    netIncomeUSD: string;
    departmentBreakdown: Record<string, string>;
    insuranceBreakdown: Record<string, string>;
    expenseBreakdown: Record<string, string>;
    recentTransactions: Transaction[];
    totalPatients: number;
    previousPeriod: {
      totalIncomeSSP: number;
      totalExpensesSSP: number;
      netIncomeSSP: number;
      totalIncomeUSD: number;
    };
    changes: {
      incomeChangeSSP: number;
      expenseChangeSSP: number;
      netIncomeChangeSSP: number;
      incomeChangeUSD: number;
    };
  }>;

  getIncomeTrends(days: number): Promise<
    Array<{ date: string; income: number; incomeUSD: number; incomeSSP: number }>
  >; // USD is insurance-only

  getIncomeTrendsForMonth(
    year: number,
    month: number
  ): Promise<Array<{ date: string; income: number; incomeUSD: number; incomeSSP: number }>>; // USD insurance-only

  getIncomeTrendsForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; income: number; incomeUSD: number; incomeSSP: number }>>; // USD insurance-only

  getDetailedTransactionsForMonth(year: number, month: number): Promise<
    Array<{
      id: string;
      date: string;
      fullDate: string;
      amount: number;
      currency: string;
      departmentId: string;
      departmentName: string;
      description: string;
    }>
  >;

  /* -------- NEW: Insurance Management -------- */

  createInsuranceClaim(
    claim: InsertInsuranceClaim & { createdBy?: string | null }
  ): Promise<InsuranceClaim>;

  listInsuranceClaims(filters?: {
    providerId?: string;
    year?: number;
    month?: number;
    status?: string;
  }): Promise<
    Array<
      InsuranceClaim & {
        providerName: string;
        paidToDate: number;
        balance: number;
      }
    >
  >;

  getInsuranceClaim(id: string): Promise<
    (InsuranceClaim & { providerName: string; paidToDate: number; balance: number }) | undefined
  >;

  updateInsuranceClaim(id: string, updates: Partial<InsuranceClaim>): Promise<InsuranceClaim | undefined>;

  createInsurancePayment(
    payment: InsertInsurancePayment & { createdBy?: string | null }
  ): Promise<InsurancePayment>;

  getInsuranceBalances(filters?: {
    providerId?: string;
  }): Promise<{
    providers: Array<{ providerId: string; providerName: string; claimed: number; paid: number; balance: number }>;
    claims: Array<
      InsuranceClaim & { providerName: string; paidToDate: number; balance: number }
    >;
  }>;
}

/* ----------------------------- implementation ----------------------------- */

export class DatabaseStorage implements IStorage {
  /* Users */
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`);
    return user || undefined;
  }
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  /* Departments & Providers */
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.isActive, true));
  }
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }
  async getInsuranceProviders(): Promise<InsuranceProvider[]> {
    return await db.select().from(insuranceProviders).where(eq(insuranceProviders.isActive, true));
  }
  async createInsuranceProvider(provider: InsertInsuranceProvider): Promise<InsuranceProvider> {
    const [newProvider] = await db.insert(insuranceProviders).values(provider).returning();
    return newProvider;
  }

  /* Transactions */
  async getTransactions(filters?: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    insuranceProviderId?: string;
    currency?: "SSP" | "USD";
    type?: "income" | "expense";
    limit?: number;
  }): Promise<Transaction[]> {
    const conds: any[] = [];
    if (filters?.startDate) conds.push(gte(transactions.date, filters.startDate));
    if (filters?.endDate) conds.push(lt(transactions.date, toEndExclusive(filters.endDate)!));
    if (filters?.departmentId) conds.push(eq(transactions.departmentId, filters.departmentId));
    if (filters?.insuranceProviderId)
      conds.push(eq(transactions.insuranceProviderId, filters.insuranceProviderId));
    if (filters?.currency) conds.push(eq(transactions.currency, filters.currency));
    if (filters?.type) conds.push(eq(transactions.type, filters.type));

    let q = db.select().from(transactions);
    if (conds.length) q = q.where(and(...conds));
    if (filters?.limit) q = q.limit(filters.limit);
    return await q.orderBy(desc(transactions.date));
  }

  async getTransactionsPaginated(filters?: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    insuranceProviderId?: string;
    currency?: "SSP" | "USD";
    type?: "income" | "expense";
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    const conds: any[] = [];
    if (filters?.startDate) conds.push(gte(transactions.date, filters.startDate));
    if (filters?.endDate) conds.push(lt(transactions.date, toEndExclusive(filters.endDate)!));
    if (filters?.departmentId) conds.push(eq(transactions.departmentId, filters.departmentId));
    if (filters?.insuranceProviderId)
      conds.push(eq(transactions.insuranceProviderId, filters.insuranceProviderId));
    if (filters?.currency) conds.push(eq(transactions.currency, filters.currency));
    if (filters?.type) conds.push(eq(transactions.type, filters.type));
    if (filters?.searchQuery) {
      conds.push(sql`${transactions.description} ILIKE ${"%" + filters.searchQuery + "%"}`);
    }

    let countQ = db.select({ count: sql<number>`count(*)` }).from(transactions);
    if (conds.length) countQ = countQ.where(and(...conds));
    const [{ count: total }] = await countQ;

    let dataQ = db
      .select({
        id: transactions.id,
        type: transactions.type,
        departmentId: transactions.departmentId,
        amount: transactions.amount,
        currency: transactions.currency,
        description: transactions.description,
        date: transactions.date,
        receiptPath: transactions.receiptPath,
        insuranceProviderId: transactions.insuranceProviderId,
        expenseCategory: transactions.expenseCategory,
        staffType: transactions.staffType,
        createdBy: transactions.createdBy,
        syncStatus: transactions.syncStatus,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        departmentName: departments.name,
        insuranceProviderName: insuranceProviders.name,
      })
      .from(transactions)
      .leftJoin(departments, eq(transactions.departmentId, departments.id))
      .leftJoin(insuranceProviders, eq(transactions.insuranceProviderId, insuranceProviders.id));

    if (conds.length) dataQ = dataQ.where(and(...conds));

    const rows = await dataQ.orderBy(desc(transactions.date)).limit(limit).offset(offset);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      transactions: rows,
      total,
      page,
      totalPages,
      hasMore,
    };
  }

  async getTransactionsBetween(
    startInclusive: Date,
    endExclusive: Date,
    opts?: {
      departmentId?: string;
      insuranceProviderId?: string;
      currency?: "SSP" | "USD";
      type?: "income" | "expense";
      limit?: number;
      offset?: number;
    }
  ): Promise<
    (Transaction & { departmentName: string | null; insuranceProviderName: string | null })[]
  > {
    const conds: any[] = [
      gte(transactions.date, startInclusive),
      lt(transactions.date, endExclusive),
    ];
    if (opts?.departmentId) conds.push(eq(transactions.departmentId, opts.departmentId));
    if (opts?.insuranceProviderId)
      conds.push(eq(transactions.insuranceProviderId, opts.insuranceProviderId));
    if (opts?.currency) conds.push(eq(transactions.currency, opts.currency));
    if (opts?.type) conds.push(eq(transactions.type, opts.type));

    const limit = opts?.limit ?? 1000;
    const offset = opts?.offset ?? 0;

    return await db
      .select({
        id: transactions.id,
        type: transactions.type,
        departmentId: transactions.departmentId,
        amount: transactions.amount,
        currency: transactions.currency,
        description: transactions.description,
        date: transactions.date,
        receiptPath: transactions.receiptPath,
        insuranceProviderId: transactions.insuranceProviderId,
        expenseCategory: transactions.expenseCategory,
        staffType: transactions.staffType,
        createdBy: transactions.createdBy,
        syncStatus: transactions.syncStatus,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        departmentName: departments.name,
        insuranceProviderName: insuranceProviders.name,
      })
      .from(transactions)
      .leftJoin(departments, eq(transactions.departmentId, departments.id))
      .leftJoin(insuranceProviders, eq(transactions.insuranceProviderId, insuranceProviders.id))
      .where(and(...conds))
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);
  }

  async getTransactionById(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const [updated] = await db
      .update(transactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return updated || undefined;
  }
  async deleteTransaction(id: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  /* Monthly Reports */
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport | undefined> {
    const [report] = await db
      .select()
      .from(monthlyReports)
      .where(and(eq(monthlyReports.year, year), eq(monthlyReports.month, month)));
    return report || undefined;
  }
  async createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport> {
    const [newReport] = await db.insert(monthlyReports).values(report).returning();
    return newReport;
  }
  async getMonthlyReports(limit?: number): Promise<MonthlyReport[]> {
    let q = db.select().from(monthlyReports).orderBy(desc(monthlyReports.year), desc(monthlyReports.month));
    if (limit) q = q.limit(limit);
    return await q;
  }
  async deleteMonthlyReport(reportId: string): Promise<void> {
    await db.delete(monthlyReports).where(eq(monthlyReports.id, reportId));
  }

  /* Receipts */
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [newReceipt] = await db.insert(receipts).values(receipt).returning();
    return newReceipt;
  }
  async getReceiptsByTransaction(transactionId: string): Promise<Receipt[]> {
    return await db.select().from(receipts).where(eq(receipts.transactionId, transactionId));
  }

  /* Dashboard / Analytics (SSP totals; USD = Insurance only) */
  async getDashboardData({
    year,
    month,
    range,
    startDate: customStartDate,
    endDate: customEndDate,
  }: {
    year: number;
    month: number;
    range: string;
    startDate?: string;
    endDate?: string;
  }) {
    // Build half-open window [start, end)
    let startDate: Date;
    let endDateExclusive: Date;

    if (range === "custom" && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      const endCandidate = new Date(customEndDate);
      endDateExclusive = toEndExclusive(endCandidate)!;
    } else {
      switch (range) {
        case "current-month":
          startDate = monthStartUTC(year, month);
          endDateExclusive = nextMonthUTC(year, month);
          break;
        case "last-month": {
          const d = new Date(Date.UTC(year, month - 2, 1));
          const y = d.getUTCFullYear();
          const m = d.getUTCMonth() + 1;
          startDate = monthStartUTC(y, m);
          endDateExclusive = nextMonthUTC(y, m);
          break;
        }
        case "last-3-months": {
          const from = new Date(Date.UTC(year, month - 3, 1));
          startDate = monthStartUTC(from.getUTCFullYear(), from.getUTCMonth() + 1);
          endDateExclusive = nextMonthUTC(year, month);
          break;
        }
        case "year":
        default:
          startDate = new Date(Date.UTC(year, 0, 1));
          endDateExclusive = new Date(Date.UTC(year + 1, 0, 1));
      }
    }

    const txData = await db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lt(transactions.date, endDateExclusive)));

    const sum = (arr: typeof txData, pred: (t: Transaction) => boolean) =>
      arr.filter(pred).reduce((a, t) => a + Number(t.amount || 0), 0);

    const totalIncomeSSP = sum(txData, (t) => t.type === "income" && t.currency === "SSP");

    // USD tile is insurance income only
    const totalIncomeUSD = sum(
      txData,
      (t) => t.type === "income" && t.currency === "USD" && !!t.insuranceProviderId
    );

    const totalExpenseSSP = sum(txData, (t) => t.type === "expense" && t.currency === "SSP");
    const totalExpenseUSD = sum(txData, (t) => t.type === "expense" && t.currency === "USD");

    const departmentBreakdown: Record<string, string> = {};
    for (const t of txData) {
      if (t.type !== "income" || t.currency !== "SSP" || !t.departmentId) continue;
      departmentBreakdown[t.departmentId] = (
        Number(departmentBreakdown[t.departmentId] || 0) + Number(t.amount || 0)
      ).toString();
    }

    // Insurance breakdown (USD by provider)
    const allProviders = await db.select().from(insuranceProviders);
    const providerMap = new Map<string, string>();
    allProviders.forEach((p) => providerMap.set(p.id, p.name));

    const insuranceBreakdown: Record<string, string> = {};
    for (const t of txData) {
      if (t.type !== "income" || t.currency !== "USD" || !t.insuranceProviderId) continue;
      const name = providerMap.get(t.insuranceProviderId);
      if (!name) continue;
      insuranceBreakdown[name] = (Number(insuranceBreakdown[name] || 0) + Number(t.amount || 0)).toString();
    }

    // Expense breakdown (SSP only)
    const expenseBreakdown: Record<string, string> = {};
    for (const t of txData) {
      if (t.type === "expense" && t.currency === "SSP" && t.expenseCategory) {
        expenseBreakdown[t.expenseCategory] = (
          Number(expenseBreakdown[t.expenseCategory] || 0) + Number(t.amount || 0)
        ).toString();
      }
    }

    // Patients in same window
    const patientVolumeData = await db
      .select()
      .from(patientVolume)
      .where(and(gte(patientVolume.date, startDate), lt(patientVolume.date, endDateExclusive)));

    const totalPatients = patientVolumeData.reduce((s, pv) => s + (pv.patientCount || 0), 0);

    const recentTransactions = txData
      .slice()
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, 10);

    return {
      totalIncome: totalIncomeSSP.toString(),
      totalIncomeSSP: totalIncomeSSP.toString(),
      totalIncomeUSD: totalIncomeUSD.toString(),
      totalExpenses: totalExpenseSSP.toString(),
      totalExpensesSSP: totalExpenseSSP.toString(),
      totalExpensesUSD: totalExpenseUSD.toString(),
      netIncome: (totalIncomeSSP - totalExpenseSSP).toString(),
      netIncomeSSP: (totalIncomeSSP - totalExpenseSSP).toString(),
      netIncomeUSD: (totalIncomeUSD - totalExpenseUSD).toString(),
      departmentBreakdown,
      insuranceBreakdown,
      expenseBreakdown,
      recentTransactions,
      totalPatients,
      previousPeriod: {
        totalIncomeSSP: 0,
        totalExpensesSSP: 0,
        netIncomeSSP: 0,
        totalIncomeUSD: 0,
      },
      changes: {
        incomeChangeSSP: 0,
        expenseChangeSSP: 0,
        netIncomeChangeSSP: 0,
        incomeChangeUSD: 0,
      },
    };
  }

  /* Trends (USD = insurance-only) */
  async getIncomeTrends(days: number) {
    const endEx = new Date(); // now (exclusive)
    const start = new Date(endEx);
    start.setDate(start.getDate() - days);

    const rows = await db
      .select({
        dateISO: sql<string>`DATE(${transactions.date})`,
        incomeUSD: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type}='income' AND ${transactions.currency}='USD' AND ${transactions.insuranceProviderId} IS NOT NULL THEN ${transactions.amount} ELSE 0 END),0)`,
        incomeSSP: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type}='income' AND ${transactions.currency}='SSP' THEN ${transactions.amount} ELSE 0 END),0)`,
      })
      .from(transactions)
      .where(and(gte(transactions.date, start), lt(transactions.date, endEx)))
      .groupBy(sql`DATE(${transactions.date})`)
      .orderBy(sql`DATE(${transactions.date})`);

    // Fill missing dates for chart
    const result: Array<{ date: string; income: number; incomeUSD: number; incomeSSP: number }> = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endDay = new Date(Date.UTC(endEx.getUTCFullYear(), endEx.getUTCMonth(), endEx.getUTCDate()));
    while (cur <= endDay) {
      const iso = cur.toISOString().slice(0, 10);
      const hit = rows.find((r) => r.dateISO === iso);
      result.push({
        date: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        income: 0,
        incomeUSD: hit ? Number(hit.incomeUSD) : 0,
        incomeSSP: hit ? Number(hit.incomeSSP) : 0,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return result;
  }

  async getIncomeTrendsForMonth(year: number, month: number) {
    const start = monthStartUTC(year, month);
    const endEx = nextMonthUTC(year, month);

    const rows = await db
      .select({
        dateISO: sql<string>`DATE(${transactions.date})`,
        incomeUSD: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type}='income' AND ${transactions.currency}='USD' AND ${transactions.insuranceProviderId} IS NOT NULL THEN ${transactions.amount} ELSE 0 END),0)`,
        incomeSSP: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type}='income' AND ${transactions.currency}='SSP' THEN ${transactions.amount} ELSE 0 END),0)`,
      })
      .from(transactions)
      .where(and(gte(transactions.date, start), lt(transactions.date, endEx)))
      .groupBy(sql`DATE(${transactions.date})`)
      .orderBy(sql`DATE(${transactions.date})`);

    const result: Array<{ date: string; income: number; incomeUSD: number; incomeSSP: number }> = [];
    const cur = new Date(start);
    while (cur < endEx) {
      const iso = cur.toISOString().slice(0, 10);
      const hit = rows.find((r) => r.dateISO === iso);
      result.push({
        date: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        income: 0,
        incomeUSD: hit ? Number(hit.incomeUSD) : 0,
        incomeSSP: hit ? Number(hit.incomeSSP) : 0,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return result;
  }

  async getIncomeTrendsForDateRange(startDate: Date, endDate: Date) {
    const endEx = toEndExclusive(endDate)!;

    const rows = await db
      .select({
        dateISO: sql<string>`DATE(${transactions.date})`,
        incomeUSD: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type}='income' AND ${transactions.currency}='USD' AND ${transactions.insuranceProviderId} IS NOT NULL THEN ${transactions.amount} ELSE 0 END),0)`,
        incomeSSP: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type}='income' AND ${transactions.currency}='SSP' THEN ${transactions.amount} ELSE 0 END),0)`,
      })
      .from(transactions)
      .where(and(gte(transactions.date, startDate), lt(transactions.date, endEx)))
      .groupBy(sql`DATE(${transactions.date})`)
      .orderBy(sql`DATE(${transactions.date})`);

    const result: Array<{ date: string; income: number; incomeUSD: number; incomeSSP: number }> = [];
    const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const last = new Date(Date.UTC(endEx.getUTCFullYear(), endEx.getUTCMonth(), endEx.getUTCDate()));
    while (cur < last) {
      const iso = cur.toISOString().slice(0, 10);
      const hit = rows.find((r) => r.dateISO === iso);
      result.push({
        date: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        income: 0,
        incomeUSD: hit ? Number(hit.incomeUSD) : 0,
        incomeSSP: hit ? Number(hit.incomeSSP) : 0,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return result;
  }

  // Detailed transactions for a month (used by data table)
  async getDetailedTransactionsForMonth(year: number, month: number) {
    const start = monthStartUTC(year, month);
    const endEx = nextMonthUTC(year, month);

    const rows = await db
      .select({
        id: transactions.id,
        dateISO: sql<string>`DATE(${transactions.date})`,
        fullDate: sql<string>`${transactions.date}`,
        amount: transactions.amount,
        currency: transactions.currency,
        departmentId: transactions.departmentId,
        departmentName: departments.name,
        description: transactions.description,
      })
      .from(transactions)
      .leftJoin(departments, eq(transactions.departmentId, departments.id))
      .where(and(eq(transactions.type, "income"), gte(transactions.date, start), lt(transactions.date, endEx)))
      .orderBy(transactions.date);

    return rows.map((r) => {
      let departmentName = r.departmentName || "Other";
      if (r.departmentId === "4242abf4-e68e-48c8-9eaf-ada2612bd4c2") departmentName = "Consultation";
      else if (r.departmentId === "ae648a70-c159-43b7-b814-7dadb213ae8d") departmentName = "Laboratory";
      else if (r.departmentId === "09435c53-9061-429b-aecf-677b12bbdbd7") departmentName = "Ultrasound";
      else if (r.departmentId === "6a06d917-a94a-4637-b1f6-a3fd6855ddd6") departmentName = "X-Ray";
      else if (r.departmentId === "8fb395f9-ae59-4ddc-9ad3-e56b7fda161c") departmentName = "Pharmacy";

      const d = new Date(r.dateISO + "T00:00:00Z");
      return {
        id: r.id,
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: new Date(r.fullDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        amount: Number(r.amount),
        currency: r.currency,
        departmentId: r.departmentId || "",
        departmentName,
        description: r.description || "",
      };
    });
  }

  /* Patient Volume (half-open day [start, nextDay) ) */
  async createPatientVolume(volume: InsertPatientVolume): Promise<PatientVolume> {
    const [newVolume] = await db.insert(patientVolume).values(volume).returning();
    return newVolume;
  }

  async getPatientVolumeByDate(date: Date, departmentId?: string): Promise<PatientVolume[]> {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const nextDay = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));

    const conds: any[] = [gte(patientVolume.date, startOfDay), lt(patientVolume.date, nextDay)];
    if (departmentId && departmentId !== "all-departments") {
      conds.push(eq(patientVolume.departmentId, departmentId));
    }
    return await db.select().from(patientVolume).where(and(...conds)).orderBy(patientVolume.date);
  }

  async getPatientVolumeForMonth(year: number, month: number): Promise<PatientVolume[]> {
    const start = monthStartUTC(year, month);
    const endEx = nextMonthUTC(year, month);
    return await db
      .select()
      .from(patientVolume)
      .where(and(gte(patientVolume.date, start), lt(patientVolume.date, endEx)))
      .orderBy(patientVolume.date);
  }

  async getPatientVolumeByDateRange(startDate: Date, endDate: Date): Promise<PatientVolume[]> {
    const endEx = toEndExclusive(endDate)!;
    return await db
      .select()
      .from(patientVolume)
      .where(and(gte(patientVolume.date, startDate), lt(patientVolume.date, endEx)))
      .orderBy(patientVolume.date);
  }

  async updatePatientVolume(id: string, updates: Partial<PatientVolume>): Promise<PatientVolume | undefined> {
    const [updated] = await db
      .update(patientVolume)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(patientVolume.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePatientVolume(id: string): Promise<void> {
    await db.delete(patientVolume).where(eq(patientVolume.id, id));
  }

  /* ---------------- Insurance Management (new) ---------------- */

  // Create a monthly claim (coerce dates; allow createdBy passthrough)
  async createInsuranceClaim(
    claim: InsertInsuranceClaim & { createdBy?: string | null }
  ): Promise<InsuranceClaim> {
    const row: InsertInsuranceClaim = {
      ...claim,
      periodStart: new Date(claim.periodStart as any),
      periodEnd: new Date(claim.periodEnd as any),
    };
    const [created] = await db.insert(insuranceClaims).values(row).returning();
    return created;
  }

  // List claims with paid-to-date and balance
  async listInsuranceClaims(filters?: {
    providerId?: string;
    year?: number;
    month?: number;
    status?: string;
  }) {
    const whereConds: any[] = [];
    if (filters?.providerId) whereConds.push(eq(insuranceClaims.providerId, filters.providerId));
    if (filters?.year) whereConds.push(eq(insuranceClaims.periodYear, filters.year));
    if (filters?.month) whereConds.push(eq(insuranceClaims.periodMonth, filters.month));
    if (filters?.status) whereConds.push(eq(insuranceClaims.status, filters.status));

    const paidSub = db
      .select({
        claimId: insurancePayments.claimId,
        paid: sql<number>`COALESCE(SUM(${insurancePayments.amount}), 0)`,
      })
      .from(insurancePayments)
      .where(sql`${insurancePayments.claimId} IS NOT NULL`)
      .groupBy(insurancePayments.claimId)
      .as("p");

    let q = db
      .select({
        id: insuranceClaims.id,
        providerId: insuranceClaims.providerId,
        providerName: insuranceProviders.name,
        periodYear: insuranceClaims.periodYear,
        periodMonth: insuranceClaims.periodMonth,
        periodStart: insuranceClaims.periodStart,
        periodEnd: insuranceClaims.periodEnd,
        currency: insuranceClaims.currency,
        claimedAmount: insuranceClaims.claimedAmount,
        status: insuranceClaims.status,
        notes: insuranceClaims.notes,
        createdBy: insuranceClaims.createdBy,
        createdAt: insuranceClaims.createdAt,
        updatedAt: insuranceClaims.updatedAt,
        // ✅ correct alias usage:
        paidToDate: sql<number>`COALESCE(${paidSub.paid}, 0)`,
        balance: sql<number>`(${insuranceClaims.claimedAmount} - COALESCE(${paidSub.paid}, 0))`,
      })
      .from(insuranceClaims)
      .innerJoin(insuranceProviders, eq(insuranceProviders.id, insuranceClaims.providerId))
      .leftJoin(paidSub, eq(paidSub.claimId, insuranceClaims.id));

    if (whereConds.length) q = q.where(and(...whereConds));

    const rows = await q
      .orderBy(
        desc(insuranceClaims.periodYear),
        desc(insuranceClaims.periodMonth),
        desc(insuranceClaims.createdAt)
      );

    return rows.map((r: any) => ({
      ...r,
      claimedAmount: Number(r.claimedAmount),
      paidToDate: Number(r.paidToDate),
      balance: Number(r.balance),
    }));
  }

  async getInsuranceClaim(id: string) {
    const list = await this.listInsuranceClaims();
    return list.find((c) => c.id === id);
  }

  async updateInsuranceClaim(id: string, updates: Partial<InsuranceClaim>) {
    const [row] = await db
      .update(insuranceClaims)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(insuranceClaims.id, id))
      .returning();
    return row || undefined;
  }

  // Record a payment (collections) – coerce date; allow createdBy passthrough
  async createInsurancePayment(
    payment: InsertInsurancePayment & { createdBy?: string | null }
  ): Promise<InsurancePayment> {
    const row: InsertInsurancePayment = {
      ...payment,
      paymentDate: new Date(payment.paymentDate as any),
    };
    const [created] = await db.insert(insurancePayments).values(row).returning();
    return created;
  }

  // Provider + claim balances
  async getInsuranceBalances(filters?: { providerId?: string }) {
    const claimsAgg = db
      .select({
        providerId: insuranceClaims.providerId,
        claimed: sql<number>`COALESCE(SUM(${insuranceClaims.claimedAmount}), 0)`,
      })
      .from(insuranceClaims)
      .groupBy(insuranceClaims.providerId)
      .as("cagg");

    const payAgg = db
      .select({
        providerId: insurancePayments.providerId,
        paid: sql<number>`COALESCE(SUM(${insurancePayments.amount}), 0)`,
      })
      .from(insurancePayments)
      .groupBy(insurancePayments.providerId)
      .as("pagg");

    let provQ = db
      .select({
        providerId: insuranceProviders.id,
        providerName: insuranceProviders.name,
        // ✅ correct alias usage:
        claimed: sql<number>`COALESCE(${claimsAgg.claimed}, 0)`,
        paid: sql<number>`COALESCE(${payAgg.paid}, 0)`,
        balance: sql<number>`COALESCE(${claimsAgg.claimed}, 0) - COALESCE(${payAgg.paid}, 0)`,
      })
      .from(insuranceProviders)
      .leftJoin(claimsAgg, eq(claimsAgg.providerId, insuranceProviders.id))
      .leftJoin(payAgg, eq(payAgg.providerId, insuranceProviders.id));

    if (filters?.providerId) provQ = provQ.where(eq(insuranceProviders.id, filters.providerId));

    const providers = (await provQ.orderBy(insuranceProviders.name)).map((r) => ({
      ...r,
      claimed: Number(r.claimed),
      paid: Number(r.paid),
      balance: Number(r.balance),
    }));

    const claims = await this.listInsuranceClaims({
      providerId: filters?.providerId,
    });

    return { providers, claims };
  }
}

export const storage = new DatabaseStorage();
