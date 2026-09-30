const { Client } = require('../node_modules/pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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
  throw new Error("No database connection string found");
}

async function cleanup() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query("DELETE FROM public.bank_reconciliation_match");
  await client.query("DELETE FROM public.bank_reconciliation_session");
  await client.query("DELETE FROM public.bank_statement_line");
  await client.query("DELETE FROM public.bank_statement_import");
  await client.query("DELETE FROM public.bank_deposit_slip");
  await client.query("DELETE FROM public.bank_account");
  await client.query("DELETE FROM public.accounting_fiscal_period WHERE id LIKE 'fp_test%'");
  await client.query("DELETE FROM public.setting WHERE key = 'accounting_start_date'");
  await client.query("DELETE FROM public.accounting_journal_line");
  await client.query("DELETE FROM public.accounting_journal_entry");
  await client.query("DELETE FROM public.accounting_voucher");

  console.log('Cleanup successful.');
  await client.end();
}

cleanup().catch(console.error);
