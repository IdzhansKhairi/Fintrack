// lib/db.ts
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

export async function openDB(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  return open({
    filename: "./database/mydb.sqlite",
    driver: sqlite3.Database,
  });
}
