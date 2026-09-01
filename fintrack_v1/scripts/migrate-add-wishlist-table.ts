import { openDB } from '../lib/db';

async function migrateAddWishlistTable() {
    console.log('Starting migration: Adding wishlist table...');

    const db = await openDB();

    try {
        // Create wishlist_table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS wishlist_table (
                wishlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
                wishlist_name TEXT NOT NULL,
                wishlist_category TEXT NOT NULL,
                wishlist_estimate_price REAL,
                wishlist_final_price REAL,
                wishlist_purchase_date DATE,
                wishlist_url_link TEXT,
                wishlist_url_picture TEXT,
                wishlist_status TEXT NOT NULL DEFAULT 'not_purchased'
            )
        `);
        console.log('✓ wishlist_table created');

        // Verify table exists
        const tables = await db.all(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name = 'wishlist_table'
        `);

        console.log('\nMigration completed successfully!');
        console.log('Created table:', tables.map(t => t.name).join(', '));

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

migrateAddWishlistTable()
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
