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
  await pool.query("DELETE FROM public.customer_receipt_allocation WHERE invoice_id LIKE 'inv_c74_ui_%'");
  await pool.query("DELETE FROM public.notification WHERE resource_type = 'INVOICE' AND resource_id LIKE 'inv_c74_ui_%'");
  await pool.query("DELETE FROM public.invoice WHERE id LIKE 'inv_c74_ui_%'");
  await pool.query("DELETE FROM public.accounting_journal_line WHERE journal_entry_id LIKE 'je_c74_ui_%'");
  await pool.query("DELETE FROM public.accounting_journal_entry WHERE id LIKE 'je_c74_ui_%'");
  await pool.query("DELETE FROM public.accounting_voucher WHERE id LIKE 'vch_c74_ui_%'");
  await pool.query("DELETE FROM public.bank_account WHERE id LIKE 'ba_c74_ui_%'");
  await pool.query("DELETE FROM public.customer WHERE id LIKE 'cust_c74_ui_%'");
  await pool.query("DELETE FROM public.order WHERE id LIKE 'ord_nexus_b2b_%'");
  await pool.query("DELETE FROM public.company WHERE id LIKE 'comp_c74_ui_%'");
  const coa = await pool.query('SELECT count(*)::int as c FROM public.accounting_account');
  const tb = await pool.query('SELECT sum(debit_amount)::numeric(12,2) as dr, sum(credit_amount)::numeric(12,2) as cr FROM public.accounting_journal_line');
  console.log('BASELINE AFTER CLEAN:', 'CoA:', coa.rows[0].c, 'Dr:', tb.rows[0].dr, 'Cr:', tb.rows[0].cr);
  await pool.end();
}

main().catch(console.error);
