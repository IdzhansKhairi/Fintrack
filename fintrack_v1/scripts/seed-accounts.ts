// scripts/seed-accounts.ts
// Run with: npm run db:seed-accounts

import { openDB } from "../lib/db";

async function seedAccounts() {
  const db = await openDB();

  // Check if accounts already exist
  const existing = await db.get("SELECT COUNT(*) as count FROM account_balance_table");
  if (existing.count > 0) {
    console.log("Accounts already seeded. Skipping...");
    return;
  }

  // Define all accounts with initial balances (set to 0, update with your actual amounts)
  const accounts = [
    // E-Wallet accounts
    { category: "E-Wallet", sub_category: "Touch 'n Go", card_type: null, balance: 0 },
    { category: "E-Wallet", sub_category: "Shopee Pay", card_type: null, balance: 0 },

    // Cash accounts
    { category: "Cash", sub_category: "Notes", card_type: null, balance: 0 },
    { category: "Cash", sub_category: "Coins", card_type: null, balance: 0 },

    // Card accounts - sub_category is division type, card_type is bank name
    { category: "Card", sub_category: "Past", card_type: "RHB", balance: 0 },
    { category: "Card", sub_category: "Present", card_type: "RHB", balance: 0 },
    { category: "Card", sub_category: "Savings", card_type: "RHB", balance: 0 },
    { category: "Card", sub_category: "Bliss", card_type: "RHB", balance: 0 },
  ];

  // Insert all accounts
  const stmt = await db.prepare(
    `INSERT INTO account_balance_table (account_category, account_sub_category, account_card_type, current_balance)
     VALUES (?, ?, ?, ?)`
  );

  for (const account of accounts) {
    await stmt.run(account.category, account.sub_category, account.card_type, account.balance);
  }

  await stmt.finalize();

  console.log(`Seeded ${accounts.length} accounts successfully!`);

  // Display all accounts
  const allAccounts = await db.all("SELECT * FROM account_balance_table");
  console.table(allAccounts);
}

seedAccounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
