const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

const pool = new Pool({ connectionString: dbUrl });

async function main() {
  const oCols = await pool.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice' ORDER BY ordinal_position"
  );
  console.log('INVOICE COLS:');
  oCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  const constraints = await pool.query(
    `SELECT conname, contype, pg_get_constraintdef(c.oid) as def
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND conrelid = 'public.invoice'::regclass;`
  );
  console.log('INVOICE CONSTRAINTS:');
  constraints.rows.forEach(r => console.log(`  ${r.conname} (${r.contype}): ${r.def}`));

  const orderTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%order%' ORDER BY table_name"
  );
  console.log('ORDER TABLES:', orderTables.rows.map(r => r.table_name));

  await pool.end();
}

main().catch(console.error);
