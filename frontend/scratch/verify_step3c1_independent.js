const fs = require('fs');
const { Client } = require('../node_modules/pg');

const envContent = fs.readFileSync('../backend/.env', 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).substring('DATABASE_URL='.length).trim();
const c = new Client({ connectionString: dbUrl });

async function verify() {
  await c.connect();
  console.log('=== INDEPENDENT POSTGRESQL VERIFICATION ===\n');

  // 1. Check constraints on accounting_voucher
  const vCons = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def 
    FROM pg_constraint 
    WHERE conrelid = 'public.accounting_voucher'::regclass
    ORDER BY conname
  `);
  console.log('Accounting Voucher Constraints:');
  for (const row of vCons.rows) {
    console.log(`  - ${row.conname}: ${row.def}`);
  }

  // 2. Check live baseline counts
  console.log('\nLive Database Table Counts:');
  const tables = [
    'accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line',
    'accounting_fiscal_period', 'purchase', 'purchase_item', 'purchase_payment',
    'branch_inventory', 'order', 'payment_transaction',
    'inventory_cost_lot', 'inventory_movement', 'inventory_cost_consumption'
  ];

  for (const t of tables) {
    const res = await c.query(`SELECT COUNT(*) as cnt FROM public."${t}"`);
    console.log(`  - ${t}: ${res.rows[0].cnt}`);
  }

  // 3. Check setting accounting_start_date
  const setRes = await c.query(`SELECT * FROM public.setting WHERE key = 'accounting_start_date'`);
  console.log(`\naccounting_start_date setting: ${setRes.rows.length === 0 ? 'UNCONFIGURED (0 rows)' : JSON.stringify(setRes.rows[0])}`);

  // 4. Packaging representation
  const pkgProd = await c.query(`SELECT COUNT(*) as cnt FROM public.product WHERE merchandise_type = 'PACKAGING'`);
  console.log(`Product table packaging rows: ${pkgProd.rows[0].cnt}`);

  const nullBinv = await c.query(`SELECT COUNT(*) as cnt FROM public.branch_inventory WHERE product_id IS NULL OR variant_id IS NULL`);
  console.log(`branch_inventory rows with NULL product/variant: ${nullBinv.rows[0].cnt}`);

  await c.end();
}

verify().catch(console.error);
