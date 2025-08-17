import { 
  users, departments, insuranceProviders, transactions, monthlyReports, receipts,
  type User, type InsertUser, type Department, type InsertDepartment,
  type InsuranceProvider, type InsertInsuranceProvider, type Transaction, type InsertTransaction,
  type MonthlyReport, type InsertMonthlyReport, type Receipt, type InsertReceipt
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
  getTransactionById(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;

  // Monthly Reports
  getMonthlyReport(year: number, month: number): Promise<MonthlyReport | undefined>;
  createMonthlyReport(report: InsertMonthlyReport): Promise<MonthlyReport>;
  getMonthlyReports(limit?: number): Promise<MonthlyReport[]>;
  deleteMonthlyReport(reportId: string): Promise<void>;

  // Receipts
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceiptsByTransaction(transactionId: string): Promise<Receipt[]>;

  // Analytics
  getDashboardData(year: number, month: number): Promise<{
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    departmentBreakdown: Record<string, string>;
    insuranceBreakdown: Record<string, string>;
    recentTransactions: Transaction[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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

  async getDashboardData(year: number, month: number): Promise<{
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    departmentBreakdown: Record<string, string>;
    insuranceBreakdown: Record<string, string>;
    recentTransactions: Transaction[];
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get total income and expenses
    const [incomeResult] = await db.select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`
    }).from(transactions).where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

    const [expenseResult] = await db.select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`
    }).from(transactions).where(
      and(
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

    const totalIncome = incomeResult.total || "0";
    const totalExpenses = expenseResult.total || "0";
    const netIncome = (parseFloat(totalIncome) - parseFloat(totalExpenses)).toString();

    // Get department breakdown
    const departmentData = await db.select({
      departmentId: transactions.departmentId,
      total: sql<string>`SUM(${transactions.amount})`
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

    // Get insurance breakdown
    const insuranceData = await db.select({
      insuranceProviderId: transactions.insuranceProviderId,
      total: sql<string>`SUM(${transactions.amount})`
    }).from(transactions)
    .where(
      and(
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.insuranceProviderId);

    const insuranceBreakdown: Record<string, string> = {};
    insuranceData.forEach(item => {
      if (item.insuranceProviderId) {
        insuranceBreakdown[item.insuranceProviderId] = item.total;
      }
    });

    // Get recent transactions
    const recentTransactions = await this.getTransactions({
      startDate,
      endDate,
      limit: 10
    });

    return {
      totalIncome,
      totalExpenses,
      netIncome,
      departmentBreakdown,
      insuranceBreakdown,
      recentTransactions
    };
  }

  async getIncomeTrends(days: number): Promise<Array<{ date: string, income: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

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
}

export const storage = new DatabaseStorage();
