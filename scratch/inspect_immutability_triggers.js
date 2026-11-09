const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseUrl() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
}

const dbUrl = getDatabaseUrl();

async function run() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  console.log('--- Triggers on teller tables & accounting tables ---');
  const res = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table IN ('teller_session', 'teller_movement', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line')
    ORDER BY event_object_table, trigger_name;
  `);
  console.table(res.rows);

  const funcs = await client.query(`
    SELECT proname, prosrc
    FROM pg_proc
    WHERE proname IN ('fn_teller_session_immutability', 'fn_teller_movement_immutability');
  `);
  for (const f of funcs.rows) {
    console.log(`\n=== Function: ${f.proname} ===\n${f.prosrc}`);
  }

  await client.end();
}

run().catch(console.error);
