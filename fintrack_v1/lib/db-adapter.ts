import { openDB } from './db'
import { supabase } from './supabase'
import type { Database } from './supabase'

// Helper to determine which database to use
export function useSupabase(module: 'dashboard' | 'transactions' | 'accounts' | 'commitments' | 'wishlist' | 'debts' | 'financing' | 'auth'): boolean {
  const envMap = {
    dashboard: process.env.USE_SUPABASE_DASHBOARD === 'true',
    transactions: process.env.USE_SUPABASE_TRANSACTIONS === 'true',
    accounts: process.env.USE_SUPABASE_ACCOUNTS === 'true',
    commitments: process.env.USE_SUPABASE_COMMITMENTS === 'true',
    wishlist: process.env.USE_SUPABASE_WISHLIST === 'true',
    debts: process.env.USE_SUPABASE_DEBTS === 'true',
    financing: process.env.USE_SUPABASE_FINANCING === 'true',
    auth: process.env.USE_SUPABASE_AUTH === 'true',
  }
  return envMap[module] || false
}

// Dashboard Query Adapter (Read-only, perfect for first migration!)
export class DashboardAdapter {
  /**
   * Get all transactions for dashboard analytics
   */
  static async getTransactions() {
    if (useSupabase('dashboard')) {
      console.log('[Dashboard] Using Supabase for transactions query')
      const { data, error } = await supabase
        .from('transaction_list_table')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('transaction_time', { ascending: false })

      if (error) {
        console.error('[Dashboard] Supabase error:', error)
        throw error
      }
      console.log(`[Dashboard] Fetched ${data?.length || 0} transactions from Supabase`)
      return data || []
    } else {
      console.log('[Dashboard] Using SQLite for transactions query')
      const db = await openDB()
      const transactions = await db.all(
        'SELECT * FROM transaction_list_table ORDER BY transaction_date DESC, transaction_time DESC'
      )
      await db.close()
      console.log(`[Dashboard] Fetched ${transactions.length} transactions from SQLite`)
      return transactions
    }
  }

  /**
   * Get all account balances for dashboard
   */
  static async getAccounts() {
    if (useSupabase('dashboard')) {
      console.log('[Dashboard] Using Supabase for accounts query')
      const { data, error } = await supabase
        .from('account_balance_table')
        .select('*')
        .order('account_category')
        .order('account_sub_category')
        .order('account_card_type')

      if (error) {
        console.error('[Dashboard] Supabase error:', error)
        throw error
      }
      console.log(`[Dashboard] Fetched ${data?.length || 0} accounts from Supabase`)
      return data || []
    } else {
      console.log('[Dashboard] Using SQLite for accounts query')
      const db = await openDB()
      const accounts = await db.all(
        'SELECT * FROM account_balance_table ORDER BY account_category, account_sub_category, account_card_type'
      )
      await db.close()
      console.log(`[Dashboard] Fetched ${accounts.length} accounts from SQLite`)
      return accounts
    }
  }

  /**
   * Get all commitments for dashboard
   */
  static async getCommitments() {
    if (useSupabase('dashboard')) {
      console.log('[Dashboard] Using Supabase for commitments query')
      const { data, error } = await supabase
        .from('commitment_list_table')
        .select('*')
        .order('commitment_name')

      if (error) {
        console.error('[Dashboard] Supabase error:', error)
        throw error
      }
      console.log(`[Dashboard] Fetched ${data?.length || 0} commitments from Supabase`)
      return data || []
    } else {
      console.log('[Dashboard] Using SQLite for commitments query')
      const db = await openDB()
      const commitments = await db.all(
        'SELECT * FROM commitment_list_table ORDER BY commitment_name'
      )
      await db.close()
      console.log(`[Dashboard] Fetched ${commitments.length} commitments from SQLite`)
      return commitments
    }
  }

