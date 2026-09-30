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
      return line.substring('DATABASE_URL='.length).trim();
    }
  }
  throw new Error("No database connection string found");
}

async function run() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const audit = {};

  try {
    // 1. Accounting tables row counts
    const accCounts = await client.query(`
      SELECT 
        (SELECT count(*) FROM public.accounting_account) AS account_count,
        (SELECT count(*) FROM public.accounting_voucher) AS voucher_count,
        (SELECT count(*) FROM public.accounting_journal_entry) AS journal_entry_count,
        (SELECT count(*) FROM public.accounting_journal_line) AS journal_line_count,
        (SELECT count(*) FROM public.accounting_fiscal_period) AS fiscal_period_count;
    `);
    audit.accountingCounts = accCounts.rows[0];

    // 2. Inspect accounting_account columns and constraints
    const accCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='accounting_account'
      ORDER BY ordinal_position;
    `);
    audit.accountingAccountColumns = accCols.rows;

    const accConstraints = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_schema='public' AND constraint_name LIKE '%account%';
    `);
    audit.accountCheckConstraints = accConstraints.rows;

    // 3. Inspect existing purchase, purchase_item, purchase_payment, supplier tables
    const purchaseCols = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('purchase', 'purchase_item', 'purchase_payment', 'supplier')
      ORDER BY table_name, ordinal_position;
    `);
    audit.purchaseModuleColumns = purchaseCols.rows;

    // 4. Inspect existing product and catalog tables
    const prodCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='product'
      ORDER BY ordinal_position;
    `);
    audit.productColumns = prodCols.rows;

    // 5. Inspect product categories, variant options, and sample products
    const prodSample = await client.query(`
      SELECT id, title, subtitle, thumbnail, is_giftcard, discountable
      FROM public.product
      LIMIT 5;
    `);
    audit.productSample = prodSample.rows;

    // 6. Inspect tax rates in DB
    const taxRateRows = await client.query(`
      SELECT id, name, code, rate, is_default, created_at FROM public.tax_rate;
    `);
    audit.taxRates = taxRateRows.rows;

    // 7. Inspect branch table and branch_inventory
    const branchCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name='branch' AND table_schema='public';
    `);
    audit.branchColumns = branchCols.rows;

    const branchRows = await client.query(`
      SELECT * FROM public.branch LIMIT 5;
    `);
    audit.branchesSample = branchRows.rows;

    const invSummary = await client.query(`
      SELECT count(*) AS total_inventory_rows, count(DISTINCT branch_id) AS distinct_branches
      FROM public.branch_inventory;
    `);
    audit.inventorySummary = invSummary.rows[0];

    // 8. Inspect expense and expense_category
    const expCats = await client.query(`
      SELECT id, name, is_active FROM public.expense_category ORDER BY name;
    `);
    audit.expenseCategories = expCats.rows;

    // 9. Inspect payment_transaction provider & status distribution
    const payTxnDist = await client.query(`
      SELECT provider, status, settlement_status, count(*) 
      FROM public.payment_transaction 
      GROUP BY provider, status, settlement_status
      ORDER BY provider, status;
    `);
    audit.paymentTransactionsDistribution = payTxnDist.rows;

    console.log(JSON.stringify(audit, null, 2));

  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error("Forensic check failed:", err);
  process.exit(1);
});
