const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

const env = fs.readFileSync('./frontend/.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/['"]/g, '');

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table IN ('teller_session', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line')
  `);
  console.table(res.rows);

  const funcDef = await client.query(`
    SELECT proname, pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname IN ('fn_teller_session_immutability', 'fn_teller_movement_immutability')
  `);
  funcDef.rows.forEach(r => {
    console.log(`\n=== FUNCTION ${r.proname} ===\n${r.def}`);
  });

  await client.end();
}

run().catch(console.error);
