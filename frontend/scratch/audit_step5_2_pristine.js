/**
 * Independent PostgreSQL Pristine Baseline Audit — Post-Substep 5.2
 */
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
  });
  const client = await pool.connect();
  try {
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('Independent PostgreSQL Pristine Audit — Post-Substep 5.2');
    console.log('══════════════════════════════════════════════════════════════════');
    console.log();

    const checks = [
      ['accounting_voucher', 0],
      ['accounting_journal_entry', 0],
      ['accounting_journal_line', 0],
      ['accounting_fiscal_period', 0],
      ['accounting_account', 99],
      ['order', 173],
      ['payment_transaction', 53],
      ['branch', 57],
      ['branch_inventory', 424],
      ['inventory_cost_lot', 0],
      ['inventory_movement', 0],
      ['inventory_cost_consumption', 0],
      ['purchase', 0],
      ['purchase_item', 0],
      ['purchase_payment', 0],
      ['supplier', 0],
    ];

    let pass = 0;
    let fail = 0;

    for (const [table, expected] of checks) {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
      const actual = r.rows[0].n;
      if (actual === expected) {
        console.log(`  ✓ PASS: ${table} === ${actual}`);
        pass++;
      } else {
        console.log(`  ✗ FAIL: ${table} expected ${expected}, got ${actual}`);
        fail++;
      }
    }

    // Accounting start date should be unconfigured
    const sd = await client.query(
      "SELECT COUNT(*)::int AS n FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL"
    );
    if (sd.rows[0].n === 0) {
      console.log('  ✓ PASS: accounting_start_date unconfigured');
      pass++;
    } else {
      console.log('  ✗ FAIL: accounting_start_date leaked');
      fail++;
    }

    // Check no orphan audit logs
    const auditLogs = await client.query(
      "SELECT COUNT(*)::int AS n FROM public.audit_log WHERE action IN ('accounting.fiscal_period_locked', 'accounting.fiscal_period_unlocked', 'accounting.fiscal_year_closed', 'accounting.fiscal_year_reopened')"
    );
    if (auditLogs.rows[0].n === 0) {
      console.log('  ✓ PASS: accounting_audit_log === 0');
      pass++;
    } else {
      console.log(`  ✗ FAIL: accounting_audit_log expected 0, got ${auditLogs.rows[0].n}`);
      fail++;
    }

    console.log();
    console.log('══════════════════════════════════════════════════════════════════');
    console.log(`PostgreSQL Pristine Audit: ${pass} PASS, ${fail} FAIL`);
    console.log('══════════════════════════════════════════════════════════════════');

    process.exit(fail > 0 ? 1 : 0);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
