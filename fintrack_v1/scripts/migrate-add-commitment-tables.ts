import { openDB } from '../lib/db';

async function migrateAddCommitmentTables() {
    console.log('Starting migration: Adding commitment tables...');

    const db = await openDB();

    try {
        // Create commitment_list_table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS commitment_list_table (
                commitment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                commitment_name TEXT NOT NULL,
                commitment_description TEXT,
                commitment_per_month REAL NOT NULL,
                commitment_per_year REAL NOT NULL,
                commitment_notes TEXT,
                commitment_status TEXT NOT NULL DEFAULT 'Active',
                commitment_start_month INTEGER,
                commitment_start_year INTEGER
            )
        `);
        console.log('✓ commitment_list_table created');

        // Create commitment_payment_status_table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS commitment_payment_status_table (
                commitment_payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                commitment_id INTEGER NOT NULL,
                payment_month INTEGER NOT NULL,
                payment_year INTEGER NOT NULL,
                payment_status INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (commitment_id) REFERENCES commitment_list_table(commitment_id) ON DELETE CASCADE,
                UNIQUE(commitment_id, payment_month, payment_year)
            )
        `);
        console.log('✓ commitment_payment_status_table created');

        // Verify tables exist
        const tables = await db.all(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name IN ('commitment_list_table', 'commitment_payment_status_table')
        `);

        console.log('\nMigration completed successfully!');
        console.log('Created tables:', tables.map(t => t.name).join(', '));

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

migrateAddCommitmentTables()
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
