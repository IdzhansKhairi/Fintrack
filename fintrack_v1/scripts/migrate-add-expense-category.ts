// scripts/migrate-add-expense-category.ts
// Migration script to add transaction_expense_usage_category column and populate existing data

import { openDB } from "../lib/db";

// Expense usage to category mapping (same as in displayMappings.ts)
const expenseUsageCategoryMapping: Record<string, string> = {
    // Living
    'food': 'Living',
    'groceries': 'Living',
    'health': 'Living',
    'household': 'Living',
    'personalcare': 'Living',

    // Commitments
    'car': 'Commitments',
    'house': 'Commitments',
    'utilities': 'Commitments',
    'installment': 'Commitments',
    'transport': 'Commitments',
    'subscription': 'Commitments',

    // Personal
    'entertainment': 'Personal',
    'shopping': 'Personal',
    'travel': 'Personal',
    'gifts': 'Personal',
    'hobby': 'Personal',

    // Financial
    'investment': 'Financial',
    'charity': 'Financial',
    'payback': 'Financial',
    'movement': 'Financial',
    'update': 'Financial',

    // Others
    'others': 'Others',
};

async function migrateExpenseCategory() {
    console.log("Starting migration: Add expense usage category column...");

    const db = await openDB();

    // Step 1: Check if column already exists
    const tableInfo = await db.all("PRAGMA table_info(transaction_list_table)");
    const columnExists = tableInfo.some((col: any) => col.name === 'transaction_expense_usage_category');

    if (!columnExists) {
        // Step 2: Add the new column
        console.log("Adding transaction_expense_usage_category column...");
        await db.exec(`
            ALTER TABLE transaction_list_table
            ADD COLUMN transaction_expense_usage_category TEXT
        `);
        console.log("Column added successfully!");
    } else {
        console.log("Column already exists, skipping creation.");
    }

    // Step 3: Update existing transactions with expense usage category
    console.log("Updating existing transactions with expense usage category...");

    // Get all transactions with expense_usage but no category
    const transactions = await db.all(`
        SELECT transaction_id, transaction_expense_usage
        FROM transaction_list_table
        WHERE transaction_expense_usage IS NOT NULL
        AND (transaction_expense_usage_category IS NULL OR transaction_expense_usage_category = '')
    `);

    console.log(`Found ${transactions.length} transactions to update.`);

    // Update each transaction
    for (const t of transactions) {
        const category = expenseUsageCategoryMapping[t.transaction_expense_usage] || 'Others';
        await db.run(
            `UPDATE transaction_list_table
             SET transaction_expense_usage_category = ?
             WHERE transaction_id = ?`,
            [category, t.transaction_id]
        );
    }

    console.log("Migration completed successfully!");

    // Verify the update
    const updated = await db.all(`
        SELECT transaction_id, transaction_expense_usage, transaction_expense_usage_category
        FROM transaction_list_table
        WHERE transaction_expense_usage IS NOT NULL
    `);
    console.log("\nUpdated transactions:");
    console.table(updated);
}

migrateExpenseCategory()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
