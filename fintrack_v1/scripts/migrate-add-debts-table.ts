import { openDB } from '../lib/db';

async function migrateAddDebtsTable() {
    console.log('Starting migration: Adding debts table...');

    const db = await openDB();

    try {
        // Create debts_table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS debts_table (
                debt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                debt_type TEXT NOT NULL,
                created_date DATE NOT NULL,
                due_date DATE,
                person_name TEXT NOT NULL,
                amount REAL NOT NULL,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                settled_date DATE
            )
        `);
        console.log('✓ debts_table created');

        // Verify table exists
        const tables = await db.all(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name = 'debts_table'
        `);

        console.log('\nMigration completed successfully!');
        console.log('Created table:', tables.map(t => t.name).join(', '));

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

migrateAddDebtsTable()
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
