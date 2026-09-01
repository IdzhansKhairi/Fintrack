// lib/initDb.ts
import { openDB } from "./db";

export async function initializeDatabase() {
  const db = await openDB();

  // Create transaction_list_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_list_table (
      transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_date DATE NOT NULL,
      transaction_time TIME NOT NULL,
      transaction_description TEXT NOT NULL,
      transaction_amount REAL NOT NULL,
      transaction_category TEXT NOT NULL,
      transaction_sub_category TEXT NOT NULL,
      transaction_card_choice TEXT,
      transaction_income_source TEXT,
      transaction_expense_usage TEXT,
      transaction_expense_usage_category TEXT,
      transaction_hobby_category TEXT,
      transaction_spending_beneficiary TEXT
    )
  `);
  console.log("Database initialized: transaction_list_table created");

  // Create account_balance_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS account_balance_table (
      account_id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_category TEXT NOT NULL,
      account_sub_category TEXT NOT NULL,
      account_card_type TEXT,
      current_balance REAL NOT NULL DEFAULT 0
    )
  `);
  console.log("Database initialized: account_balance_table created");

  // Create commitment_list_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS commitment_list_table (
      commitment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      commitment_name TEXT NOT NULL,
      commitment_description TEXT,
      commitment_per_month REAL NOT NULL,
      commitment_per_year REAL NOT NULL,
      commitment_notes TEXT,
      commitment_status TEXT NOT NULL DEFAULT 'Active',
      commitment_start_month INTEGER,
      commitment_start_year INTEGER
    )
  `);
  console.log("Database initialized: commitment_list_table created");

  // Create commitment_payment_status_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS commitment_payment_status_table (
      commitment_payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      commitment_id INTEGER NOT NULL,
      payment_month INTEGER NOT NULL,
      payment_year INTEGER NOT NULL,
      payment_status INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (commitment_id) REFERENCES commitment_list_table(commitment_id) ON DELETE CASCADE,
      UNIQUE(commitment_id, payment_month, payment_year)
    )
  `);
  console.log("Database initialized: commitment_payment_status_table created");

  // Create wishlist_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist_table (
      wishlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
      wishlist_name TEXT NOT NULL,
      wishlist_category TEXT NOT NULL,
      wishlist_estimate_price REAL,
      wishlist_final_price REAL,
      wishlist_purchase_date DATE,
      wishlist_url_link TEXT,
      wishlist_url_picture TEXT,
      wishlist_status TEXT NOT NULL DEFAULT 'not_purchased'
    )
  `);
  console.log("Database initialized: wishlist_table created");

  // Create debts_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS debts_table (
      debt_id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_type TEXT NOT NULL,
      created_date DATE NOT NULL,
      due_date DATE,
      person_name TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      settled_date DATE
    )
  `);
  console.log("Database initialized: debts_table created");

  // Create financing_plan_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS financing_plan_table (
      financing_id INTEGER PRIMARY KEY AUTOINCREMENT,
      financing_name TEXT NOT NULL,
      financing_provider TEXT,
      financing_category TEXT NOT NULL,
      total_amount REAL NOT NULL,
      total_months INTEGER NOT NULL,
      monthly_amount_default REAL NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      linked_commitment_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linked_commitment_id) REFERENCES commitment_list_table(commitment_id) ON DELETE SET NULL
    )
  `);
  console.log("Database initialized: financing_plan_table created");

  // Create financing_installment_table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS financing_installment_table (
      installment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      financing_id INTEGER NOT NULL,
      installment_number INTEGER NOT NULL,
      due_date DATE NOT NULL,
      amount_due REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      paid_date DATE,
      notes TEXT,
      FOREIGN KEY (financing_id) REFERENCES financing_plan_table(financing_id) ON DELETE CASCADE,
      UNIQUE(financing_id, installment_number)
    )
  `);
  console.log("Database initialized: financing_installment_table created");

  return db;
}
