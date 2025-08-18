export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      insurance_providers: {
        Row: {
          id: string
          name: string
          contact_info: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_info?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_info?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          id: string
          year: number
          month: number
          total_income_usd: string
          total_income_ssp: string
          total_expense_usd: string
          total_expense_ssp: string
          net_income_usd: string
          net_income_ssp: string
          department_breakdown: Json
          insurance_breakdown: Json
          created_at: string
        }
        Insert: {
          id?: string
          year: number
          month: number
          total_income_usd: string
          total_income_ssp: string
          total_expense_usd: string
          total_expense_ssp: string
          net_income_usd: string
          net_income_ssp: string
          department_breakdown: Json
          insurance_breakdown: Json
          created_at?: string
        }
        Update: {
          id?: string
          year?: number
          month?: number
          total_income_usd?: string
          total_income_ssp?: string
          total_expense_usd?: string
          total_expense_ssp?: string
          net_income_usd?: string
          net_income_ssp?: string
          department_breakdown?: Json
          insurance_breakdown?: Json
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          username: string | null
          role: string
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          username?: string | null
          role?: string
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          username?: string | null
          role?: string
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      receipts: {
        Row: {
          id: string
          transaction_id: string
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          file_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          type: string
          amount_usd: string | null
          amount_ssp: string | null
          description: string
          department_id: string | null
          insurance_provider_id: string | null
          patient_name: string | null
          receipt_number: string | null
          payment_method: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: string
          amount_usd?: string | null
          amount_ssp?: string | null
          description: string
          department_id?: string | null
          insurance_provider_id?: string | null
          patient_name?: string | null
          receipt_number?: string | null
          payment_method: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: string
          amount_usd?: string | null
          amount_ssp?: string | null
          description?: string
          department_id?: string | null
          insurance_provider_id?: string | null
          patient_name?: string | null
          receipt_number?: string | null
          payment_method?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_insurance_provider_id_fkey"
            columns: ["insurance_provider_id"]
            isOneToOne: false
            referencedRelation: "insurance_providers"
            referencedColumns: ["id"]
          }
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}