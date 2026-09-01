// scripts/migrate-round-decimal-values.ts
// Migration script to round all monetary values to 2 decimal places in database tables

import { openDB } from "../lib/db";

async function roundDecimalValues() {
    console.log("Starting migration: Round all monetary values to 2 decimal places...\n");

    const db = await openDB();

    // ==========================================
    // 1. Update account_balance_table
    // ==========================================
    console.log("1. Updating account_balance_table...");

    // Get all accounts
    const accounts = await db.all("SELECT account_id, current_balance FROM account_balance_table");
    console.log(`   Found ${accounts.length} accounts to update.`);

    let accountsUpdated = 0;
    for (const account of accounts) {
        const roundedBalance = parseFloat(Number(account.current_balance).toFixed(2));

        // Only update if the value changed
        if (roundedBalance !== account.current_balance) {
            await db.run(
                "UPDATE account_balance_table SET current_balance = ? WHERE account_id = ?",
                [roundedBalance, account.account_id]
            );
            accountsUpdated++;
            console.log(`   Account ID ${account.account_id}: ${account.current_balance} → ${roundedBalance}`);
        }
    }
    console.log(`   ✓ Updated ${accountsUpdated} accounts\n`);

    // ==========================================
    // 2. Update commitment_list_table
    // ==========================================
    console.log("2. Updating commitment_list_table...");

    // Get all commitments
    const commitments = await db.all(`
        SELECT commitment_id, commitment_per_month, commitment_per_year
        FROM commitment_list_table
    `);
    console.log(`   Found ${commitments.length} commitments to update.`);

    let commitmentsUpdated = 0;
    for (const commitment of commitments) {
        const roundedPerMonth = parseFloat(Number(commitment.commitment_per_month).toFixed(2));
        const roundedPerYear = parseFloat(Number(commitment.commitment_per_year).toFixed(2));

        // Check if either value changed
        if (roundedPerMonth !== commitment.commitment_per_month ||
            roundedPerYear !== commitment.commitment_per_year) {
            await db.run(
                `UPDATE commitment_list_table
                 SET commitment_per_month = ?, commitment_per_year = ?
                 WHERE commitment_id = ?`,
                [roundedPerMonth, roundedPerYear, commitment.commitment_id]
            );
            commitmentsUpdated++;
            console.log(`   Commitment ID ${commitment.commitment_id}:`);
            if (roundedPerMonth !== commitment.commitment_per_month) {
                console.log(`     Per Month: ${commitment.commitment_per_month} → ${roundedPerMonth}`);
            }
            if (roundedPerYear !== commitment.commitment_per_year) {
                console.log(`     Per Year: ${commitment.commitment_per_year} → ${roundedPerYear}`);
            }
        }
    }
    console.log(`   ✓ Updated ${commitmentsUpdated} commitments\n`);

    // ==========================================
    // 3. Update transaction_list_table
    // ==========================================
    console.log("3. Updating transaction_list_table...");

    // Get all transactions
    const transactions = await db.all("SELECT transaction_id, transaction_amount FROM transaction_list_table");
    console.log(`   Found ${transactions.length} transactions to update.`);

    let transactionsUpdated = 0;
    for (const transaction of transactions) {
        const roundedAmount = parseFloat(Number(transaction.transaction_amount).toFixed(2));

        // Only update if the value changed
        if (roundedAmount !== transaction.transaction_amount) {
            await db.run(
                "UPDATE transaction_list_table SET transaction_amount = ? WHERE transaction_id = ?",
                [roundedAmount, transaction.transaction_id]
            );
            transactionsUpdated++;
            console.log(`   Transaction ID ${transaction.transaction_id}: ${transaction.transaction_amount} → ${roundedAmount}`);
        }
    }
    console.log(`   ✓ Updated ${transactionsUpdated} transactions\n`);

    // ==========================================
    // 4. Update debts_table
    // ==========================================
    console.log("4. Updating debts_table...");

    // Get all debts
    const debts = await db.all("SELECT debt_id, amount FROM debts_table");
    console.log(`   Found ${debts.length} debts to update.`);

    let debtsUpdated = 0;
    for (const debt of debts) {
        const roundedAmount = parseFloat(Number(debt.amount).toFixed(2));

        // Only update if the value changed
        if (roundedAmount !== debt.amount) {
            await db.run(
                "UPDATE debts_table SET amount = ? WHERE debt_id = ?",
                [roundedAmount, debt.debt_id]
            );
            debtsUpdated++;
            console.log(`   Debt ID ${debt.debt_id}: ${debt.amount} → ${roundedAmount}`);
        }
    }
    console.log(`   ✓ Updated ${debtsUpdated} debts\n`);

    // ==========================================
    // 5. Update wishlist_table
    // ==========================================
    console.log("5. Updating wishlist_table...");

    // Get all wishlist items
    const wishlistItems = await db.all(`
        SELECT wishlist_id, wishlist_estimate_price, wishlist_final_price
        FROM wishlist_table
    `);
    console.log(`   Found ${wishlistItems.length} wishlist items to update.`);

    let wishlistUpdated = 0;
    for (const item of wishlistItems) {
        const roundedEstimate = item.wishlist_estimate_price
            ? parseFloat(Number(item.wishlist_estimate_price).toFixed(2))
            : null;
        const roundedFinal = item.wishlist_final_price
            ? parseFloat(Number(item.wishlist_final_price).toFixed(2))
            : null;

        // Check if either value changed
        const estimateChanged = item.wishlist_estimate_price && roundedEstimate !== item.wishlist_estimate_price;
        const finalChanged = item.wishlist_final_price && roundedFinal !== item.wishlist_final_price;

        if (estimateChanged || finalChanged) {
            await db.run(
                `UPDATE wishlist_table
                 SET wishlist_estimate_price = ?, wishlist_final_price = ?
                 WHERE wishlist_id = ?`,
                [roundedEstimate, roundedFinal, item.wishlist_id]
            );
            wishlistUpdated++;
            console.log(`   Wishlist ID ${item.wishlist_id}:`);
            if (estimateChanged) {
                console.log(`     Estimate: ${item.wishlist_estimate_price} → ${roundedEstimate}`);
            }
            if (finalChanged) {
                console.log(`     Final: ${item.wishlist_final_price} → ${roundedFinal}`);
            }
        }
    }
    console.log(`   ✓ Updated ${wishlistUpdated} wishlist items\n`);

    // ==========================================
    // Summary
    // ==========================================
    console.log("=" .repeat(60));
    console.log("MIGRATION SUMMARY:");
    console.log("=" .repeat(60));
    console.log(`Accounts updated:      ${accountsUpdated} / ${accounts.length}`);
    console.log(`Commitments updated:   ${commitmentsUpdated} / ${commitments.length}`);
    console.log(`Transactions updated:  ${transactionsUpdated} / ${transactions.length}`);
    console.log(`Debts updated:         ${debtsUpdated} / ${debts.length}`);
    console.log(`Wishlist updated:      ${wishlistUpdated} / ${wishlistItems.length}`);
    console.log("=" .repeat(60));
    console.log("\n✓ Migration completed successfully!");
}

roundDecimalValues()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