  /**
   * Get all wishlist items for dashboard
   */
  static async getWishlist() {
    if (useSupabase('dashboard')) {
      console.log('[Dashboard] Using Supabase for wishlist query')
      const { data, error } = await supabase
        .from('wishlist_table')
        .select('*')
        .order('wishlist_name')

      if (error) {
        console.error('[Dashboard] Supabase error:', error)
        throw error
      }
      console.log(`[Dashboard] Fetched ${data?.length || 0} wishlist items from Supabase`)
      return data || []
    } else {
      console.log('[Dashboard] Using SQLite for wishlist query')
      const db = await openDB()
      const wishlist = await db.all(
        'SELECT * FROM wishlist_table ORDER BY wishlist_name'
      )
      await db.close()
      console.log(`[Dashboard] Fetched ${wishlist.length} wishlist items from SQLite`)
      return wishlist
    }
  }

  /**
   * Get all debts for dashboard
   */
  static async getDebts() {
    if (useSupabase('dashboard')) {
      console.log('[Dashboard] Using Supabase for debts query')
      const { data, error } = await supabase
        .from('debts_table')
        .select('*')
        .order('created_date', { ascending: false })

      if (error) {
        console.error('[Dashboard] Supabase error:', error)
        throw error
      }
      console.log(`[Dashboard] Fetched ${data?.length || 0} debts from Supabase`)
      return data || []
    } else {
      console.log('[Dashboard] Using SQLite for debts query')
      const db = await openDB()
      const debts = await db.all(
        'SELECT * FROM debts_table ORDER BY created_date DESC'
      )
      await db.close()
      console.log(`[Dashboard] Fetched ${debts.length} debts from SQLite`)
      return debts
    }
  }
}

// Transactions Query Adapter (for future migration)
export class TransactionsAdapter {
  static async getAll() {
    if (useSupabase('transactions')) {
      const { data, error } = await supabase
        .from('transaction_list_table')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('transaction_time', { ascending: false })

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      const transactions = await db.all(
        'SELECT * FROM transaction_list_table ORDER BY transaction_date DESC, transaction_time DESC'
      )
      await db.close()
      return transactions
    }
  }

