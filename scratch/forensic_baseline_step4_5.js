const fs = require('fs');
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  
  // Try frontend/.env first, then backend/.env, then .env
  const candidatePaths = [
    path.join(__dirname, '../frontend/.env'),
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '../.env')
  ];

  for (const envPath of candidatePaths) {
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
  }
  throw new Error("No database connection string found in .env files");
}

async function verifyBaseline() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  let passedCount = 0;
  let failedCount = 0;

  console.log("=== INDEPENDENT POSTGRESQL BASELINE AUDIT ===");

  try {
    const checks = [
      { name: 'accounting_account', expected: 98, query: `SELECT count(*)::int AS cnt FROM public."accounting_account"` },
      { name: 'accounting_voucher', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."accounting_voucher"` },
      { name: 'accounting_journal_entry', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."accounting_journal_entry"` },
      { name: 'accounting_journal_line', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."accounting_journal_line"` },
      { name: 'accounting_fiscal_period', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."accounting_fiscal_period"` },
      { name: 'purchase', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."purchase"` },
      { name: 'purchase_item', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."purchase_item"` },
      { name: 'purchase_payment', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."purchase_payment"` },
      { name: 'supplier', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."supplier"` },
      { name: 'branch', expected: 57, query: `SELECT count(*)::int AS cnt FROM public."branch"` },
      { name: 'branch_inventory', expected: 424, query: `SELECT count(*)::int AS cnt FROM public."branch_inventory"` },
      { name: 'inventory_cost_lot', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."inventory_cost_lot"` },
      { name: 'inventory_movement', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."inventory_movement"` },
      { name: 'inventory_cost_consumption', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."inventory_cost_consumption"` },
      { name: 'order', expected: 173, query: `SELECT count(*)::int AS cnt FROM public."order"` },
      { name: 'payment_transaction', expected: 53, query: `SELECT count(*)::int AS cnt FROM public."payment_transaction"` },
      { name: 'accounting_start_date', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."setting" WHERE key = 'accounting_start_date'` },
      { name: 'synthetic accounting rows', expected: 0, query: `SELECT count(*)::int AS cnt FROM public."accounting_voucher" WHERE voucher_no LIKE 'TEST%' OR voucher_no LIKE 'MOCK%'` }
    ];

    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      const res = await client.query(c.query);
      const actual = res.rows[0].cnt;
      const isMatch = actual === c.expected;
      if (isMatch) {
        passedCount++;
        console.log(`[PASS] [${i+1}/18] ${c.name}: ${actual} (expected ${c.expected})`);
      } else {
        failedCount++;
        console.error(`[FAIL] [${i+1}/18] ${c.name}: ${actual} (expected ${c.expected})`);
      }
    }

    console.log(`\nBASELINE AUDIT SUMMARY: ${passedCount}/18 checks passed, ${failedCount} failed.`);
    if (failedCount === 0) {
      console.log("STATUS: 18 / 18 PASSED (100% PRISTINE)");
    } else {
      console.error("STATUS: BASELINE VIOLATION DETECTED");
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

verifyBaseline().catch(err => {
  console.error("Baseline audit failed with error:", err);
  process.exit(1);
});
