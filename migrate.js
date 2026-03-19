const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Alok@16012123@db.jeljuaozcpkjuevezvbu.supabase.co:5432/postgres';

async function runMigration() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const migrationFile = process.argv[2] || '019_add_updated_activity_type.sql';
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', migrationFile);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`Running migration: ${migrationFile}...`);
        await client.query(sql);
        console.log('Migration successful!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
