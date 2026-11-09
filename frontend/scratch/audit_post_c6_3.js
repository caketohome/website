const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

const pool = new Pool({ connectionString: getConnectionString() });

async function audit() {
  const client = await pool.connect();
  try {
    console.log('==================================================');
    console.log('  INDEPENDENT POSTGRESQL DATABASE AUDIT');
    console.log('==================================================');
    
    // 1. accounting_account count
    const accRes = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    console.log('1. Chart of Accounts count:', accRes.rows[0].count, accRes.rows[0].count === 100 ? '✅ (Target: 100)' : '❌ FAIL');

    // 2. orphan journal entries (entries without voucher)
    const orphanEntryRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry e LEFT JOIN public.accounting_voucher v ON e.voucher_id = v.id WHERE v.id IS NULL');
    console.log('2. Orphan journal entries:', orphanEntryRes.rows[0].count, orphanEntryRes.rows[0].count === 0 ? '✅ (Target: 0)' : '❌ FAIL');

    // 3. orphan journal lines (lines without entry)
    const orphanLineRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line l LEFT JOIN public.accounting_journal_entry e ON l.journal_entry_id = e.id WHERE e.id IS NULL');
    console.log('3. Orphan journal lines:', orphanLineRes.rows[0].count, orphanLineRes.rows[0].count === 0 ? '✅ (Target: 0)' : '❌ FAIL');

    // 4. lingering C6 test vouchers
    const lingeringVchRes = await client.query("SELECT count(*)::int as count FROM public.accounting_voucher WHERE voucher_no ~* 'c6[._-]' OR reference_id ~* 'c6[._-]' OR created_by ~* 'c6[._-]' OR narration ~* 'c6[._-]'");
    console.log('4. Lingering C6 test vouchers:', lingeringVchRes.rows[0].count, lingeringVchRes.rows[0].count === 0 ? '✅ (Target: 0)' : '❌ FAIL');

    // 5. lingering C6 test users/suppliers/customers
    const lingeringUsers = await client.query('SELECT count(*)::int as count FROM public."user" WHERE id ~* \'c6[._-]\' OR email ~* \'c6[._-]\'');
    const lingeringSuppliers = await client.query("SELECT count(*)::int as count FROM public.supplier WHERE id ~* 'c6[._-]' OR name ~* 'c6[._-]'");
    const lingeringCustomers = await client.query("SELECT count(*)::int as count FROM public.customer WHERE id ~* 'c6[._-]' OR email ~* 'c6[._-]'");
    console.log('5. Lingering C6 test entities:');
    console.log('   - Users:', lingeringUsers.rows[0].count, lingeringUsers.rows[0].count === 0 ? '✅' : '❌ FAIL');
    console.log('   - Suppliers:', lingeringSuppliers.rows[0].count, lingeringSuppliers.rows[0].count === 0 ? '✅' : '❌ FAIL');
    console.log('   - Customers:', lingeringCustomers.rows[0].count, lingeringCustomers.rows[0].count === 0 ? '✅' : '❌ FAIL');

    // 6. vouchers summary
    const vchTotal = await client.query('SELECT count(*)::int as count, status FROM public.accounting_voucher GROUP BY status ORDER BY status');
    console.log('6. Accounting vouchers by status:');
    vchTotal.rows.forEach(r => console.log(`   - ${r.status}: ${r.count}`));

    // 7. journal entries / lines total
    const entryTotal = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry');
    const lineTotal = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line');
    console.log('7. Total journal entries:', entryTotal.rows[0].count);
    console.log('   Total journal lines:', lineTotal.rows[0].count);

    // 8. active blocked DB locks
    const locksRes = await client.query('SELECT count(*)::int as count FROM pg_locks WHERE NOT granted');
    console.log('8. Active blocked DB locks:', locksRes.rows[0].count, locksRes.rows[0].count === 0 ? '✅ (Target: 0)' : '❌ FAIL');

    // 9. Trial Balance balance check
    const tbRes = await client.query('SELECT COALESCE(SUM(debit_amount), 0)::numeric(15,2) as total_debit, COALESCE(SUM(credit_amount), 0)::numeric(15,2) as total_credit FROM public.accounting_journal_line');
    const dr = parseFloat(tbRes.rows[0].total_debit);
    const cr = parseFloat(tbRes.rows[0].total_credit);
    const diff = Math.abs(dr - cr);
    console.log('9. Trial Balance zero-sum check:');
    console.log(`   Total Debits:  ₹${dr.toFixed(2)}`);
    console.log(`   Total Credits: ₹${cr.toFixed(2)}`);
    console.log(`   Difference:    ₹${diff.toFixed(4)}`, diff === 0 ? '✅ (Balanced)' : '❌ UNBALANCED');

    const allPassed = (
      accRes.rows[0].count === 100 &&
      orphanEntryRes.rows[0].count === 0 &&
      orphanLineRes.rows[0].count === 0 &&
      lingeringVchRes.rows[0].count === 0 &&
      lingeringUsers.rows[0].count === 0 &&
      lingeringSuppliers.rows[0].count === 0 &&
      lingeringCustomers.rows[0].count === 0 &&
      locksRes.rows[0].count === 0 &&
      diff === 0
    );

    console.log('==================================================');
    if (allPassed) {
      console.log('AUDIT RESULT: ALL POSTGRESQL INVARIANTS SATISFIED ✅');
    } else {
      console.error('AUDIT RESULT: POSTGRESQL INVARIANTS VIOLATED ❌');
      process.exit(1);
    }
    console.log('==================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch(err => {
  console.error('Audit script failure:', err);
  process.exit(1);
});