  static async create(transaction: Database['public']['Tables']['transaction_list_table']['Insert']) {
    if (useSupabase('transactions')) {
      const { data, error } = await supabase
        .from('transaction_list_table')
        .insert(transaction)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const result = await db.run(
        `INSERT INTO transaction_list_table (
          transaction_date, transaction_time, transaction_description,
          transaction_amount, transaction_category, transaction_sub_category,
          transaction_card_choice, transaction_income_source, transaction_expense_usage,
          transaction_hobby_category, transaction_expense_usage_category, transaction_spending_beneficiary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.transaction_date,
          transaction.transaction_time,
          transaction.transaction_description,
          transaction.transaction_amount,
          transaction.transaction_category,
          transaction.transaction_sub_category,
          transaction.transaction_card_choice,
          transaction.transaction_income_source,
          transaction.transaction_expense_usage,
          transaction.transaction_hobby_category,
          transaction.transaction_expense_usage_category,
          transaction.transaction_spending_beneficiary,
        ]
      )
      await db.close()
      return { transaction_id: result.lastID, ...transaction }
    }
  }

  static async update(id: number, transaction: Database['public']['Tables']['transaction_list_table']['Update']) {
    if (useSupabase('transactions')) {
      const { data, error } = await supabase
        .from('transaction_list_table')
        .update(transaction)
        .eq('transaction_id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      await db.run(
        `UPDATE transaction_list_table SET
          transaction_date = ?, transaction_time = ?, transaction_description = ?,
          transaction_amount = ?, transaction_category = ?, transaction_sub_category = ?,
          transaction_card_choice = ?, transaction_income_source = ?, transaction_expense_usage = ?,
          transaction_hobby_category = ?, transaction_expense_usage_category = ?, transaction_spending_beneficiary = ?
        WHERE transaction_id = ?`,
        [
          transaction.transaction_date,
          transaction.transaction_time,
          transaction.transaction_description,
          transaction.transaction_amount,
          transaction.transaction_category,
          transaction.transaction_sub_category,
          transaction.transaction_card_choice,
          transaction.transaction_income_source,
          transaction.transaction_expense_usage,
          transaction.transaction_hobby_category,
          transaction.transaction_expense_usage_category,
          transaction.transaction_spending_beneficiary,
          id,
        ]
      )
      await db.close()
      return { transaction_id: id, ...transaction }
    }
  }

  static async delete(id: number) {
    if (useSupabase('transactions')) {
      const { error } = await supabase
        .from('transaction_list_table')
        .delete()
        .eq('transaction_id', id)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM transaction_list_table WHERE transaction_id = ?', [id])
      await db.close()
    }
  }
}

// Accounts Query Adapter (for future migration)
export class AccountsAdapter {
  static async getAll() {
    if (useSupabase('accounts')) {
      const { data, error } = await supabase
        .from('account_balance_table')
        .select('*')
        .order('account_category')
        .order('account_sub_category')
        .order('account_card_type')

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      const accounts = await db.all(
        'SELECT * FROM account_balance_table ORDER BY account_category, account_sub_category, account_card_type'
      )
      await db.close()
      return accounts
    }
  }

  static async updateBalance(accountId: number, balance: number) {
    if (useSupabase('accounts')) {
      const { data, error} = await supabase
        .from('account_balance_table')
        .update({ current_balance: balance })
        .eq('account_id', accountId)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      await db.run(
        'UPDATE account_balance_table SET current_balance = ? WHERE account_id = ?',
        [balance, accountId]
      )
      await db.close()
    }
  }
}

// Commitments Query Adapter
export class CommitmentsAdapter {
  static async getAll(status?: string | null) {
    if (useSupabase('commitments')) {
      let query = supabase
        .from('commitment_list_table')
        .select('*')
        .order('commitment_name')

      if (status) {
        query = query.eq('commitment_status', status)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      let commitments
      if (status) {
        commitments = await db.all(
          'SELECT * FROM commitment_list_table WHERE commitment_status = ? ORDER BY commitment_name',
          [status]
        )
      } else {
        commitments = await db.all('SELECT * FROM commitment_list_table ORDER BY commitment_name')
      }
      await db.close()
      return commitments
    }
  }

  static async create(commitment: Database['public']['Tables']['commitment_list_table']['Insert']) {
    if (useSupabase('commitments')) {
      const { data, error } = await supabase
        .from('commitment_list_table')
        .insert(commitment)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const result = await db.run(
        `INSERT INTO commitment_list_table (
          commitment_name, commitment_description, commitment_per_month,
          commitment_per_year, commitment_notes, commitment_status,
          commitment_start_month, commitment_start_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commitment.commitment_name,
          commitment.commitment_description || null,
          commitment.commitment_per_month,
          commitment.commitment_per_year,
          commitment.commitment_notes || null,
          commitment.commitment_status || 'Active',
          commitment.commitment_start_month || null,
          commitment.commitment_start_year || null
        ]
      )
      await db.close()
      return { commitment_id: result.lastID, ...commitment }
    }
  }

  static async update(id: number, commitment: Database['public']['Tables']['commitment_list_table']['Update']) {
    if (useSupabase('commitments')) {
      const { data, error } = await supabase
        .from('commitment_list_table')
        .update(commitment)
        .eq('commitment_id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      await db.run(
        `UPDATE commitment_list_table SET
          commitment_name = ?, commitment_description = ?, commitment_per_month = ?,
          commitment_per_year = ?, commitment_notes = ?, commitment_status = ?,
          commitment_start_month = ?, commitment_start_year = ?
        WHERE commitment_id = ?`,
        [
          commitment.commitment_name,
          commitment.commitment_description || null,
          commitment.commitment_per_month,
          commitment.commitment_per_year,
          commitment.commitment_notes || null,
          commitment.commitment_status,
          commitment.commitment_start_month || null,
          commitment.commitment_start_year || null,
          id
        ]
      )
      await db.close()
    }
  }

  static async delete(id: number) {
    if (useSupabase('commitments')) {
      const { error } = await supabase
        .from('commitment_list_table')
        .delete()
        .eq('commitment_id', id)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM commitment_list_table WHERE commitment_id = ?', [id])
      await db.close()
    }
  }
}

