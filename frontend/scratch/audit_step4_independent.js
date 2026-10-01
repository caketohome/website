const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
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
  }
  throw new Error("No database connection string found in .env");
}

async function runAudit() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('══════════════════════════════════════════════════════════════════');
  console.log('Phase 5A.6 Step 4 — Independent PostgreSQL Database Audit');
  console.log('══════════════════════════════════════════════════════════════════\n');

  try {
    const [
      vchRes,
      jeRes,
      jlRes,
      perRes,
      setRes,
      acctRes,
      orderRes,
      payRes,
      invRes,
      auditRes,
      locksRes,
      idleTxRes,
      orphanRevRes
    ] = await Promise.all([
      client.query("SELECT count(*) FROM public.accounting_voucher"),
      client.query("SELECT count(*) FROM public.accounting_journal_entry"),
      client.query("SELECT count(*) FROM public.accounting_journal_line"),
      client.query("SELECT count(*) FROM public.accounting_fiscal_period"),
      client.query("SELECT count(*) FROM public.setting WHERE key LIKE '%accounting%'"),
      client.query("SELECT count(*) FROM public.accounting_account WHERE deleted_at IS NULL"),
      client.query("SELECT count(*) FROM public.order WHERE deleted_at IS NULL"),
      client.query("SELECT count(*) FROM public.payment_transaction WHERE deleted_at IS NULL"),
      client.query("SELECT count(*) FROM public.branch_inventory"),
      client.query("SELECT count(*) FROM public.audit_log WHERE action LIKE 'accounting%'"),
      client.query("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'"),
      client.query("SELECT count(*) FROM pg_stat_activity WHERE state IN ('idle in transaction', 'idle in transaction (aborted)')"),
      client.query(`
        SELECT count(*) FROM public.accounting_voucher 
        WHERE (reversed_by_voucher_id IS NOT NULL AND reversed_by_voucher_id NOT IN (SELECT id FROM public.accounting_voucher))
           OR (reversal_of_voucher_id IS NOT NULL AND reversal_of_voucher_id NOT IN (SELECT id FROM public.accounting_voucher))
      `)
    ]);

    const auditData = {
      vouchers: parseInt(vchRes.rows[0].count, 10),
      journal_entries: parseInt(jeRes.rows[0].count, 10),
      journal_lines: parseInt(jlRes.rows[0].count, 10),
      fiscal_periods: parseInt(perRes.rows[0].count, 10),
      accounting_settings: parseInt(setRes.rows[0].count, 10),
      active_accounts: parseInt(acctRes.rows[0].count, 10),
      orders: parseInt(orderRes.rows[0].count, 10),
      payments: parseInt(payRes.rows[0].count, 10),
      branch_inventory: parseInt(invRes.rows[0].count, 10),
      accounting_audit_logs: parseInt(auditRes.rows[0].count, 10),
      residual_advisory_locks: parseInt(locksRes.rows[0].count, 10),
      idle_in_transaction: parseInt(idleTxRes.rows[0].count, 10),
      orphan_reversal_links: parseInt(orphanRevRes.rows[0].count, 10)
    };

    console.table(auditData);

    const checks = [
      { name: 'Zero committed test vouchers', pass: auditData.vouchers === 0 },
      { name: 'Zero committed journal entries', pass: auditData.journal_entries === 0 },
      { name: 'Zero committed journal lines', pass: auditData.journal_lines === 0 },
      { name: 'Zero committed fiscal periods', pass: auditData.fiscal_periods === 0 },
      { name: 'Zero committed accounting settings', pass: auditData.accounting_settings === 0 },
      { name: 'Active CoA accounts intact (99)', pass: auditData.active_accounts === 99 },
      { name: 'Historical orders intact (173)', pass: auditData.orders === 173 },
      { name: 'Historical payments intact (53)', pass: auditData.payments === 53 },
      { name: 'Branch inventory records intact (424)', pass: auditData.branch_inventory === 424 },
      { name: 'Zero committed test accounting audit logs', pass: auditData.accounting_audit_logs === 0 },
      { name: 'Zero residual advisory locks', pass: auditData.residual_advisory_locks === 0 },
      { name: 'Zero idle in transaction connections', pass: auditData.idle_in_transaction === 0 },
      { name: 'Zero orphan reversal links', pass: auditData.orphan_reversal_links === 0 }
    ];

    let allPass = true;
    for (const c of checks) {
      if (c.pass) {
        console.log(`✓ PASS: ${c.name}`);
      } else {
        console.log(`✗ FAIL: ${c.name}`);
        allPass = false;
      }
    }

    if (allPass) {
      console.log('\n✅ INDEPENDENT AUDIT COMPLETE: DATABASE IS 100% PRISTINE');
      process.exit(0);
    } else {
      console.error('\n❌ AUDIT FAILED: PRISTINE INVARIANTS VIOLATED');
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
