const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== ACCOUNTING COUNTS ===");
  const counts = await client.query(`
    SELECT 
      (SELECT count(*) FROM public.accounting_account) AS accounts,
      (SELECT count(*) FROM public.accounting_voucher) AS vouchers,
      (SELECT count(*) FROM public.accounting_journal_entry) AS journals,
      (SELECT count(*) FROM public.accounting_journal_line) AS journal_lines,
      (SELECT count(*) FROM public.accounting_fiscal_period) AS fiscal_periods;
  `);
  console.log(counts.rows[0]);

  console.log("=== CHECK CONSTRAINTS ON ACCOUNTING_ACCOUNT ===");
  const cRes = await client.query(`
    SELECT constraint_name, check_clause 
    FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%account%' AND constraint_schema='public';
  `);
  cRes.rows.forEach(r => console.log(r.constraint_name, ':', r.check_clause));

  console.log("=== PURCHASE & PURCHASE_ITEM COLUMNS ===");
  const pCols = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name IN ('purchase', 'purchase_item', 'purchase_payment', 'supplier') AND table_schema='public'
    ORDER BY table_name, ordinal_position;
  `);
  pCols.rows.forEach(r => console.log(`${r.table_name}.${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  await client.end();
}

run().catch(console.error);
