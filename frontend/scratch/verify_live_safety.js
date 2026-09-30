const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
}

async function verifyLiveSafety() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('=== VERIFYING ALL 12 TABLES & SAFETY INVARIANTS ===');
  const checks = [
    { t: 'inventory_cost_lot', expected: 0 },
    { t: 'accounting_account', expected: 98 },
    { t: 'accounting_voucher', expected: 0 },
    { t: 'accounting_journal_entry', expected: 0 },
    { t: 'accounting_journal_line', expected: 0 },
    { t: 'accounting_fiscal_period', expected: 0 },
    { t: 'purchase', expected: 0 },
    { t: 'purchase_item', expected: 0 },
    { t: 'purchase_payment', expected: 0 },
    { t: 'branch_inventory', expected: 424 },
    { t: 'order', expected: 173 },
    { t: 'payment_transaction', expected: 53 }
  ];

  for (const c of checks) {
    const res = await client.query(`SELECT COUNT(*) as cnt FROM public."${c.t}"`);
    const count = parseInt(res.rows[0].cnt, 10);
    const pass = count === c.expected;
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${c.t} = ${count} (expected: ${c.expected})`);
  }

  // Check setting
  const setRes = await client.query(`SELECT value FROM public.setting WHERE key = 'accounting_start_date'`);
  console.log(`${setRes.rows.length === 0 ? '✅ PASS' : '❌ FAIL'}: accounting_start_date is unconfigured (0 rows)`);

  // Check no synthetic cake inventory
  const synRes = await client.query(`SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE product_id NOT LIKE 'acc_%'`);
  const synCount = parseInt(synRes.rows[0].cnt, 10);
  console.log(`${synCount === 0 ? '✅ PASS' : '❌ FAIL'}: No synthetic cake inventory in branch_inventory (${synCount} non-acc rows)`);

  // Check CoA 1131, 1132, 1133, 5110, 5120, 5130
  const coaRes = await client.query(`
    SELECT code, name, type, subtype, is_group 
    FROM public.accounting_account 
    WHERE code IN ('1131', '1132', '1133', '5110', '5120', '5130')
    ORDER BY code;
  `);
  console.log('\n=== LIVE COA ACCOUNTS ===');
  console.log(JSON.stringify(coaRes.rows, null, 2));

  await client.end();
}

verifyLiveSafety().catch(console.error);
