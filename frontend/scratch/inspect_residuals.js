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
  const vchIds = ['vch_00MUXUZXQLZK9TC1', 'vch_00MUXUZXREWQI4QW'];
  await pool.query('DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)', [vchIds]);
  await pool.query('DELETE FROM public.accounting_voucher WHERE id = ANY($1)', [vchIds]);

  const vchs = await pool.query('SELECT count(*)::int as count FROM public.accounting_voucher');
  const jes = await pool.query('SELECT count(*)::int as count FROM public.accounting_journal_entry');
  const lines = await pool.query('SELECT count(*)::int as count FROM public.accounting_journal_line');
  const coa = await pool.query('SELECT count(*)::int as count FROM public.accounting_account');
  const tb = await pool.query('SELECT COALESCE(SUM(debit_amount), 0)::numeric(12,2) as dr, COALESCE(SUM(credit_amount), 0)::numeric(12,2) as cr FROM public.accounting_journal_line');

  console.log(`Baseline Restored:`);
  console.log(`accounting_voucher: ${vchs.rows[0].count} (expected: 6)`);
  console.log(`accounting_journal_entry: ${jes.rows[0].count} (expected: 4)`);
  console.log(`accounting_journal_line: ${lines.rows[0].count} (expected: 10)`);
  console.log(`CoA: ${coa.rows[0].count} (expected: 100)`);
  console.log(`TB: Dr=₹${tb.rows[0].dr}, Cr=₹${tb.rows[0].cr}, Diff=₹${tb.rows[0].dr - tb.rows[0].cr}`);

  await pool.end();
}

main().catch(console.error);
