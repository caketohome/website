const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  const conn = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).substring('DATABASE_URL='.length).trim();
  const c = new Client({ connectionString: conn });
  await c.connect();

  const res = await c.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.purchase_payment'::regclass
  `);
  console.log('purchase_payment constraints:', res.rows);

  const pCols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase'
  `);
  console.log('purchase columns:', pCols.rows.map(r => r.column_name));

  await c.end();
}

main().catch(console.error);
