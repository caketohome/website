const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const env = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const conn = match[1].replace(/["']/g, '').trim();

async function runAudit() {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== INDEPENDENT POSTGRESQL AUDIT FOR PHASE C7.7 ===');

  // 1. Chart of Accounts
  const coa = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_account;');
  console.log('1. Chart of Accounts count:', coa.rows[0].count, coa.rows[0].count === 100 ? '(EXACT 100)' : '(MISMATCH)');

  // 2. Trial Balance
  const tb = await client.query('SELECT COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr FROM public.accounting_journal_line;');
  const dr = tb.rows[0].dr;
  const cr = tb.rows[0].cr;
  console.log('2. Trial Balance: Dr ₹' + dr + ' | Cr ₹' + cr + ' | Imbalance: ' + (dr === cr ? 'ZERO (Balanced)' : 'IMBALANCED'));

  // 3. Orphans
  const orphanVch = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_voucher WHERE branch_id IS NULL;');
  const orphanJe = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_entry je WHERE NOT EXISTS (SELECT 1 FROM public.accounting_voucher v WHERE v.id = je.voucher_id);');
  const orphanJl = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_line jl WHERE NOT EXISTS (SELECT 1 FROM public.accounting_journal_entry je WHERE je.id = jl.journal_entry_id);');
  console.log('3. Orphans: Vouchers=' + orphanVch.rows[0].count + ', Journal Entries=' + orphanJe.rows[0].count + ', Journal Lines=' + orphanJl.rows[0].count);

  // 4. Ungranted Locks
  const locks = await client.query('SELECT COUNT(*)::int as count FROM pg_locks WHERE NOT granted;');
  console.log('4. Ungranted locks:', locks.rows[0].count);

  // 5. Residual C7.7 Records
  const batches = await client.query('SELECT COUNT(*)::int as count FROM public.corporate_gifting_batch;');
  const recips = await client.query('SELECT COUNT(*)::int as count FROM public.corporate_gifting_recipient;');
  const testCusts = await client.query("SELECT COUNT(*)::int as count FROM public.customer WHERE id LIKE 'cus_corp_test%' OR id LIKE 'cus_7b_%';");
  const testCCs = await client.query("SELECT COUNT(*)::int as count FROM public.cost_centre WHERE code LIKE 'CC-TEST%' OR code LIKE 'CC-7B-%';");
  console.log('5. Residual records: Batches=' + batches.rows[0].count + ', Recipients=' + recips.rows[0].count + ', Test Customers=' + testCusts.rows[0].count + ', Test Cost Centres=' + testCCs.rows[0].count);

  // 6. Schema & Constraints
  const idxRes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='corporate_gifting_batch' AND indexname='idx_cgb_customer_file_hash_active';");
  const fkRes = await client.query("SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='corporate_gifting_batch' AND constraint_type='FOREIGN KEY';");
  console.log('6. Deduplication index idx_cgb_customer_file_hash_active:', idxRes.rows.length === 1 ? 'EXISTS' : 'MISSING');
  console.log('   Foreign keys on corporate_gifting_batch:', fkRes.rows.map(r => r.constraint_name).join(', '));

  // 7. Canonical Entity Counts
  const vchCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_voucher;');
  const jeCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_entry;');
  const jlCount = await client.query('SELECT COUNT(*)::int as count FROM public.accounting_journal_line;');
  console.log('7. Baseline entities: Vouchers=' + vchCount.rows[0].count + ', JEs=' + jeCount.rows[0].count + ', Lines=' + jlCount.rows[0].count);

  await client.end();
}

runAudit().catch(e => { console.error('Audit error:', e.message); process.exit(1); });