// Commitment Payments Adapter
export class CommitmentPaymentsAdapter {
  static async getAll(filters?: { month?: number; year?: number; commitment_id?: number }) {
    if (useSupabase('commitments')) {
      let query = supabase
        .from('commitment_payment_status_table')
        .select(`
          *,
          commitment_list_table(commitment_name)
        `)

      if (filters?.month) query = query.eq('payment_month', filters.month)
      if (filters?.year) query = query.eq('payment_year', filters.year)
      if (filters?.commitment_id) query = query.eq('commitment_id', filters.commitment_id)

      const { data, error } = await query

      if (error) throw error
      return (data || []).map((item: any) => ({
        ...item,
        commitment_name: item.commitment_list_table?.commitment_name,
        commitment_list_table: undefined
      }))
    } else {
      const db = await openDB()
      let query = `
        SELECT cps.*, cl.commitment_name
        FROM commitment_payment_status_table cps
        JOIN commitment_list_table cl ON cps.commitment_id = cl.commitment_id
        WHERE 1=1
      `
      const params: any[] = []

      if (filters?.month) {
        query += ' AND cps.payment_month = ?'
        params.push(filters.month)
      }
      if (filters?.year) {
        query += ' AND cps.payment_year = ?'
        params.push(filters.year)
      }
      if (filters?.commitment_id) {
        query += ' AND cps.commitment_id = ?'
        params.push(filters.commitment_id)
      }

      const payments = await db.all(query, params)
      await db.close()
      return payments
    }
  }

  static async upsert(payment: Database['public']['Tables']['commitment_payment_status_table']['Insert']) {
    if (useSupabase('commitments')) {
      const { data, error } = await supabase
        .from('commitment_payment_status_table')
        .upsert(payment, {
          onConflict: 'commitment_id,payment_month,payment_year'
        })
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      await db.run(
        `INSERT INTO commitment_payment_status_table (commitment_id, payment_month, payment_year, payment_status)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(commitment_id, payment_month, payment_year)
         DO UPDATE SET payment_status = ?`,
        [
          payment.commitment_id,
          payment.payment_month,
          payment.payment_year,
          payment.payment_status,
          payment.payment_status
        ]
      )
      await db.close()
    }
  }

  static async delete(id: number) {
    if (useSupabase('commitments')) {
      const { error } = await supabase
        .from('commitment_payment_status_table')
        .delete()
        .eq('commitment_payment_id', id)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM commitment_payment_status_table WHERE commitment_payment_id = ?', [id])
      await db.close()
    }
  }
}

