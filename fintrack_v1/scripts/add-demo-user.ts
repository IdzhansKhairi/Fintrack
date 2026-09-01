// scripts/add-demo-user.ts
import { config } from 'dotenv'
import * as path from 'path'

// Load .env.local file BEFORE any other imports
config({ path: path.resolve(process.cwd(), '.env.local') })

import { openDB } from "../lib/db";
import { hashPassword } from "../lib/auth";

async function addDemoUser() {
  console.log("=== Adding Demo User ===\n");

  const username = "user.demo";
  const email = "demo@example.com";
  const password = "finttrack-demo-92AjLk!";

  const db = await openDB();

  try {
    // Check if user already exists
    const existingUser = await db.get(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username, email]
    );

    if (existingUser) {
      console.log("⚠️  User already exists with username:", username);
      await db.close();
      process.exit(0);
    }

    // Hash the password
    console.log("⏳ Hashing password...");
    const passwordHash = await hashPassword(password);

    // Insert the user
    console.log("⏳ Creating user...");
    await db.run(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        username,
        email,
        passwordHash,
        "Demo",
        "User",
        null,
      ]
    );

    console.log("\n✅ Demo user created successfully!");
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (error) {
    console.error("❌ Failed to create user:", error);
    await db.close();
    process.exit(1);
  }

  await db.close();
}

addDemoUser();
