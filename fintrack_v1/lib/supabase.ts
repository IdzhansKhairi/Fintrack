import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

// Database types for TypeScript
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number
          username: string
          email: string
          password_hash: string
          phone_number: string | null
          first_name: string | null
          last_name: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      sessions: {
        Row: {
          id: number
          user_id: number
          session_token: string
          expires_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>
      }
      transaction_list_table: {
        Row: {
          transaction_id: number
          transaction_date: string
          transaction_time: string
          transaction_description: string
          transaction_amount: number
          transaction_category: string
          transaction_sub_category: string
          transaction_card_choice: string | null
          transaction_income_source: string | null
          transaction_expense_usage: string | null
          transaction_hobby_category: string | null
          transaction_expense_usage_category: string | null
          transaction_spending_beneficiary: string | null
        }
        Insert: Omit<Database['public']['Tables']['transaction_list_table']['Row'], 'transaction_id'>
        Update: Partial<Database['public']['Tables']['transaction_list_table']['Insert']>
      }
      account_balance_table: {
        Row: {
          account_id: number
          account_category: string
          account_sub_category: string
          account_card_type: string | null
          current_balance: number
        }
        Insert: Omit<Database['public']['Tables']['account_balance_table']['Row'], 'account_id'>
        Update: Partial<Database['public']['Tables']['account_balance_table']['Insert']>
      }
      commitment_list_table: {
        Row: {
          commitment_id: number
          commitment_name: string
          commitment_description: string | null
          commitment_per_month: number
          commitment_per_year: number
          commitment_notes: string | null
          commitment_status: string
          commitment_start_month: number | null
          commitment_start_year: number | null
        }
        Insert: Omit<Database['public']['Tables']['commitment_list_table']['Row'], 'commitment_id'>
        Update: Partial<Database['public']['Tables']['commitment_list_table']['Insert']>
      }
      commitment_payment_status_table: {
        Row: {
          commitment_payment_id: number
          commitment_id: number
          payment_month: number
          payment_year: number
          payment_status: number
        }
        Insert: Omit<Database['public']['Tables']['commitment_payment_status_table']['Row'], 'commitment_payment_id'>
        Update: Partial<Database['public']['Tables']['commitment_payment_status_table']['Insert']>
      }
      wishlist_table: {
        Row: {
          wishlist_id: number
          wishlist_name: string
          wishlist_category: string
          wishlist_estimate_price: number | null
          wishlist_final_price: number | null
          wishlist_purchase_date: string | null
          wishlist_url_link: string | null
          wishlist_url_picture: string | null
          wishlist_status: string
        }
        Insert: Omit<Database['public']['Tables']['wishlist_table']['Row'], 'wishlist_id'>
        Update: Partial<Database['public']['Tables']['wishlist_table']['Insert']>
      }
      debts_table: {
        Row: {
          debt_id: number
          debt_type: string
          created_date: string
          due_date: string | null
          person_name: string
          amount: number
          notes: string | null
          status: string
          settled_date: string | null
        }
        Insert: Omit<Database['public']['Tables']['debts_table']['Row'], 'debt_id'>
        Update: Partial<Database['public']['Tables']['debts_table']['Insert']>
      }
      financing_plan_table: {
        Row: {
          financing_id: number
          financing_name: string
          financing_provider: string | null
          financing_category: string
          total_amount: number
          total_months: number
          monthly_amount_default: number
          start_date: string
          end_date: string | null
          notes: string | null
          status: string
          linked_commitment_id: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['financing_plan_table']['Row'], 'financing_id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['financing_plan_table']['Insert']>
      }
      financing_installment_table: {
        Row: {
          installment_id: number
          financing_id: number
          installment_number: number
          due_date: string
          amount_due: number
          amount_paid: number
          payment_status: string
          paid_date: string | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['financing_installment_table']['Row'], 'installment_id'>
        Update: Partial<Database['public']['Tables']['financing_installment_table']['Insert']>
      }
    }
  }
}
