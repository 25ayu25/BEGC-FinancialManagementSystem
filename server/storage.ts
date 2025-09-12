import { 
  users, departments, insuranceProviders, transactions, monthlyReports, receipts, patientVolume,
  type User, type InsertUser, type Department, type InsertDepartment,
  type InsuranceProvider, type InsertInsuranceProvider, type Transaction, type InsertTransaction,
  type MonthlyReport, type InsertMonthlyReport, type Receipt, type InsertReceipt,
  type PatientVolume, type InsertPatientVolume
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, lt, sql, isNotNull } from "drizzle-orm";

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
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    type?: string;
    limit?: number;
  }): Promise<Transaction[]>;
  getTransactionsPaginated(filters?: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    insuranceProviderId?: string;
    type?: string;
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }>;
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
  updatePatientVolume(id: string, updates: Partial<PatientVolume>): Promise<PatientVolume | undefined>;
  deletePatientVolume(id: string): Promise<void>;

  // Analytics
  getDashboardData({ year, month, range }: { year: number; month: number; range: string }): Promise<{
    totalIncome: string;
    totalIncomeSSP: string;
    totalIncomeUSD: string;
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
  getIncomeTrends(days: number): Promise<Array<{ date: string, income: number }>>;
  getIncomeTrendsForMonth(year: number, month: number): Promise<Array<{ date: string, income: number }>>;
  getIncomeTrendsForDateRange(startDate: Date, endDate: Date): Promise<Array<{ date: string, income: number }>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Case-insensitive lookup using ilike (PostgreSQL)
    const [user] = await db.select().from(users).where(sql`lower(${users.username}) = lower(${username})`);
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
    try {
      const [user] = await db.update(users).set({
        ...updates,
        updatedAt: new Date()
      }).where(eq(users.id, id)).returning();
      
      // Verify the update actually happened
      if (user && updates.password) {
        console.log(`Password updated for user ${id}: ${user.password === updates.password ? 'SUCCESS' : 'FAILED'}`);
      }
      
      return user;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

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

  async getTransactions(filters?: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    type?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(gte(transactions.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transactions.date, filters.endDate));
    }
    if (filters?.departmentId) {
      conditions.push(eq(transactions.departmentId, filters.departmentId));
    }
    if (filters?.type) {
      conditions.push(eq(transactions.type, filters.type));
    }

    let query = db.select().from(transactions);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(transactions.date));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async getTransactionsPaginated(filters?: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    insuranceProviderId?: string;
    type?: string;
    searchQuery?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    // Build WHERE conditions
    const conditions: any[] = [];
    
    // Apply date range filter (default to last 3 months)
    if (filters?.startDate) {
      conditions.push(gte(transactions.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transactions.date, filters.endDate));
    }
    if (filters?.departmentId) {
      conditions.push(eq(transactions.departmentId, filters.departmentId));
    }
    if (filters?.insuranceProviderId) {
      conditions.push(eq(transactions.insuranceProviderId, filters.insuranceProviderId));
    }
    if (filters?.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters?.searchQuery) {
      conditions.push(sql`${transactions.description} ILIKE ${`%${filters.searchQuery}%`}`);
    }

    // Get total count
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(transactions);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ count: total }] = await countQuery;

    // Get paginated results with insurance provider and department names
    let dataQuery = db.select({
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
    }).from(transactions)
    .leftJoin(departments, eq(transactions.departmentId, departments.id))
    .leftJoin(insuranceProviders, eq(transactions.insuranceProviderId, insuranceProviders.id));
    
    if (conditions.length > 0) {
      dataQuery = dataQuery.where(and(...conditions));
    }
    
    const transactionResults = await dataQuery
      .orderBy(desc(transactions.date))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      transactions: transactionResults,
      total,
      page,
      totalPages,
      hasMore
    };
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
    const [updated] = await db.update(transactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports)
      .where(and(eq(monthlyReports.year, year), eq(monthlyReports.month, month)));
    return report || undefined;
  }

  async createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport> {
    const [newReport] = await db.insert(monthlyReports).values(report).returning();
    return newReport;
  }

  async getMonthlyReports(limit?: number): Promise<MonthlyReport[]> {
    let query = db.select().from(monthlyReports).orderBy(desc(monthlyReports.year), desc(monthlyReports.month));
    
    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  async deleteMonthlyReport(reportId: string): Promise<void> {
    await db.delete(monthlyReports).where(eq(monthlyReports.id, reportId));
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [newReceipt] = await db.insert(receipts).values(receipt).returning();
    return newReceipt;
  }

  async getReceiptsByTransaction(transactionId: string): Promise<Receipt[]> {
    return await db.select().from(receipts).where(eq(receipts.transactionId, transactionId));
  }

  async getDashboardData({ year, month, range }: { year: number; month: number; range: string }): Promise<{
    totalIncome: string;
    totalIncomeSSP: string;
    totalIncomeUSD: string;
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
  }> {
    // Always compute in UTC and use [start, end) to avoid TZ fence-post bugs
    const startOfMonthUTC = (y: number, m1_12: number) => new Date(Date.UTC(y, m1_12 - 1, 1, 0, 0, 0));
    const nextMonthUTC = (y: number, m1_12: number) =>
      m1_12 === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m1_12, 1));

    let startDate: Date;
    let endDate: Date;

    switch (range) {
      case "current-month":
        startDate = startOfMonthUTC(year, month);
        endDate = nextMonthUTC(year, month);
        break;
      case "last-month": {
        const d = new Date(Date.UTC(year, month - 1, 1));
        const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
        startDate = startOfMonthUTC(y, m);
        endDate = nextMonthUTC(y, m);
        break;
      }
      case "last-3-months": {
        const from = new Date(Date.UTC(year, month - 3, 1));
        startDate = startOfMonthUTC(from.getUTCFullYear(), from.getUTCMonth() + 1);
        endDate = nextMonthUTC(year, month);
        break;
      }
      case "year":
      default:
        startDate = new Date(Date.UTC(year, 0, 1));
        endDate = new Date(Date.UTC(year + 1, 0, 1));
    }

    // Pull transactions only once within the window [start, end)
    const txData = await db.select().from(transactions).where(
      and(
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

    // Helper function for sums
    const sum = (arr: typeof txData, filter: (t: any) => boolean) =>
      arr.filter(filter).reduce((a, t) => a + Number(t.amount || 0), 0);

    const totalIncomeSSP = sum(txData, t => t.type === "income" && t.currency === "SSP");
    const totalIncomeUSD = sum(txData, t => t.type === "income" && t.currency === "USD");
    const totalExpenseSSP = sum(txData, t => t.type === "expense" && t.currency === "SSP");
    const totalExpenseUSD = sum(txData, t => t.type === "expense" && t.currency === "USD");

    // Department income (SSP only to match main total calculation)
    const departmentMap = new Map<string, number>();
    for (const t of txData) {
      if (t.type !== "income") continue;
      if (!t.departmentId) continue;
      // CRITICAL FIX: Only count SSP transactions to match totalIncomeSSP
      if (t.currency !== "SSP") continue;
      const key = String(t.departmentId);
      departmentMap.set(key, (departmentMap.get(key) || 0) + Number(t.amount || 0));
    }
    const departments = Array.from(departmentMap.entries()).map(([departmentId, amountSSP]) => ({
      departmentId, amountSSP
    }));

    // Create legacy format for backward compatibility
    const departmentBreakdown: Record<string, string> = {};
    departments.forEach(({ departmentId, amountSSP }) => {
      departmentBreakdown[departmentId] = amountSSP.toString();
    });

    // Expense breakdown
    const expenseBreakdown: Record<string, string> = {};
    for (const t of txData) {
      if (t.type === "expense" && t.expenseCategory && t.currency === "SSP") {
        expenseBreakdown[t.expenseCategory] = (parseFloat(expenseBreakdown[t.expenseCategory] || "0") + Number(t.amount)).toString();
      }
    }

    // Format as strings for legacy API
    const totalIncomeSSPStr = totalIncomeSSP.toString();
    const totalIncomeUSDStr = totalIncomeUSD.toString();
    const totalExpensesSSPStr = totalExpenseSSP.toString();
    const totalExpensesUSDStr = totalExpenseUSD.toString();
    const netIncomeSSPStr = (totalIncomeSSP - totalExpenseSSP).toString();
    const netIncomeUSDStr = (totalIncomeUSD - totalExpenseUSD).toString();


    
    // Insurance breakdown – count transactions with insuranceProviderId OR type = 'insurance'
    const insuranceMap = new Map<string, number>();
    for (const t of txData) {
      const isInsuranceTx =
        (t as any).insuranceProviderId != null ||
        (typeof (t as any).type !== "undefined" && String((t as any).type).toLowerCase() === "insurance");
      if (!isInsuranceTx) continue;

      const providerName = providerMap.get((t as any).insuranceProviderId) ?? "Other";

      // Only count USD amounts, mirroring original behaviour
      const amount = (t as any).currency === "USD" ? Number((t as any).amount || 0) : 0;

      insuranceMap.set(providerName, (insuranceMap.get(providerName) || 0) + amount);
    }

    const insuranceBreakdown: Record<string, string> = {};
    Array.from(insuranceMap.entries()).forEach(([provider, amount]) => {
      insuranceBreakdown[provider] = amount.toString();
    });

    // Convert Map entries to object
    Array.from(insuranceMap.entries()).forEach(([provider, amount]) => {
      insuranceBreakdown[provider] = amount.toString();
    });
    
    // Calculate total patients for the same period
    const patientVolumeData = await db.select().from(patientVolume).where(
      and(
        gte(patientVolume.date, startDate),
        lt(patientVolume.date, endDate)
      )
    );
    
    const totalPatients = patientVolumeData.reduce((sum, pv) => sum + (pv.patientCount || 0), 0);
    
    // Recent transactions (get last 10 from the filtered set)
    const recentTransactions = txData.slice(0, 10);

    return {
      totalIncome: totalIncomeSSPStr, // Legacy field - only SSP to avoid currency mixing
      totalIncomeSSP: totalIncomeSSPStr,
      totalIncomeUSD: totalIncomeUSDStr,
      totalExpenses: totalExpensesSSPStr, // Legacy field - only SSP to avoid currency mixing 
      totalExpensesSSP: totalExpensesSSPStr,
      totalExpensesUSD: totalExpensesUSDStr,
      netIncome: netIncomeSSPStr, // Legacy field - only SSP to avoid currency mixing
      netIncomeSSP: netIncomeSSPStr,
      netIncomeUSD: netIncomeUSDStr,
      departmentBreakdown,
      insuranceBreakdown,
      expenseBreakdown,
      recentTransactions,
      totalPatients,
      // Previous period data for comparisons
      previousPeriod: {
        totalIncomeSSP: 0,
        totalExpensesSSP: 0,
        netIncomeSSP: 0,
        totalIncomeUSD: 0
      },
      // Percentage changes
      changes: {
        incomeChangeSSP: 0,
        expenseChangeSSP: 0,
        netIncomeChangeSSP: 0,
        incomeChangeUSD: 0
      }
    };
  }

  async getIncomeTrends(days: number): Promise<Array<{ date: string, income: number, incomeUSD: number, incomeSSP: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const incomeData = await db.select({
      date: sql<string>`DATE(${transactions.date})`,
      incomeUSD: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`,
      incomeSSP: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`
    }).from(transactions)
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(sql`DATE(${transactions.date})`)
    .orderBy(sql`DATE(${transactions.date})`);

    // Fill in missing dates with 0 income
    const result: Array<{ date: string, income: number, incomeUSD: number, incomeSSP: number }> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const existingData = incomeData.find(d => d.date === dateStr);
      
      result.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: 0, // Deprecated - do not use mixed currency total
        incomeUSD: existingData ? Number(existingData.incomeUSD) : 0,
        incomeSSP: existingData ? Number(existingData.incomeSSP) : 0
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return result;
  }

  async getIncomeTrendsForMonth(year: number, month: number): Promise<Array<{ date: string, income: number, incomeUSD: number, incomeSSP: number }>> {
    // Get start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month

    const incomeData = await db.select({
      date: sql<string>`DATE(${transactions.date})`,
      incomeUSD: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`,
      incomeSSP: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`,
      // Remove mixed currency total - only use separate SSP/USD amounts
    }).from(transactions)
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(sql`DATE(${transactions.date})`)
    .orderBy(sql`DATE(${transactions.date})`);

    // Show the entire month - all days from 1st to last day
    const result: Array<{ date: string, income: number, incomeUSD: number, incomeSSP: number }> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const existingData = incomeData.find(d => d.date === dateStr);
      
      result.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: 0, // Deprecated - do not use mixed currency total
        incomeUSD: existingData ? Number(existingData.incomeUSD) : 0,
        incomeSSP: existingData ? Number(existingData.incomeSSP) : 0
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return result;
  }

  // Get detailed transaction data with department information for the data table
  async getDetailedTransactionsForMonth(year: number, month: number): Promise<Array<{ 
    id: string,
    date: string, 
    fullDate: string,
    amount: number, 
    currency: string,
    departmentId: string,
    departmentName: string,
    description: string
  }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactionData = await db.select({
      id: transactions.id,
      date: sql<string>`DATE(${transactions.date})`,
      fullDate: sql<string>`${transactions.date}`,
      amount: transactions.amount,
      currency: transactions.currency,
      departmentId: transactions.departmentId,
      departmentName: departments.name,
      description: transactions.description
    }).from(transactions)
    .leftJoin(departments, eq(transactions.departmentId, departments.id))
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .orderBy(transactions.date);

    return transactionData.map(row => {
      // Map department names properly, including handling the "Other" department
      let departmentName = row.departmentName || 'Other income';
      if (row.departmentId === '4242abf4-e68e-48c8-9eaf-ada2612bd4c2') departmentName = 'Consultation';
      else if (row.departmentId === 'ae648a70-c159-43b7-b814-7dadb213ae8d') departmentName = 'Laboratory';
      else if (row.departmentId === '09435c53-9061-429b-aecf-677b12bbdbd7') departmentName = 'Ultrasound';
      else if (row.departmentId === '6a06d917-a94a-4637-b1f6-a3fd6855ddd6') departmentName = 'X-Ray';
      else if (row.departmentId === '8fb395f9-ae59-4ddc-9ad3-e56b7fda161c') departmentName = 'Pharmacy';
      // Handle the OTHER department specifically
      else if (row.departmentName === 'Other' || !row.departmentName) departmentName = 'Other';
      
      return {
        id: row.id,
        date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: new Date(row.fullDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }),
        amount: Number(row.amount),
        currency: row.currency,
        departmentId: row.departmentId || '',
        departmentName,
        description: row.description || ''
      };
    });
  }

  async getIncomeTrendsForDateRange(startDate: Date, endDate: Date): Promise<Array<{ date: string, income: number, incomeUSD: number, incomeSSP: number }>> {
    const incomeData = await db.select({
      date: sql<string>`DATE(${transactions.date})`,
      incomeUSD: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`,
      incomeSSP: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`
    }).from(transactions)
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(sql`DATE(${transactions.date})`)
    .orderBy(sql`DATE(${transactions.date})`);

    // Fill in missing dates with 0 income
    const result: Array<{ date: string, income: number, incomeUSD: number, incomeSSP: number }> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const existingData = incomeData.find(d => d.date === dateStr);
      
      result.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: 0, // Deprecated - do not use mixed currency total
        incomeUSD: existingData ? Number(existingData.incomeUSD) : 0,
        incomeSSP: existingData ? Number(existingData.incomeSSP) : 0
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return result;
  }

  // Patient Volume Methods
  async createPatientVolume(volume: InsertPatientVolume): Promise<PatientVolume> {
    const [newVolume] = await db.insert(patientVolume).values(volume).returning();
    return newVolume;
  }

  async getPatientVolumeByDate(date: Date, departmentId?: string): Promise<PatientVolume[]> {
    // Create date range for the entire day in UTC
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    console.log(`Searching between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    const conditions = [
      gte(patientVolume.date, startOfDay),
      lte(patientVolume.date, endOfDay)
    ];

    if (departmentId && departmentId !== 'all-departments') {
      conditions.push(eq(patientVolume.departmentId, departmentId));
    }

    const results = await db.select().from(patientVolume)
      .where(and(...conditions))
      .orderBy(patientVolume.date);
      
    console.log(`Found ${results.length} patient volume records`);
    return results;
  }

  async getPatientVolumeForMonth(year: number, month: number): Promise<PatientVolume[]> {
    // Create proper UTC date range for the entire month
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    console.log(`Searching patient volume for ${year}/${month} between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    const results = await db.select().from(patientVolume)
      .where(
        and(
          gte(patientVolume.date, startDate),
          lte(patientVolume.date, endDate)
        )
      )
      .orderBy(patientVolume.date);
      
    console.log(`Found ${results.length} patient volume records for month ${month}/${year}`);
    return results;
  }

  async getPatientVolumeByDateRange(startDate: Date, endDate: Date): Promise<PatientVolume[]> {
    console.log(`Searching patient volume between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    const results = await db.select().from(patientVolume)
      .where(
        and(
          gte(patientVolume.date, startDate),
          lte(patientVolume.date, endDate)
        )
      )
      .orderBy(patientVolume.date);
      
    console.log(`Found ${results.length} patient volume records for date range`);
    return results;
  }

  async updatePatientVolume(id: string, updates: Partial<PatientVolume>): Promise<PatientVolume | undefined> {
    const [updated] = await db.update(patientVolume)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(patientVolume.id, id))
      .returning();
    return updated;
  }

  async deletePatientVolume(id: string): Promise<void> {
    await db.delete(patientVolume).where(eq(patientVolume.id, id));
  }
}

export const storage = new DatabaseStorage();
