const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envContent = fs.readFileSync(path.join(__dirname, '../../backend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found");
}

async function cleanup() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  await client.query('DELETE FROM public.accounting_journal_line');
  await client.query('DELETE FROM public.accounting_journal_entry');
  await client.query('DELETE FROM public.accounting_voucher');
  await client.query('DELETE FROM public.bank_reconciliation_match');
  await client.query('DELETE FROM public.bank_reconciliation_session');
  await client.query('DELETE FROM public.bank_statement_line');
  await client.query('DELETE FROM public.bank_statement_import');
  await client.query('DELETE FROM public.bank_deposit_slip');
  await client.query('DELETE FROM public.gateway_payout_batch');
  await client.query('DELETE FROM public.purchase_payment');
  await client.query('DELETE FROM public.bank_account');
  await client.query('DELETE FROM public.accounting_fiscal_period');
  await client.query("DELETE FROM public.setting WHERE key = 'accounting_start_date'");

  console.log('Cleanup completed successfully.');
  await client.end();
}

cleanup().catch(console.error);
