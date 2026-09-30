const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  const conn = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).substring('DATABASE_URL='.length).trim();
  const c = new Client({ connectionString: conn });
  await c.connect();

  const vCols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
    ORDER BY ordinal_position
  `);
  console.log('accounting_voucher columns:\n', vCols.rows);

  const jCols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_journal_entry'
    ORDER BY ordinal_position
  `);
  console.log('accounting_journal_entry columns:\n', jCols.rows);

  const conRes = await c.query(`
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.accounting_voucher'::regclass
  `);
  console.log('accounting_voucher constraints:\n', conRes.rows);

  await c.end();
}

main().catch(console.error);
