// scripts/migrate-add-spending-beneficiary.ts
// Migration to add transaction_spending_beneficiary column to transaction_list_table
// Run with: npm run db:migrate-spending-beneficiary

import { openDB } from '../lib/db';

async function migrate() {
  console.log('Starting migration: Add spending beneficiary column...');
  
  const db = await openDB();

  try {
    // Check if column already exists
    const tableInfo = await db.all("PRAGMA table_info(transaction_list_table)");
    const columnExists = tableInfo.some((col: any) => col.name === 'transaction_spending_beneficiary');

    if (columnExists) {
      console.log('Column transaction_spending_beneficiary already exists. Skipping migration.');
    } else {
      await db.run(`
        ALTER TABLE transaction_list_table 
        ADD COLUMN transaction_spending_beneficiary TEXT
      `);
      console.log('Successfully added transaction_spending_beneficiary column to transaction_list_table');
    }

    // Verify the column exists
    const updatedTableInfo = await db.all("PRAGMA table_info(transaction_list_table)");
    console.log('\nCurrent table structure:');
    updatedTableInfo.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await db.close();
  }

  console.log('\nMigration complete!');
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
