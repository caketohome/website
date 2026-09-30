const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No DATABASE_URL found");
}

async function main() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Phase 5A.2 Forensic Discovery: Opening Balance & Fiscal Period State ===\n');

  // 1. Settings related to accounting
  console.log('--- 1. Accounting-related settings ---');
  const r1 = await client.query(
    "SELECT key, value FROM public.setting WHERE key ILIKE '%accounting%' OR key ILIKE '%fiscal%' OR key ILIKE '%period%' ORDER BY key"
  );
  console.log(r1.rows.length > 0 ? JSON.stringify(r1.rows, null, 2) : '(EMPTY — No accounting settings configured)');

  // 2. Fiscal period count & state
  console.log('\n--- 2. accounting_fiscal_period state ---');
  const r2 = await client.query('SELECT count(*)::int AS cnt FROM public.accounting_fiscal_period');
  console.log(`Rows: ${r2.rows[0].cnt}`);

  // 3. Fiscal period columns
  console.log('\n--- 3. accounting_fiscal_period schema ---');
  const r3 = await client.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='accounting_fiscal_period' AND table_schema='public' ORDER BY ordinal_position"
  );
  console.log(JSON.stringify(r3.rows, null, 2));

  // 4. Voucher type distribution
  console.log('\n--- 4. accounting_voucher by type ---');
  const r4 = await client.query('SELECT voucher_type, count(*)::int AS cnt FROM public.accounting_voucher GROUP BY voucher_type ORDER BY voucher_type');
  console.log(r4.rows.length > 0 ? JSON.stringify(r4.rows, null, 2) : '(EMPTY — 0 vouchers in system)');

  // 5. Journal entry/line counts
  console.log('\n--- 5. Journal entry/line counts ---');
  const je = await client.query('SELECT count(*)::int AS cnt FROM public.accounting_journal_entry');
  const jl = await client.query('SELECT count(*)::int AS cnt FROM public.accounting_journal_line');
  console.log(`Journal entries: ${je.rows[0].cnt}`);
  console.log(`Journal lines: ${jl.rows[0].cnt}`);

  // 6. Setting table schema (check if group column exists)
  console.log('\n--- 6. public.setting schema ---');
  const r6 = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='setting' AND table_schema='public' ORDER BY ordinal_position"
  );
  console.log(JSON.stringify(r6.rows, null, 2));

  // 7. All settings for context
  console.log('\n--- 7. All existing settings ---');
  const r7 = await client.query('SELECT key, value FROM public.setting WHERE deleted_at IS NULL ORDER BY key LIMIT 50');
  console.log(JSON.stringify(r7.rows, null, 2));

  // 8. Account types summary
  console.log('\n--- 8. CoA account type distribution ---');
  const r8 = await client.query(
    "SELECT type, count(*)::int AS cnt, SUM(CASE WHEN is_group THEN 1 ELSE 0 END)::int AS groups, SUM(CASE WHEN NOT is_group THEN 1 ELSE 0 END)::int AS leaf FROM public.accounting_account WHERE deleted_at IS NULL GROUP BY type ORDER BY type"
  );
  console.log(JSON.stringify(r8.rows, null, 2));

  // 9. Check if any OPENING_BALANCE voucher type is in the type enum
  console.log('\n--- 9. VoucherType enum check ---');
  const r9 = await client.query(
    "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname LIKE '%voucher%' ORDER BY enumsortorder"
  );
  console.log(r9.rows.length > 0 ? JSON.stringify(r9.rows.map(r => r.enumlabel)) : '(No enum found — voucher_type is likely text/varchar)');

  await client.end();
  console.log('\n=== Discovery complete ===');
}

main().catch(err => { console.error(err); process.exit(1); });
