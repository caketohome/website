const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
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
  throw new Error("DATABASE_URL not found in .env");
}

async function runForensic() {
  const connString = getConnectionString();
  const isSupabase = connString.includes('supabase');
  const client = new Client({
    connectionString: connString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
  });

  const report = {};

  try {
    await client.connect();

    // 1. cost_centre schema
    const ccCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cost_centre'
      ORDER BY ordinal_position;
    `);
    report.cost_centre_columns = ccCols.rows;

    // 2. cost_centre constraints & FKs
    const ccConstraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conrelid = 'public.cost_centre'::regclass;
    `);
    report.cost_centre_constraints = ccConstraints.rows;

    // 3. cost_centre indexes
    const ccIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cost_centre';
    `);
    report.cost_centre_indexes = ccIndexes.rows;

    // 4. cost_centre rows
    const ccRows = await client.query(`SELECT * FROM public.cost_centre;`);
    report.cost_centre_row_count = ccRows.rows.length;
    report.cost_centre_rows = ccRows.rows;

    // 5. accounting_voucher cost_centre_id column
    const vchCc = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_voucher' AND column_name LIKE '%cost_centre%';
    `);
    report.voucher_cost_centre_col = vchCc.rows;

    // 6. accounting_journal_line cost_centre_id column
    const lineCc = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_journal_line' AND column_name LIKE '%cost_centre%';
    `);
    report.journal_line_cost_centre_col = lineCc.rows;

    // 7. Check if any journal lines or vouchers reference cost centres
    const vchCcCount = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL;
    `);
    report.vouchers_with_cost_centre = parseInt(vchCcCount.rows[0].count, 10);

    const lineCcCount = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL;
    `);
    report.lines_with_cost_centre = parseInt(lineCcCount.rows[0].count, 10);

    // 8. company table
    const compCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'company'
      ORDER BY ordinal_position;
    `);
    report.company_columns = compCols.rows;

    const compRows = await client.query(`SELECT * FROM public.company;`);
    report.company_rows = compRows.rows;

    // 9. branch table structure & head office detection
    const brCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'branch'
      ORDER BY ordinal_position;
    `);
    report.branch_columns = brCols.rows.map(r => r.column_name);

    const brCount = await client.query(`SELECT COUNT(*) as count FROM public.branch;`);
    report.branch_count = parseInt(brCount.rows[0].count, 10);

    const brSample = await client.query(`
      SELECT *
      FROM public.branch
      LIMIT 3;
    `);
    report.branch_sample = brSample.rows;

    const hoBranches = await client.query(`
      SELECT *
      FROM public.branch
      WHERE name ILIKE '%Head%' OR name ILIKE '%Corporate%' OR name ILIKE '%Central%';
    `);
    report.head_office_or_central_branches = hoBranches.rows;

    // 10. Check other operational entities for cost_centre_id
    const entitiesToCheck = ['expense', 'purchase', 'purchase_payment', 'invoice', 'customer', 'supplier', 'order'];
    report.entity_cost_centre_columns = {};
    for (const ent of entitiesToCheck) {
      const entCols = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name LIKE '%cost_centre%';
      `, [ent]);
      report.entity_cost_centre_columns[ent] = entCols.rows.map(r => r.column_name);
    }

    // 11. All tables with 'allocation' or 'dimension'
    const allocTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name LIKE '%alloc%' OR table_name LIKE '%dimension%');
    `);
    report.allocation_tables = allocTables.rows.map(r => r.table_name);

    // 12. Chart of Accounts summary
    const coaCount = await client.query(`SELECT COUNT(*) as count FROM public.accounting_account;`);
    report.coa_count = parseInt(coaCount.rows[0].count, 10);

    const coaGroups = await client.query(`
      SELECT code, name, type, subtype, is_group, parent_id
      FROM public.accounting_account
      WHERE is_group = true
      ORDER BY code;
    `);
    report.coa_groups = coaGroups.rows;

    // 13. Voucher types in database
    const vchTypes = await client.query(`
      SELECT DISTINCT voucher_type, COUNT(*) as count
      FROM public.accounting_voucher
      GROUP BY voucher_type;
    `);
    report.voucher_types = vchTypes.rows;

    fs.writeFileSync(path.join(__dirname, 'c7_6_forensic_report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log('Forensic report saved to scratch/c7_6_forensic_report.json');
  } catch (err) {
    console.error('FORENSIC_ERROR:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runForensic();
