const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const env = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const conn = match[1].replace(/["']/g, '').trim();

async function auditDb() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== INDEPENDENT POSTGRESQL AUDIT RESULTS ===');

  // 1. Chart of Accounts Count
  const coaRes = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_account;');
  console.log('1. Chart of Accounts count:', coaRes.rows[0].count, coaRes.rows[0].count === 100 ? '(EXACT 100)' : '(MISMATCH)');

  // 2. Trial Balance Check
  const tbRes = await client.query('SELECT COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr FROM public.accounting_journal_line;');
  const dr = tbRes.rows[0].dr;
  const cr = tbRes.rows[0].cr;
  console.log('2. Trial Balance: Dr ₹' + dr + ' | Cr ₹' + cr + ' | Imbalance: ' + (dr === cr ? 'ZERO (Balanced)' : 'IMBALANCED'));

  // 3. Orphan Vouchers, Journal Entries, Journal Lines
  const orphanVch = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_voucher WHERE branch_id IS NULL;');
  const orphanJe = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_entry je WHERE NOT EXISTS (SELECT 1 FROM public.accounting_voucher v WHERE v.id = je.voucher_id);');
  const orphanJl = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_line jl WHERE NOT EXISTS (SELECT 1 FROM public.accounting_journal_entry je WHERE je.id = jl.journal_entry_id);');
  console.log('3. Orphans: Vouchers=' + orphanVch.rows[0].count + ', Journal Entries=' + orphanJe.rows[0].count + ', Journal Lines=' + orphanJl.rows[0].count);

  // 4. Lingering Locks & Test Runs / Rules
  const locksRes = await client.query('SELECT COUNT(*)::int as count FROM pg_locks WHERE NOT granted;');
  const testRulesRes = await client.query("SELECT COUNT(*)::int as count FROM public.cost_allocation_rule WHERE rule_code LIKE 'RUL-%' OR rule_code LIKE 'TEST-%';");
  const testRunsRes = await client.query("SELECT COUNT(*)::int as count FROM public.cost_allocation_run WHERE run_number LIKE 'RUN-%' OR run_number LIKE 'TEST-%';");
  console.log('4. Lingering locks=' + locksRes.rows[0].count + ', Test Rules=' + testRulesRes.rows[0].count + ', Test Runs=' + testRunsRes.rows[0].count);

  // 5. Cost-Centre & Allocation Schema Matching Migration
  const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('cost_centre', 'cost_allocation_rule', 'cost_allocation_rule_target', 'cost_allocation_run', 'cost_allocation_run_line') ORDER BY table_name;");
  console.log('5. Cost Allocation Tables present: ' + tablesRes.rows.map(r => r.table_name).join(', '));

  // 6. Existing Pre-Test Baseline Entity Counts
  const vchCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_voucher;');
  const jeCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_entry;');
  const jlCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_line;');
  const ccCount = await client.query('SELECT COUNT(*)::int as count FROM public.cost_centre;');
  console.log('6. Entity counts: Vouchers=' + vchCount.rows[0].count + ', JEs=' + jeCount.rows[0].count + ', Lines=' + jlCount.rows[0].count + ', CostCentres=' + ccCount.rows[0].count);

  await client.end();
}

auditDb().catch(e => { console.error('Audit Error:', e.message); process.exit(1); });
