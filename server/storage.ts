import { 
  users, departments, insuranceProviders, transactions, monthlyReports, receipts, patientVolume,
  type User, type InsertUser, type Department, type InsertDepartment,
  type InsuranceProvider, type InsertInsuranceProvider, type Transaction, type InsertTransaction,
  type MonthlyReport, type InsertMonthlyReport, type Receipt, type InsertReceipt,
  type PatientVolume, type InsertPatientVolume
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, isNotNull } from "drizzle-orm";

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
  getDashboardData(year: number, month: number): Promise<{
    totalIncome: string;
    totalIncomeSSP: string;
    totalIncomeUSD: string;
    totalExpenses: string;
    netIncome: string;
    departmentBreakdown: Record<string, string>;
    insuranceBreakdown: Record<string, string>;
    recentTransactions: Transaction[];
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
    const [user] = await db.update(users).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(users.id, id)).returning();
    return user;
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

  async getDashboardData(year: number, month: number, range?: string, customStartDate?: string, customEndDate?: string): Promise<{
    totalIncome: string;
    totalIncomeSSP: string;
    totalIncomeUSD: string;
    totalExpenses: string;
    netIncome: string;
    departmentBreakdown: Record<string, string>;
    insuranceBreakdown: Record<string, string>;
    recentTransactions: Transaction[];
  }> {
    let startDate: Date;
    let endDate: Date;

    // Calculate date range based on the range parameter
    const now = new Date();
    
    switch(range) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 3 months ago
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // end of current month
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1); // January 1st
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // December 31st
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999); // End of day
        } else {
          // Fallback to current month if no custom dates provided
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }
        break;
      default:
        // Default to the original single month logic
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
    }

    // Get total income separated by currency to prevent mixing
    const [incomeResult] = await db.select({
      totalSSP: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalUSD: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`
    }).from(transactions).where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

    const [expenseResult] = await db.select({
      totalSSP: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalUSD: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`
    }).from(transactions).where(
      and(
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

    const totalIncomeSSP = incomeResult.totalSSP || "0";
    const totalIncomeUSD = incomeResult.totalUSD || "0";
    const totalExpensesSSP = expenseResult.totalSSP || "0";
    const totalExpensesUSD = expenseResult.totalUSD || "0";
    const netIncomeSSP = (parseFloat(totalIncomeSSP) - parseFloat(totalExpensesSSP)).toString();
    const netIncomeUSD = (parseFloat(totalIncomeUSD) - parseFloat(totalExpensesUSD)).toString();

    // Get department breakdown (SSP only to prevent currency mixing)
    const departmentData = await db.select({
      departmentId: transactions.departmentId,
      total: sql<string>`SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END)`
    }).from(transactions)
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.departmentId);

    const departmentBreakdown: Record<string, string> = {};
    departmentData.forEach(item => {
      if (item.departmentId) {
        departmentBreakdown[item.departmentId] = item.total;
      }
    });

    // Get insurance breakdown (USD only for insurance payments)
    const insuranceData = await db.select({
      providerName: insuranceProviders.name,
      total: sql<string>`SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END)`
    }).from(transactions)
    .innerJoin(insuranceProviders, eq(transactions.insuranceProviderId, insuranceProviders.id))
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNotNull(transactions.insuranceProviderId)
      )
    )
    .groupBy(insuranceProviders.name);

    const insuranceBreakdown: Record<string, string> = {};
    insuranceData.forEach(item => {
      if (item.providerName) {
        insuranceBreakdown[item.providerName] = item.total;
      }
    });

    // Get recent transactions
    const recentTransactions = await this.getTransactions({
      startDate,
      endDate,
      limit: 10
    });

    // Calculate previous period data for comparison
    let prevStartDate: Date;
    let prevEndDate: Date;
    
    switch(range) {
      case 'current-month':
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last-month':
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
        break;
      default:
        // For other ranges, calculate previous period of same length
        const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(prevEndDate.getTime() - (rangeDays * 24 * 60 * 60 * 1000));
        break;
    }

    // Get previous period data for comparison
    const [prevIncomeResult] = await db.select({
      totalSSP: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalUSD: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`
    }).from(transactions).where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, prevStartDate),
        lte(transactions.date, prevEndDate)
      )
    );

    const [prevExpenseResult] = await db.select({
      totalSSP: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'SSP' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalUSD: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.currency} = 'USD' THEN ${transactions.amount} ELSE 0 END), 0)`
    }).from(transactions).where(
      and(
        eq(transactions.type, "expense"),
        gte(transactions.date, prevStartDate),
        lte(transactions.date, prevEndDate)
      )
    );

    const prevIncomeSSP = parseFloat(prevIncomeResult?.totalSSP || '0');
    const prevExpenseSSP = parseFloat(prevExpenseResult?.totalSSP || '0');
    const prevNetIncomeSSP = prevIncomeSSP - prevExpenseSSP;
    const prevIncomeUSD = parseFloat(prevIncomeResult?.totalUSD || '0');

    // Calculate percentage changes
    const incomeChangeSSP = prevIncomeSSP > 0 ? ((parseFloat(totalIncomeSSP) - prevIncomeSSP) / prevIncomeSSP) * 100 : 0;
    const expenseChangeSSP = prevExpenseSSP > 0 ? ((parseFloat(totalExpensesSSP) - prevExpenseSSP) / prevExpenseSSP) * 100 : 0;
    const netIncomeChangeSSP = prevNetIncomeSSP !== 0 ? ((parseFloat(netIncomeSSP) - prevNetIncomeSSP) / Math.abs(prevNetIncomeSSP)) * 100 : 0;
    const incomeChangeUSD = prevIncomeUSD > 0 ? ((parseFloat(totalIncomeUSD) - prevIncomeUSD) / prevIncomeUSD) * 100 : 0;

    return {
      totalIncome: totalIncomeSSP, // Legacy field - only SSP to avoid currency mixing
      totalIncomeSSP,
      totalIncomeUSD,
      totalExpenses: totalExpensesSSP, // Legacy field - only SSP to avoid currency mixing 
      totalExpensesSSP,
      totalExpensesUSD,
      netIncome: netIncomeSSP, // Legacy field - only SSP to avoid currency mixing
      netIncomeSSP,
      netIncomeUSD,
      departmentBreakdown,
      insuranceBreakdown,
      recentTransactions,
      // Previous period data for comparisons
      previousPeriod: {
        totalIncomeSSP: prevIncomeSSP,
        totalExpensesSSP: prevExpenseSSP,
        netIncomeSSP: prevNetIncomeSSP,
        totalIncomeUSD: prevIncomeUSD
      },
      // Percentage changes
      changes: {
        incomeChangeSSP: Math.round(incomeChangeSSP * 10) / 10, // Round to 1 decimal
        expenseChangeSSP: Math.round(expenseChangeSSP * 10) / 10,
        netIncomeChangeSSP: Math.round(netIncomeChangeSSP * 10) / 10,
        incomeChangeUSD: Math.round(incomeChangeUSD * 10) / 10
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
        description: row.description
      };
    });
  }

  async getIncomeTrendsForDateRange(startDate: Date, endDate: Date): Promise<Array<{ date: string, income: number }>> {
    const incomeData = await db.select({
      date: sql<string>`DATE(${transactions.date})`,
      income: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
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
    const result: Array<{ date: string, income: number }> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const existingData = incomeData.find(d => d.date === dateStr);
      
      result.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income: existingData ? Number(existingData.income) : 0
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
