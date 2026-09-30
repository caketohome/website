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
  throw new Error("No database connection string found in environment or backend/.env");
}

async function run() {
  const connectionString = getConnectionString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const results = {};

  try {
    // A. Check for existing accounting tables
    const accTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_fiscal_period')
    `);
    results.existingAccountingTables = accTablesRes.rows.map(r => r.table_name);

    // B. Check operational ID column types
    const opTypesRes = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND column_name = 'id'
        AND table_name IN ('branch', 'customer', 'supplier', 'purchase', 'expense', 'vehicle', 'fleet_fuel', 'order', 'payment_transaction')
      ORDER BY table_name;
    `);
    results.operationalIdTypes = opTypesRes.rows;

    // C. Check gen_random_uuid() function availability
    const uuidRes = await client.query(`SELECT gen_random_uuid()::text AS sample_uuid;`);
    results.genRandomUuidWorking = Boolean(uuidRes.rows[0]?.sample_uuid);
    results.sampleUuid = uuidRes.rows[0]?.sample_uuid;

    // D. Check for existing constraints or indexes matching proposed names
    const proposedObjects = [
      'accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'accounting_fiscal_period',
      'uq_accounting_account_code', 'chk_account_type', 'chk_account_subtype', 'chk_account_level',
      'uq_accounting_voucher_no', 'chk_voucher_type', 'chk_voucher_status', 'chk_voucher_total', 'chk_voucher_segregation', 'chk_voucher_posted_immutable',
      'uq_accounting_journal_entry_no', 'chk_journal_balanced', 'chk_journal_positive',
      'uq_journal_line_order', 'chk_jline_debit_nonneg', 'chk_jline_credit_nonneg', 'chk_jline_single_sided',
      'uq_fiscal_period', 'chk_fiscal_dates',
      'idx_accounting_voucher_source_idempotency', 'trg_check_journal_balance', 'fn_check_journal_balance'
    ];
    const collisionRes = await client.query(`
      SELECT 'constraint' AS type, constraint_name AS name FROM information_schema.table_constraints WHERE constraint_name = ANY($1)
      UNION ALL
      SELECT 'index' AS type, indexname AS name FROM pg_indexes WHERE indexname = ANY($1)
      UNION ALL
      SELECT 'function' AS type, routine_name AS name FROM information_schema.routines WHERE routine_name = ANY($1);
    `, [proposedObjects]);
    results.nameCollisions = collisionRes.rows;

    // E. Verify accounting_start_date in setting
    const settingRes = await client.query(`
      SELECT key, value FROM public.setting WHERE key = 'accounting_start_date';
    `);
    results.accountingStartDateSetting = settingRes.rows;

    // F. Record baseline row counts
    const countTables = ['order', 'payment_transaction', 'purchase', 'purchase_item', 'purchase_payment', 'expense', 'fleet_fuel'];
    results.baselineCounts = {};
    for (const t of countTables) {
      const q = t === 'order' ? 'SELECT count(*) FROM public."order"' : `SELECT count(*) FROM public."${t}"`;
      const cRes = await client.query(q);
      results.baselineCounts[t] = parseInt(cRes.rows[0].count, 10);
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error("Forensic inspection failed:", err);
  process.exit(1);
});
