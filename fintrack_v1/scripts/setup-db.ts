// scripts/setup-db.ts
// Run with: npx tsx scripts/setup-db.ts

import { initializeDatabase } from "../lib/initDb";

async function main() {
  try {
    await initializeDatabase();
    console.log("Database setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exit(1);
  }
}

main();
