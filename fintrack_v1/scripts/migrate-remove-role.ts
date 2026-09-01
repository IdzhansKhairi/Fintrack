// scripts/migrate-remove-role.ts
import { openDB } from "../lib/db";

async function migrate() {
  const db = await openDB();

  console.log("⚠️  This migration will remove the role field from the users table.");
  console.log("⚠️  All existing users and sessions will be deleted.");
  console.log("");

  try {
    // Drop the users table (this will also cascade delete sessions due to foreign key)
    console.log("Dropping old users table...");
    await db.exec(`DROP TABLE IF EXISTS users;`);

    // Drop the sessions table to be safe
    console.log("Dropping old sessions table...");
    await db.exec(`DROP TABLE IF EXISTS sessions;`);

    // Recreate users table without role field
    console.log("Creating new users table without role field...");
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone_number TEXT,
        first_name TEXT,
        last_name TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Recreate sessions table
    console.log("Creating sessions table...");
    await db.exec(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Recreate indexes
    console.log("Creating indexes...");
    await db.exec(`CREATE INDEX idx_session_token ON sessions(session_token);`);
    await db.exec(`CREATE INDEX idx_session_expires ON sessions(expires_at);`);
    await db.exec(`CREATE INDEX idx_username ON users(username);`);

    console.log("\n✅ Migration completed successfully!");
    console.log("✅ Users table recreated without role field.");
    console.log("\n⚠️  Note: All users have been deleted. You need to create a new user:");
    console.log("   Run: npm run db:seed-user");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await db.close();
    process.exit(1);
  }

  await db.close();
}

migrate();
