const fs = require('fs');
const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

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
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  const report = {};

  try {
    // 1. Table Counts
    const tables = [
      'accounting_account',
      'accounting_voucher',
      'accounting_journal_entry',
      'accounting_journal_line',
      'accounting_fiscal_period',
      'purchase',
      'purchase_item',
      'purchase_payment',
      'supplier',
      'branch',
      'branch_inventory',
      'inventory_cost_lot',
      'inventory_movement',
      'inventory_cost_consumption',
      'order',
      'payment_transaction'
    ];

    report.counts = {};
    for (const t of tables) {
      try {
        const res = await client.query(`SELECT count(*)::int AS cnt FROM public."${t}"`);
        report.counts[t] = res.rows[0].cnt;
      } catch (err) {
        report.counts[t] = 'ERROR: ' + err.message;
      }
    }

    // Setting table - check accounting_start_date
    try {
      const setRes = await client.query(`SELECT * FROM public.setting WHERE key = 'accounting_start_date'`);
      report.accounting_start_date = setRes.rows.length > 0 ? setRes.rows[0].value : 'UNCONFIGURED (0 rows)';
    } catch (err) {
      report.accounting_start_date = 'ERROR: ' + err.message;
    }

    // Setting table total count
    try {
      const setCnt = await client.query(`SELECT count(*)::int AS cnt FROM public.setting`);
      report.counts['setting'] = setCnt.rows[0].cnt;
    } catch (err) {
      report.counts['setting'] = 'ERROR: ' + err.message;
    }

    // 2. Column details for key tables
    const inspectCols = ['purchase', 'purchase_item', 'purchase_payment', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'supplier'];
    report.columns = {};
    for (const t of inspectCols) {
      const cRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [t]);
      report.columns[t] = cRes.rows;
    }

    // 3. Foreign keys for purchase, purchase_payment, accounting_voucher, accounting_journal_entry, accounting_journal_line
    report.foreign_keys = {};
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
    `, [inspectCols]);
    report.foreign_keys = fkRes.rows;

    // 4. Indexes for key tables
    report.indexes = {};
    const idxRes = await client.query(`
      SELECT
        tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1)
      ORDER BY tablename, indexname
    `, [inspectCols]);
    report.indexes = idxRes.rows;

    // 5. Check suppliers and branches count & samples (without sensitive info)
    const supRes = await client.query(`SELECT id, name, gstin, state, deleted_at FROM public.supplier LIMIT 5`);
    report.supplier_samples = supRes.rows;

    const brRes = await client.query(`SELECT id, name, code FROM public.branch LIMIT 5`);
    report.branch_samples = brRes.rows;

    // 6. Check Chart of Accounts Account 2111
    const acc2111 = await client.query(`SELECT id, code, name, type, is_group, parent_id FROM public.accounting_account WHERE code = '2111'`);
    report.account_2111 = acc2111.rows[0] || null;

    // Write report to scratch file for viewing
    fs.writeFileSync(path.join(__dirname, 'forensic_baseline_3d7b_result.json'), JSON.stringify(report, null, 2));
    console.log("Forensic report written successfully to scratch/forensic_baseline_3d7b_result.json");
    console.log("Table counts:");
    for (const [k, v] of Object.entries(report.counts)) {
      console.log(`  ${k}: ${v}`);
    }
    console.log("accounting_start_date:", report.accounting_start_date);
    console.log("Account 2111:", report.account_2111?.code, report.account_2111?.name, report.account_2111?.type);

  } finally {
    client.release();
    await pool.end();
  }
}

runForensics().catch(err => {
  console.error("Forensic check failed:", err.message);
  process.exit(1);
});
