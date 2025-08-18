import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug logs removed for production

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables: URL=${!!supabaseUrl}, KEY=${!!supabaseAnonKey}`)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types will be added here after schema setup
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          role: 'admin' | 'staff'
          location: 'usa' | 'south_sudan'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          role?: 'admin' | 'staff'
          location?: 'usa' | 'south_sudan'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          role?: 'admin' | 'staff'
          location?: 'usa' | 'south_sudan'
          created_at?: string
          updated_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      insurance_providers: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          type: 'income' | 'expense'
          amount: number
          currency: 'USD' | 'SSP'
          description: string
          department_id: string
          insurance_provider_id: string | null
          date: string
          receipt_url: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'income' | 'expense'
          amount: number
          currency: 'USD' | 'SSP'
          description: string
          department_id: string
          insurance_provider_id?: string | null
          date: string
          receipt_url?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'income' | 'expense'
          amount?: number
          currency?: 'USD' | 'SSP'
          description?: string
          department_id?: string
          insurance_provider_id?: string | null
          date?: string
          receipt_url?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      monthly_reports: {
        Row: {
          id: string
          year: number
          month: number
          total_income_usd: number
          total_income_ssp: number
          total_expenses_usd: number
          total_expenses_ssp: number
          net_income_usd: number
          net_income_ssp: number
          department_breakdown: any
          insurance_breakdown: any
          pdf_path: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          year: number
          month: number
          total_income_usd: number
          total_income_ssp: number
          total_expenses_usd: number
          total_expenses_ssp: number
          net_income_usd: number
          net_income_ssp: number
          department_breakdown: any
          insurance_breakdown: any
          pdf_path?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          year?: number
          month?: number
          total_income_usd?: number
          total_income_ssp?: number
          total_expenses_usd?: number
          total_expenses_ssp?: number
          net_income_usd?: number
          net_income_ssp?: number
          department_breakdown?: any
          insurance_breakdown?: any
          pdf_path?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}