// scripts/seed-initial-user.ts
import { openDB } from "../lib/db";
import { hashPassword } from "../lib/auth";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function seedInitialUser() {
  console.log("=== Create Initial User ===\n");

  // Gather user information
  const username = await question("Enter username: ");
  const email = await question("Enter email: ");
  const password = await question("Enter password: ");
  const firstName = await question("Enter first name (optional): ");
  const lastName = await question("Enter last name (optional): ");
  const phoneNumber = await question("Enter phone number (optional): ");

  rl.close();

  if (!username || !email || !password) {
    console.error("❌ Username, email, and password are required!");
    process.exit(1);
  }

  const db = await openDB();

  try {
    // Check if user already exists
    const existingUser = await db.get(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username, email]
    );

    if (existingUser) {
      console.error("❌ User with this username or email already exists!");
      await db.close();
      process.exit(1);
    }

    // Hash the password
    console.log("\n⏳ Hashing password...");
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
        firstName || null,
        lastName || null,
        phoneNumber || null,
      ]
    );

    console.log("\n✅ Initial user created successfully!");
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
  } catch (error) {
    console.error("❌ Failed to create user:", error);
    await db.close();
    process.exit(1);
  }

  await db.close();
}

seedInitialUser();
