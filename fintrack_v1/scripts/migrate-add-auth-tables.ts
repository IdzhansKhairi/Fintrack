// scripts/migrate-add-auth-tables.ts
import { openDB } from "../lib/db";

async function migrate() {
  const db = await openDB();

  console.log("Creating users table...");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
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

  console.log("Creating sessions table...");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log("Creating index on session_token for faster lookups...");
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_token ON sessions(session_token);
  `);

  console.log("Creating index on expires_at for cleanup queries...");
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at);
  `);

  console.log("Creating index on username for login queries...");
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_username ON users(username);
  `);

  await db.close();
  console.log("✅ Authentication tables migration completed successfully!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
