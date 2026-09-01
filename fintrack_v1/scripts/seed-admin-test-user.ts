// scripts/seed-admin-test-user.ts
// Seeds a local-only admin user for development testing
// Uses openDB and bcrypt directly to avoid importing auth -> db-adapter -> supabase chain

import { openDB } from "../lib/db";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

async function seedAdminTestUser() {
  console.log("=== Seeding Admin Test User (Local Dev Only) ===\n");

  const db = await openDB();

  try {
    // Check if admin user already exists
    const existingUser = await db.get(
      `SELECT id FROM users WHERE username = ?`,
      ["admin"]
    );

    if (existingUser) {
      console.log("ℹ️  Admin test user already exists, skipping.");
      await db.close();
      return;
    }

    // Hash the password
    console.log("⏳ Hashing password...");
    const passwordHash = await bcrypt.hash("admin123", SALT_ROUNDS);

    // Insert the admin user
    console.log("⏳ Creating admin test user...");
    await db.run(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        "admin",
        "admin@dev.local",
        passwordHash,
        "Admin",
        "Dev",
        null,
      ]
    );

    console.log("\n✅ Admin test user created successfully!");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   ⚠️  This is for LOCAL DEVELOPMENT ONLY.");
  } catch (error) {
    console.error("❌ Failed to create admin test user:", error);
    await db.close();
    process.exit(1);
  }

  await db.close();
}

seedAdminTestUser();
