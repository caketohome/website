const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
  }
  throw new Error("No database connection string found in environment or backend/.env");
}

async function runForensics() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== PHASE 4E: FORENSIC DATABASE MAPPING ===");

  const report = {};

  // 1. All public tables
  const tblRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  report.allTables = tblRes.rows.map(r => r.table_name);

  // 2. Table row counts for all existing tables
  report.rowCounts = {};
  for (const tbl of report.allTables) {
    try {
      const res = await client.query(`SELECT COUNT(*)::int AS cnt FROM public."${tbl}";`);
      report.rowCounts[tbl] = res.rows[0].cnt;
    } catch (e) {
      report.rowCounts[tbl] = `ERROR: ${e.message}`;
    }
  }

  // 3. Columns for all tables
  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);
  report.columnsByTable = {};
  for (const row of colsRes.rows) {
    if (!report.columnsByTable[row.table_name]) report.columnsByTable[row.table_name] = [];
    report.columnsByTable[row.table_name].push({ col: row.column_name, type: row.data_type, nullable: row.is_nullable });
  }

  // 4. Check setting table
  try {
    const settingRes = await client.query(`SELECT * FROM public.setting;`);
    report.allSettings = settingRes.rows;
  } catch (e) {
    report.allSettings = `ERROR: ${e.message}`;
  }

  // 5. Products sample & all products
  const prods = await client.query(`SELECT * FROM public.product;`);
  report.allProducts = prods.rows;

  // 6. Product variants
  const variants = await client.query(`SELECT * FROM public.product_variant;`);
  report.allProductVariants = variants.rows;

  // 7. Branch inventory sample
  const invSample = await client.query(`SELECT * FROM public.branch_inventory LIMIT 5;`);
  report.branchInventorySample = invSample.rows;

  // 8. Order sample
  const orderSample = await client.query(`SELECT * FROM public."order" LIMIT 2;`);
  report.orderSample = orderSample.rows;

  // 9. Payment transaction sample
  const ptSample = await client.query(`SELECT * FROM public.payment_transaction LIMIT 2;`);
  report.paymentTransactionSample = ptSample.rows;

  // 10. Expense categories
  const expCat = await client.query(`SELECT * FROM public.expense_category;`);
  report.expenseCategories = expCat.rows;

  // 11. Accounting accounts summary
  const acctSummary = await client.query(`
    SELECT code, name, type, subtype, level, is_group
    FROM public.accounting_account
    ORDER BY code ASC;
  `);
  report.accountingAccounts = acctSummary.rows;

  // 12. Accounting constraints
  const acctConstraintsRes = await client.query(`
    SELECT conrelid::regclass::text as table_name, conname, contype, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND conrelid::regclass::text LIKE 'accounting_%'
    ORDER BY conrelid::regclass::text, conname;
  `);
  report.accountingConstraints = acctConstraintsRes.rows;

  const outPath = path.join(__dirname, 'phase4e_forensic_data.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Forensics saved to ${outPath}`);

  await client.end();
}

runForensics().catch(err => {
  console.error("Forensics failed:", err);
  process.exit(1);
});
