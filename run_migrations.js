const { Client } = require('pg');
const fs = require('fs');

// Try host without db. prefix
const connectionString = 'postgresql://postgres:Alok%4016012123@jeljuaozcpkjuevezvbu.supabase.co:5432/postgres';

const migrations = [
    'supabase/migrations/027_add_mode_and_department_to_students.sql',
    'supabase/migrations/028_fix_lead_conversion_fields.sql',
    'supabase/migrations/029_register_new_lead_fields.sql'
];

async function run() {
    console.log('Connecting to DB...');
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to DB');

        for (const m of migrations) {
            console.log(`Applying ${m}...`);
            const sql = fs.readFileSync(m, 'utf8');
            await client.query(sql);
            console.log(`Success: ${m}`);
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

run();
