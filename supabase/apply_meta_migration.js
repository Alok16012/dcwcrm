const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:Alok%4016012123@jeljuaozcpkjuevezvbu.supabase.co:5432/postgres';

async function run() {
    console.log('Connecting to DB...');
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to DB');

        const m = 'supabase/migrations/047_add_metadata_to_leads.sql';
        console.log(`Applying ${m}...`);
        const sql = fs.readFileSync(m, 'utf8');
        await client.query(sql);
        console.log(`Success: ${m}`);
        
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

run();
