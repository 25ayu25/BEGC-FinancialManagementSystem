import { supabase } from './supabase'
import type { Database } from '../types/supabase'

type Tables = Database['public']['Tables']
type Transaction = Tables['transactions']['Row']
type InsertTransaction = Tables['transactions']['Insert']
type Department = Tables['departments']['Row']
type InsertDepartment = Tables['departments']['Insert']
type InsuranceProvider = Tables['insurance_providers']['Row']
type MonthlyReport = Tables['monthly_reports']['Row']

// Auth functions
export const supabaseAuth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    return { ...user, profile }
  }
}

// Transaction functions
export const supabaseTransactions = {
  async getAll() {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        departments (name),
        insurance_providers (name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return data
  },

  async create(transaction: InsertTransaction) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  async update(id: string, updates: Partial<Transaction>) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
    
    if (error) throw new Error(error.message)
  }
}

// Department functions
export const supabaseDepartments = {
  async getAll() {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    
    if (error) throw new Error(error.message)
    return data
  },

  async create(department: InsertDepartment) {
    const { data, error } = await supabase
      .from('departments')
      .insert(department)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return data
  }
}

// Insurance provider functions
export const supabaseInsurance = {
  async getAll() {
    const { data, error } = await supabase
      .from('insurance_providers')
      .select('*')
      .order('name')
    
    if (error) throw new Error(error.message)
    return data
  }
}

// Dashboard functions
export const supabaseDashboard = {
  async getMonthlyData(year: number, month: number) {
    // Get transactions for the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`
    
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        departments (name),
        insurance_providers (name)
      `)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
    
    if (error) throw new Error(error.message)

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount_ssp || '0'), 0)
    
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount_ssp || '0'), 0)

    // Calculate insurance revenue (USD)
    const insuranceRevenue = transactions
      .filter(t => t.type === 'income' && t.insurance_provider_id)
      .reduce((sum, t) => sum + parseFloat(t.amount_usd || '0'), 0)

    // Count unique insurance providers
    const insuranceProviders = new Set(
      transactions
        .filter(t => t.insurance_provider_id)
        .map(t => t.insurance_provider_id)
    ).size

    return {
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netIncome: (totalIncome - totalExpense).toFixed(2),
      insuranceRevenue: insuranceRevenue.toFixed(2),
      insuranceProviders: insuranceProviders,
      transactionCount: transactions.length,
      transactions
    }
  },

  async getIncomeTrends(year: number, month: number) {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('created_at, amount_ssp, type')
      .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('created_at', `${year}-${(month + 1).toString().padStart(2, '0')}-01`)
      .eq('type', 'income')
    
    if (error) throw new Error(error.message)

    // Group by day
    const dailyIncome: Record<string, number> = {}
    transactions.forEach(t => {
      const day = new Date(t.created_at).getDate()
      const key = `Aug ${day}`
      dailyIncome[key] = (dailyIncome[key] || 0) + parseFloat(t.amount_ssp || '0')
    })

    return Object.entries(dailyIncome).map(([date, income]) => ({
      date,
      income,
      income_usd: income / 1300 // Approximate conversion
    }))
  }
}

// Receipt functions
export const supabaseReceipts = {
  async uploadFile(file: File) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file)
    
    if (error) throw new Error(error.message)
    return data
  },

  async getSignedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600) // 1 hour expiry
    
    if (error) throw new Error(error.message)
    return data.signedUrl
  },

  async deleteFile(path: string) {
    const { error } = await supabase.storage
      .from('receipts')
      .remove([path])
    
    if (error) throw new Error(error.message)
  }
}