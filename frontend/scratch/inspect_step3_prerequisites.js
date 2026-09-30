const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      process.env.DATABASE_URL = line.substring('DATABASE_URL='.length).trim();
      break;
    }
  }
}

async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = ['purchase', 'purchase_item', 'purchase_payment', 'supplier', 'branch_inventory'];
  for (const t of tables) {
    const cols = await c.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    );
    console.log(`\n=== TABLE: ${t} ===`);
    console.log(cols.rows.map(r => `  ${r.column_name}: ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`).join('\n'));

    const constraints = await c.query(
      `SELECT conname, contype, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = $1::regclass`,
      [`public.${t}`]
    );
    console.log(`  Constraints:`);
    for (const row of constraints.rows) {
      console.log(`    [${row.contype}] ${row.conname}: ${row.def}`);
    }
  }

  // Check existing chart of accounts related to Purchase, AP, Inventory, and GST
  console.log(`\n=== RELEVANT CHART OF ACCOUNTS ===`);
  const coa = await c.query(`
    SELECT code, name, type, subtype, is_group, level
    FROM public.accounting_account
    WHERE code LIKE '1%' OR code LIKE '2%' OR code LIKE '5%'
    ORDER BY code
  `);
  for (const row of coa.rows) {
    console.log(`  ${row.code.padEnd(8)} | level ${row.level} | ${row.is_group ? '[GROUP]  ' : '[LEAF]   '} | ${row.type.padEnd(10)} | ${row.subtype.padEnd(20)} | ${row.name}`);
  }

  // Row counts
  const rowCounts = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM public.purchase) as purchase_count,
      (SELECT COUNT(*) FROM public.purchase_item) as purchase_item_count,
      (SELECT COUNT(*) FROM public.purchase_payment) as purchase_payment_count,
      (SELECT COUNT(*) FROM public.supplier) as supplier_count
  `);
  console.log(`\n=== ROW COUNTS ===`, rowCounts.rows[0]);

  await c.end();
}

run().catch(console.error);
