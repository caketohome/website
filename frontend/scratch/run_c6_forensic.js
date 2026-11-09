const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConn() {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No DATABASE_URL");
}

async function run() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const out = {};

  // 1. Table columns
  for (const t of ['accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_account']) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 
      ORDER BY ordinal_position
    `, [t]);
    out[t + '_columns'] = cols.rows;
  }

  // 2. fn_check_journal_balance
  const fn = await client.query(`
    SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'fn_check_journal_balance'
  `);
  out['fn_check_journal_balance'] = fn.rows[0]?.def || null;

  // 3. Multi-currency check across all tables in information_schema
  const currencyCols = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND (column_name ILIKE '%currency%' OR column_name ILIKE '%exchange_rate%' OR column_name ILIKE '%fx%')
    ORDER BY table_name
  `);
  out['currency_columns_in_db'] = currencyCols.rows;

  // 4. Party dimensions in accounting_journal_line
  const partyCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_journal_line'
      AND (column_name ILIKE '%customer%' OR column_name ILIKE '%supplier%' OR column_name ILIKE '%party%' OR column_name ILIKE '%vendor%' OR column_name ILIKE '%employee%')
  `);
  out['party_columns_in_journal_line'] = partyCols.rows;

  // 5. Check voucher_type enum / check constraints on accounting_voucher
  const vchTypeCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.accounting_voucher'::regclass
  `);
  out['accounting_voucher_constraints'] = vchTypeCheck.rows;

  fs.writeFileSync(path.join(__dirname, 'c6_forensic_db.json'), JSON.stringify(out, null, 2));
  console.log("Written to scratch/c6_forensic_db.json");

  await client.end();
}

run().catch(console.error);