// Wishlist Adapter
export class WishlistAdapter {
  static async getAll(status?: string | null) {
    if (useSupabase('wishlist')) {
      let query = supabase
        .from('wishlist_table')
        .select('*')
        .order('wishlist_id', { ascending: false })

      if (status) {
        query = query.eq('wishlist_status', status)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      let wishlist
      if (status) {
        wishlist = await db.all(
          'SELECT * FROM wishlist_table WHERE wishlist_status = ? ORDER BY wishlist_id DESC',
          [status]
        )
      } else {
        wishlist = await db.all('SELECT * FROM wishlist_table ORDER BY wishlist_id DESC')
      }
      await db.close()
      return wishlist
    }
  }

  static async create(item: Database['public']['Tables']['wishlist_table']['Insert']) {
    if (useSupabase('wishlist')) {
      const { data, error } = await supabase
        .from('wishlist_table')
        .insert(item)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const result = await db.run(
        `INSERT INTO wishlist_table (
          wishlist_name, wishlist_category, wishlist_estimate_price,
          wishlist_final_price, wishlist_purchase_date, wishlist_url_link,
          wishlist_url_picture, wishlist_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.wishlist_name,
          item.wishlist_category,
          item.wishlist_estimate_price || null,
          item.wishlist_final_price || null,
          item.wishlist_purchase_date || null,
          item.wishlist_url_link || null,
          item.wishlist_url_picture || null,
          item.wishlist_status || 'not_purchased'
        ]
      )
      await db.close()
      return { wishlist_id: result.lastID, ...item }
    }
  }

  static async update(id: number, item: Database['public']['Tables']['wishlist_table']['Update']) {
    if (useSupabase('wishlist')) {
      const { data, error } = await supabase
        .from('wishlist_table')
        .update(item)
        .eq('wishlist_id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      await db.run(
        `UPDATE wishlist_table SET
          wishlist_name = ?, wishlist_category = ?, wishlist_estimate_price = ?,
          wishlist_final_price = ?, wishlist_purchase_date = ?, wishlist_url_link = ?,
          wishlist_url_picture = ?, wishlist_status = ?
        WHERE wishlist_id = ?`,
        [
          item.wishlist_name,
          item.wishlist_category,
          item.wishlist_estimate_price || null,
          item.wishlist_final_price || null,
          item.wishlist_purchase_date || null,
          item.wishlist_url_link || null,
          item.wishlist_url_picture || null,
          item.wishlist_status,
          id
        ]
      )
      await db.close()
    }
  }

  static async delete(id: number) {
    if (useSupabase('wishlist')) {
      const { error } = await supabase
        .from('wishlist_table')
        .delete()
        .eq('wishlist_id', id)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM wishlist_table WHERE wishlist_id = ?', [id])
      await db.close()
    }
  }
}

// Debts Adapter
export class DebtsAdapter {
  static async getAll(filters?: { status?: string; type?: string }) {
    if (useSupabase('debts')) {
      let query = supabase
        .from('debts_table')
        .select('*')
        .order('created_date', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.type) query = query.eq('debt_type', filters.type)

      const { data, error } = await query

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      let query = 'SELECT * FROM debts_table WHERE 1=1'
      const params: any[] = []

      if (filters?.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }
      if (filters?.type) {
        query += ' AND debt_type = ?'
        params.push(filters.type)
      }

      query += ' ORDER BY created_date DESC'

      const debts = await db.all(query, params)
      await db.close()
      return debts
    }
  }

  static async create(debt: Database['public']['Tables']['debts_table']['Insert']) {
    if (useSupabase('debts')) {
      const { data, error } = await supabase
        .from('debts_table')
        .insert(debt)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const result = await db.run(
        `INSERT INTO debts_table (
          debt_type, created_date, due_date, person_name,
          amount, notes, status, settled_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          debt.debt_type,
          debt.created_date,
          debt.due_date || null,
          debt.person_name,
          debt.amount,
          debt.notes || null,
          debt.status || 'pending',
          debt.settled_date || null
        ]
      )
      await db.close()
      return { debt_id: result.lastID, ...debt }
    }
  }

  static async update(id: number, debt: Database['public']['Tables']['debts_table']['Update']) {
    if (useSupabase('debts')) {
      const { data, error } = await supabase
        .from('debts_table')
        .update(debt)
        .eq('debt_id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      await db.run(
        `UPDATE debts_table SET
          debt_type = ?, created_date = ?, due_date = ?, person_name = ?,
          amount = ?, notes = ?, status = ?, settled_date = ?
        WHERE debt_id = ?`,
        [
          debt.debt_type,
          debt.created_date,
          debt.due_date || null,
          debt.person_name,
          debt.amount,
          debt.notes || null,
          debt.status,
          debt.settled_date || null,
          id
        ]
      )
      await db.close()
    }
  }

  static async delete(id: number) {
    if (useSupabase('debts')) {
      const { error } = await supabase
        .from('debts_table')
        .delete()
        .eq('debt_id', id)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM debts_table WHERE debt_id = ?', [id])
      await db.close()
    }
  }
}

// Financing Plan Adapter
export class FinancingAdapter {
  static async getAll(filters?: { status?: string; category?: string }) {
    if (useSupabase('financing')) {
      let query = supabase
        .from('financing_plan_table')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.category) query = query.eq('financing_category', filters.category)

      const { data, error } = await query
      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      let query = 'SELECT * FROM financing_plan_table WHERE 1=1'
      const params: any[] = []

      if (filters?.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }
      if (filters?.category) {
        query += ' AND financing_category = ?'
        params.push(filters.category)
      }

      query += ' ORDER BY created_at DESC'
      const plans = await db.all(query, params)
      await db.close()
      return plans
    }
  }

