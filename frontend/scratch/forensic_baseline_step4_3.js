const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
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

async function runBaselineAudit() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase 4F Step 4.3 Independent PostgreSQL Baseline Audit');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assertCheck(name, actual, expected) {
    const passed = actual === expected;
    if (passed) {
      passCount++;
      console.log(`[PASS] ${name}: actual=${actual}, expected=${expected}`);
    } else {
      failCount++;
      console.error(`[FAIL] ${name}: actual=${actual}, expected=${expected}`);
    }
  }

  try {
    const checks = [
      { t: 'accounting_account', expected: 98 },
      { t: 'accounting_voucher', expected: 0 },
      { t: 'accounting_journal_entry', expected: 0 },
      { t: 'accounting_journal_line', expected: 0 },
      { t: 'accounting_fiscal_period', expected: 0 },
      { t: 'purchase', expected: 0 },
      { t: 'purchase_item', expected: 0 },
      { t: 'purchase_payment', expected: 0 },
      { t: 'supplier', expected: 0 },
      { t: 'branch', expected: 57 },
      { t: 'branch_inventory', expected: 424 },
      { t: 'inventory_cost_lot', expected: 0 },
      { t: 'inventory_movement', expected: 0 },
      { t: 'inventory_cost_consumption', expected: 0 },
      { t: 'order', expected: 173 },
      { t: 'payment_transaction', expected: 53 }
    ];

    for (const c of checks) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${c.t}"`);
      const count = parseInt(res.rows[0].cnt, 10);
      assertCheck(`Table count public."${c.t}"`, count, c.expected);
    }

    // Check setting: accounting_start_date is unconfigured
    const setRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
    assertCheck('Setting accounting_start_date configured rows', setRes.rows.length, 0);

    // Check branch_inventory purity: no synthetic non-acc rows
    const synRes = await client.query(`SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE product_id NOT LIKE 'acc_%'`);
    assertCheck('Synthetic non-acc rows in branch_inventory', parseInt(synRes.rows[0].cnt, 10), 0);

    console.log('\n=============================================================================');
    console.log(`BASELINE AUDIT SUMMARY: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
    console.log('=============================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

runBaselineAudit().catch(err => {
  console.error("Baseline audit failed with error:", err);
  process.exit(1);
});
