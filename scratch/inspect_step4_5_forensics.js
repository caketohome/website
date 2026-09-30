const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../backend/.env');
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

async function runForensics() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  const report = {};

  try {
    // 1. payment_transaction columns
    const ptxnCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'payment_transaction' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    report.payment_transaction_columns = ptxnCols.rows;

    // 2. payment_transaction constraints & indexes
    const ptxnConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conrelid = 'public.payment_transaction'::regclass;
    `);
    report.payment_transaction_constraints = ptxnConstraints.rows;

    const ptxnIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'payment_transaction' AND schemaname = 'public';
    `);
    report.payment_transaction_indexes = ptxnIndexes.rows;

    // 3. payment_transaction distinct values in live DB
    const ptxnDistinct = await client.query(`
      SELECT 
        status, 
        provider, 
        COUNT(*) as cnt,
        MIN(amount) as min_amt,
        MAX(amount) as max_amt
      FROM public.payment_transaction
      GROUP BY status, provider
      ORDER BY status, provider;
    `);
    report.payment_transaction_distribution = ptxnDistinct.rows;

    // 4. Sample 5 payment transactions
    const ptxnSamples = await client.query(`
      SELECT *
      FROM public.payment_transaction
      LIMIT 5;
    `);
    report.payment_transaction_samples = ptxnSamples.rows;

    // 5. Verify CoA accounts: 1121, 1122, 1111, 1112, 1113, 5290
    const coaQuery = await client.query(`
      SELECT id, code, name, type, subtype, is_group, is_system, is_active, parent_id
      FROM public.accounting_account
      WHERE code IN ('1121', '1122', '1111', '1112', '1113', '5290')
      ORDER BY code;
    `);
    report.coa_accounts = coaQuery.rows;

    // 6. Check if 5290 exists or any related payment expense accounts
    const all5xxx = await client.query(`
      SELECT id, code, name, type, subtype, is_group, is_active
      FROM public.accounting_account
      WHERE code LIKE '5%'
      ORDER BY code;
    `);
    report.expense_accounts = all5xxx.rows;

    // 7. Check voucher type constraint on accounting_voucher
    const vchTypeCheck = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_voucher'::regclass AND c.conname LIKE '%type%';
    `);
    report.voucher_type_constraint = vchTypeCheck.rows;

    // 8. Check accounting_journal_entry & accounting_journal_line constraints
    const jentryConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_journal_entry'::regclass;
    `);
    report.journal_entry_constraints = jentryConstraints.rows;

    const jlineConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_journal_line'::regclass;
    `);
    report.journal_line_constraints = jlineConstraints.rows;

    // 9. Inspect order table columns
    const orderCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'order' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    report.order_columns = orderCols.rows;

    // 10. Check order payment status distribution in 173 historical orders
    const orderDist = await client.query(`
      SELECT 
        status, 
        metadata->>'payment_status' as meta_payment_status,
        metadata->>'payment_method' as meta_payment_method,
        COUNT(*) as cnt
      FROM public."order"
      GROUP BY status, metadata->>'payment_status', metadata->>'payment_method';
    `);
    report.order_status_distribution = orderDist.rows;

    fs.writeFileSync(path.join(__dirname, 'step4_5_forensic_results.json'), JSON.stringify(report, null, 2));
    console.log("Forensic inspection report written successfully.");

  } finally {
    await client.end();
  }
}

runForensics().catch(err => {
  console.error("Forensics failed:", err);
  process.exit(1);
});