  static async getById(id: number) {
    if (useSupabase('financing')) {
      const { data, error } = await supabase
        .from('financing_plan_table')
        .select('*')
        .eq('financing_id', id)
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const plan = await db.get('SELECT * FROM financing_plan_table WHERE financing_id = ?', [id])
      await db.close()
      return plan
    }
  }

  static async create(plan: Database['public']['Tables']['financing_plan_table']['Insert']) {
    if (useSupabase('financing')) {
      const { data, error } = await supabase
        .from('financing_plan_table')
        .insert(plan)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const result = await db.run(
        `INSERT INTO financing_plan_table (
          financing_name, financing_provider, financing_category,
          total_amount, total_months, monthly_amount_default,
          start_date, end_date, notes, status, linked_commitment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.financing_name,
          plan.financing_provider || null,
          plan.financing_category,
          plan.total_amount,
          plan.total_months,
          plan.monthly_amount_default,
          plan.start_date,
          plan.end_date || null,
          plan.notes || null,
          plan.status || 'active',
          plan.linked_commitment_id || null
        ]
      )
      await db.close()
      return { financing_id: result.lastID, ...plan }
    }
  }

  static async update(id: number, plan: Database['public']['Tables']['financing_plan_table']['Update']) {
    if (useSupabase('financing')) {
      const { data, error } = await supabase
        .from('financing_plan_table')
        .update(plan)
        .eq('financing_id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const fields = Object.keys(plan).filter(k => plan[k as keyof typeof plan] !== undefined)
      const values = fields.map(k => plan[k as keyof typeof plan] ?? null)
      const setClause = fields.map(f => `${f} = ?`).join(', ')

      await db.run(
        `UPDATE financing_plan_table SET ${setClause} WHERE financing_id = ?`,
        [...values, id]
      )
      await db.close()
      return { financing_id: id, ...plan }
    }
  }

  static async delete(id: number) {
    if (useSupabase('financing')) {
      const { error } = await supabase
        .from('financing_plan_table')
        .delete()
        .eq('financing_id', id)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM financing_plan_table WHERE financing_id = ?', [id])
      await db.close()
    }
  }
}

// Financing Installments Adapter
export class FinancingInstallmentsAdapter {
  static async getByFinancingId(financingId: number) {
    if (useSupabase('financing')) {
      const { data, error } = await supabase
        .from('financing_installment_table')
        .select('*')
        .eq('financing_id', financingId)
        .order('installment_number', { ascending: true })

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      const installments = await db.all(
        'SELECT * FROM financing_installment_table WHERE financing_id = ? ORDER BY installment_number ASC',
        [financingId]
      )
      await db.close()
      return installments
    }
  }

  static async getUpcoming(month: number, year: number) {
    if (useSupabase('financing')) {
      // Build date range for the month
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const endMonth = month === 11 ? 0 : month + 1
      const endYear = month === 11 ? year + 1 : year
      const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`

      const { data, error } = await supabase
        .from('financing_installment_table')
        .select(`
          *,
          financing_plan_table(financing_name, financing_provider, financing_category, status)
        `)
        .gte('due_date', startDate)
        .lt('due_date', endDate)
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data || [])
        .map((item: any) => ({
          ...item,
          financing_name: item.financing_plan_table?.financing_name,
          financing_provider: item.financing_plan_table?.financing_provider,
          financing_category: item.financing_plan_table?.financing_category,
          plan_status: item.financing_plan_table?.status,
          financing_plan_table: undefined
        }))
        .filter((item: any) => item.plan_status === 'active')
    } else {
      const db = await openDB()
      const monthStr = String(month + 1).padStart(2, '0')
      const endMonth = month === 11 ? 0 : month + 1
      const endYear = month === 11 ? year + 1 : year
      const endMonthStr = String(endMonth + 1).padStart(2, '0')

      const installments = await db.all(
        `SELECT fi.*, fp.financing_name, fp.financing_provider, fp.financing_category, fp.status as plan_status
         FROM financing_installment_table fi
         JOIN financing_plan_table fp ON fi.financing_id = fp.financing_id
         WHERE fi.due_date >= ? AND fi.due_date < ? AND fp.status = 'active'
         ORDER BY fi.due_date ASC`,
        [`${year}-${monthStr}-01`, `${endYear}-${endMonthStr}-01`]
      )
      await db.close()
      return installments
    }
  }

