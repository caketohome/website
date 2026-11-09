/**
 * CakeToHome ERP — Phase C Step C1: Bounded Read-Only Forensic Inspection
 * Strictly read-only queries with 3000ms statement_timeout.
 * Every check is isolated in try-catch so nothing hangs and errors are captured.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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
  throw new Error("No database connection string found in frontend/.env");
}

async function runForensicInspection() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  const output = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: {}
  };

  try {
    await client.connect();
    // Bounded statement timeout: 3 seconds max per query
    await client.query("SET statement_timeout = '3000'");

    // ── CHECK 1: Cash-related CoA accounts ──────────────────────────────────
    try {
      const coaRes = await client.query(`
        SELECT id, code, name, type, subtype, is_active, is_group, description 
        FROM public.accounting_account 
        WHERE code IN ('1110', '1111', '1112', '1113', '1114', '1118', '1119', '1121', '1122', '5290', '5295', '5296', '5299')
           OR LOWER(name) LIKE '%cash%'
           OR LOWER(name) LIKE '%over%'
           OR LOWER(name) LIKE '%short%'
        ORDER BY code
      `);
      output.checks.cash_coa_accounts = coaRes.rows;
    } catch (e) {
      output.errors.cash_coa_accounts = e.message;
    }

    // ── CHECK 2: Branch schema and drawer_session metadata ──────────────────
    try {
      const bCols = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branch'
        ORDER BY ordinal_position
      `);
      output.checks.branch_columns = bCols.rows.map(r => `${r.column_name} (${r.data_type})`);

      const bMeta = await client.query(`
        SELECT id, name, code, metadata->'drawer_session' AS drawer_session
        FROM public.branch
        WHERE metadata->'drawer_session' IS NOT NULL
        LIMIT 5
      `);
      output.checks.branches_with_drawer_session = bMeta.rows;
    } catch (e) {
      output.errors.branch_and_drawer = e.message;
    }

    // ── CHECK 3: Staff & User Tables Schema ─────────────────────────────────
    try {
      const uCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user'
        ORDER BY ordinal_position
      `);
      output.checks.user_columns = uCols.rows.map(r => r.column_name);

      const bsCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branch_staff'
        ORDER BY ordinal_position
      `);
      output.checks.branch_staff_columns = bsCols.rows.map(r => r.column_name);

      const bsRows = await client.query(`SELECT * FROM public.branch_staff LIMIT 5`);
      output.checks.branch_staff_sample = bsRows.rows;

      const uSample = await client.query(`SELECT id, email, first_name, last_name FROM public."user" LIMIT 3`);
      output.checks.user_sample = uSample.rows;
    } catch (e) {
      output.errors.staff_and_user = e.message;
    }

    // ── CHECK 4: Existing COD custody structures in orders ──────────────────
    try {
      const codSample = await client.query(`
        SELECT id, display_id, status, metadata->'cod_custody_event' AS cod_custody_event
        FROM public."order"
        WHERE metadata->'cod_custody_event' IS NOT NULL
        LIMIT 2
      `);
      output.checks.cod_custody_sample = codSample.rows;
    } catch (e) {
      output.errors.cod_custody = e.message;
    }

    // ── CHECK 5: Accounting Voucher, Entry, and Line Dimensions ─────────────
    try {
      const vCols = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'accounting_voucher'
        ORDER BY ordinal_position
      `);
      output.checks.voucher_columns = vCols.rows.map(r => r.column_name);

      const lCols = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'accounting_journal_line'
        ORDER BY ordinal_position
      `);
      output.checks.journal_line_columns = lCols.rows.map(r => r.column_name);
    } catch (e) {
      output.errors.journal_dimensions = e.message;
    }

    // ── CHECK 6: Bank Deposit Slip Schema ───────────────────────────────────
    try {
      const bdsCols = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bank_deposit_slip'
        ORDER BY ordinal_position
      `);
      output.checks.bank_deposit_slip_columns = bdsCols.rows.map(r => r.column_name);
    } catch (e) {
      output.errors.bank_deposit_slip = e.message;
    }

    // ── CHECK 7: Existing Teller or Cash Tables in DB ───────────────────────
    try {
      const tcTables = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (table_name LIKE '%teller%' OR table_name LIKE '%drawer%' OR table_name LIKE '%cash%')
      `);
      output.checks.existing_teller_tables = tcTables.rows.map(r => r.table_name);
    } catch (e) {
      output.errors.existing_teller_tables = e.message;
    }

  } finally {
    await client.end();
  }

  console.log(JSON.stringify(output, null, 2));
}

runForensicInspection().catch(err => {
  console.error("FATAL INSPECTION ERROR:", err);
  process.exit(1);
});
