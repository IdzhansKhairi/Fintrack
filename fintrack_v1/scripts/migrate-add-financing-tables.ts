// scripts/migrate-add-financing-tables.ts
import { openDB } from "../lib/db";

async function migrateFinancingTables() {
  console.log("=== Adding Financing Tables ===\n");

  const db = await openDB();

  try {
    // Create financing_plan_table
    console.log("⏳ Creating financing_plan_table...");
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
    console.log("✅ financing_plan_table created");

    // Create financing_installment_table
    console.log("⏳ Creating financing_installment_table...");
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
    console.log("✅ financing_installment_table created");

    console.log("\n✅ All financing tables created successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await db.close();
    process.exit(1);
  }

  await db.close();
}

migrateFinancingTables();