  static async bulkCreate(installments: Database['public']['Tables']['financing_installment_table']['Insert'][]) {
    if (useSupabase('financing')) {
      const { data, error } = await supabase
        .from('financing_installment_table')
        .insert(installments)
        .select()

      if (error) throw error
      return data || []
    } else {
      const db = await openDB()
      const stmt = await db.prepare(
        `INSERT INTO financing_installment_table (
          financing_id, installment_number, due_date,
          amount_due, amount_paid, payment_status, paid_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )

      for (const inst of installments) {
        await stmt.run([
          inst.financing_id,
          inst.installment_number,
          inst.due_date,
          inst.amount_due,
          inst.amount_paid || 0,
          inst.payment_status || 'pending',
          inst.paid_date || null,
          inst.notes || null
        ])
      }

      await stmt.finalize()
      await db.close()
      return installments
    }
  }

  static async update(id: number, installment: Database['public']['Tables']['financing_installment_table']['Update']) {
    if (useSupabase('financing')) {
      const { data, error } = await supabase
        .from('financing_installment_table')
        .update(installment)
        .eq('installment_id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const fields = Object.keys(installment).filter(k => installment[k as keyof typeof installment] !== undefined)
      const values = fields.map(k => installment[k as keyof typeof installment] ?? null)
      const setClause = fields.map(f => `${f} = ?`).join(', ')

      await db.run(
        `UPDATE financing_installment_table SET ${setClause} WHERE installment_id = ?`,
        [...values, id]
      )
      await db.close()
      return { installment_id: id, ...installment }
    }
  }

  static async deleteByFinancingId(financingId: number) {
    if (useSupabase('financing')) {
      const { error } = await supabase
        .from('financing_installment_table')
        .delete()
        .eq('financing_id', financingId)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM financing_installment_table WHERE financing_id = ?', [financingId])
      await db.close()
    }
  }

  /**
   * Get installment amounts for all financing plans linked to commitments,
   * filtered by a specific month/year. Used by the commitment page to
   * display dynamic per-month amounts instead of flat commitment_per_month.
   */
  static async getLinkedCommitmentAmounts(month: number, year: number) {
    const monthStr = String(month + 1).padStart(2, '0')
    const endMonth = month === 11 ? 0 : month + 1
    const endYear = month === 11 ? year + 1 : year
    const endMonthStr = String(endMonth + 1).padStart(2, '0')
    const startDate = `${year}-${monthStr}-01`
    const endDate = `${endYear}-${endMonthStr}-01`

    if (useSupabase('financing')) {
      // First get financing plans with linked commitments
      const { data: plans, error: plansError } = await supabase
        .from('financing_plan_table')
        .select('financing_id, financing_name, linked_commitment_id, status')
        .not('linked_commitment_id', 'is', null)
        .eq('status', 'active')

      if (plansError) throw plansError
      if (!plans || plans.length === 0) return []

      const financingIds = plans.map(p => p.financing_id)

      const { data: installments, error: instError } = await supabase
        .from('financing_installment_table')
        .select('*')
        .in('financing_id', financingIds)
        .gte('due_date', startDate)
        .lt('due_date', endDate)

      if (instError) throw instError

      return (installments || []).map(inst => {
        const plan = plans.find(p => p.financing_id === inst.financing_id)
        return {
          commitment_id: plan?.linked_commitment_id,
          financing_id: inst.financing_id,
          financing_name: plan?.financing_name,
          installment_id: inst.installment_id,
          installment_amount: inst.amount_due,
          installment_due_date: inst.due_date,
          installment_payment_status: inst.payment_status,
          installment_paid_date: inst.paid_date,
        }
      })
    } else {
      const db = await openDB()
      const results = await db.all(
        `SELECT
          fp.linked_commitment_id as commitment_id,
          fi.financing_id,
          fp.financing_name,
          fi.installment_id,
          fi.amount_due as installment_amount,
          fi.due_date as installment_due_date,
          fi.payment_status as installment_payment_status,
          fi.paid_date as installment_paid_date
        FROM financing_installment_table fi
        JOIN financing_plan_table fp ON fi.financing_id = fp.financing_id
        WHERE fp.linked_commitment_id IS NOT NULL
          AND fp.status = 'active'
          AND fi.due_date >= ? AND fi.due_date < ?
        ORDER BY fi.due_date ASC`,
        [startDate, endDate]
      )
      await db.close()
      return results
    }
  }
}

// Auth Adapter (Users and Sessions)
export class AuthAdapter {
  // User methods
  static async getUserByUsername(username: string) {
    if (useSupabase('auth')) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('is_active', 1)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      return data
    } else {
      const db = await openDB()
      const user = await db.get(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username]
      )
      await db.close()
      return user
    }
  }

  static async getUserById(userId: number) {
    if (useSupabase('auth')) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('is_active', 1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } else {
      const db = await openDB()
      const user = await db.get(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [userId]
      )
      await db.close()
      return user
    }
  }

  static async updateUser(userId: number, updates: Database['public']['Tables']['users']['Update']) {
    if (useSupabase('auth')) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      const fields = Object.keys(updates)
      const values = Object.values(updates)
      const setClause = fields.map(f => `${f} = ?`).join(', ')

      await db.run(
        `UPDATE users SET ${setClause} WHERE id = ?`,
        [...values, userId]
      )
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId])
      await db.close()
      return user
    }
  }

  // Session methods
  static async createSession(userId: number, sessionToken: string, expiresAt: string) {
    if (useSupabase('auth')) {
      // Delete all existing sessions for this user (single session only)
      await supabase
        .from('sessions')
        .delete()
        .eq('user_id', userId)

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          expires_at: expiresAt
        })
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      const db = await openDB()
      // Delete all existing sessions for this user
      await db.run('DELETE FROM sessions WHERE user_id = ?', [userId])

      await db.run(
        'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
        [userId, sessionToken, expiresAt]
      )
      await db.close()
    }
  }

  static async getSessionByToken(token: string) {
    if (useSupabase('auth')) {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          users (
            id,
            username,
            email,
            phone_number,
            first_name,
            last_name,
            is_active,
            created_at
          )
        `)
        .eq('session_token', token)
        .gt('expires_at', now)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      if (!data || !data.users) return null

      // Check if user is active
      const user = Array.isArray(data.users) ? data.users[0] : data.users
      if (!user || user.is_active !== 1) return null

      return {
        id: data.id,
        user_id: data.user_id,
        session_token: data.session_token,
        expires_at: data.expires_at,
        created_at: data.created_at,
        user: user
      }
    } else {
      const db = await openDB()
      const session = await db.get(
        `SELECT
          s.*,
          u.id as user_id,
          u.username,
          u.email,
          u.phone_number,
          u.first_name,
          u.last_name,
          u.is_active
        FROM sessions s
        INNER JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > datetime('now') AND u.is_active = 1`,
        [token]
      )
      await db.close()

      if (!session) return null

      return {
        id: session.id,
        user_id: session.user_id,
        session_token: session.session_token,
        expires_at: session.expires_at,
        created_at: session.created_at,
        user: {
          id: session.user_id,
          username: session.username,
          email: session.email,
          phone_number: session.phone_number,
          first_name: session.first_name,
          last_name: session.last_name,
          is_active: session.is_active,
          created_at: session.created_at,
        }
      }
    }
  }

  static async deleteSession(token: string) {
    if (useSupabase('auth')) {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('session_token', token)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run('DELETE FROM sessions WHERE session_token = ?', [token])
      await db.close()
    }
  }

  static async cleanupExpiredSessions() {
    if (useSupabase('auth')) {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('sessions')
        .delete()
        .lt('expires_at', now)

      if (error) throw error
    } else {
      const db = await openDB()
      await db.run(`DELETE FROM sessions WHERE expires_at < datetime('now')`)
      await db.close()
    }
  }
}
