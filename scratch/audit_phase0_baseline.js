const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(__dirname, "../frontend/.env");
  const env = fs.readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    if (line.trim().startsWith("DATABASE_URL=")) {
      let val = line.trim().substring("DATABASE_URL=".length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env.DATABASE_URL = val;
      return val;
    }
  }
}
const dbUrl = loadEnv();
const { Pool } = require("../frontend/node_modules/pg");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && dbUrl.includes("supabase") ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
});

async function runAudit() {
  const client = await pool.connect();
  const baseline = {
    timestamp: new Date().toISOString(),
    database: {},
    tableCounts: {},
    accounting: {},
    cashCustody: {},
    taxGst: {},
    inventoryProduction: {},
    historicalDiscrepancies: {},
  };

  try {
    console.log("== CakeToHome ERP — Phase 0 PostgreSQL Baseline Audit ==");

    // 1. Database Identity
    const dbInfo = await client.query(`
      SELECT current_database() as db_name,
             current_user as user_name,
             version() as pg_version,
             current_setting('TIMEZONE') as timezone,
             NOW() as server_now;
    `);
    baseline.database = dbInfo.rows[0];
    console.log("[DB Info]", baseline.database.db_name, baseline.database.timezone, baseline.database.server_now);

    // 2. Public Tables and Row Counts
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`[Tables] Found ${tableNames.length} tables in public schema.`);

    for (const t of tableNames) {
      try {
        const countRes = await client.query(`SELECT count(*)::int as count FROM public."${t}";`);
        baseline.tableCounts[t] = countRes.rows[0].count;
      } catch (e) {
        baseline.tableCounts[t] = `Error: ${e.message}`;
      }
    }

    // 3. Accounting Voucher & Journal Verification
    const voucherCounts = await client.query(`
      SELECT status, deleted_at IS NOT NULL as is_deleted, count(*)::int as count 
      FROM public.accounting_voucher 
      GROUP BY status, deleted_at IS NOT NULL
      ORDER BY status, is_deleted;
    `);
    baseline.accounting.vouchers = voucherCounts.rows;

    const trialBalance = await client.query(`
      SELECT 
        COALESCE(SUM(jl.debit_amount), 0)::numeric(15,2) as total_debit,
        COALESCE(SUM(jl.credit_amount), 0)::numeric(15,2) as total_credit,
        (COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0))::numeric(15,2) as imbalance
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      JOIN public.accounting_voucher v ON v.id = je.voucher_id
      WHERE v.status = 'POSTED' AND v.deleted_at IS NULL;
    `);
    baseline.accounting.trialBalancePosted = trialBalance.rows[0];

    const trialBalanceAll = await client.query(`
      SELECT 
        COALESCE(SUM(jl.debit_amount), 0)::numeric(15,2) as total_debit,
        COALESCE(SUM(jl.credit_amount), 0)::numeric(15,2) as total_credit,
        (COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0))::numeric(15,2) as imbalance
      FROM public.accounting_journal_line jl;
    `);
    baseline.accounting.trialBalanceAllLines = trialBalanceAll.rows[0];

    // 4. Key Account Balances
    const keyAccounts = await client.query(`
      SELECT a.code, a.name, a.type,
             COALESCE(SUM(jl.debit_amount), 0)::numeric(15,2) as total_debit,
             COALESCE(SUM(jl.credit_amount), 0)::numeric(15,2) as total_credit,
             (COALESCE(SUM(jl.debit_amount), 0) - COALESCE(SUM(jl.credit_amount), 0))::numeric(15,2) as net_debit_balance
      FROM public.accounting_account a
      LEFT JOIN public.accounting_journal_line jl ON jl.account_id = a.id
      LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
      WHERE a.code IN ('1111', '1112', '1114', '1121', '1122', '1131', '1132', '1133', '2111', '2121', '2122', '2123', '3001', '4001', '5001', '5296')
      GROUP BY a.code, a.name, a.type
      ORDER BY a.code;
    `);
    baseline.accounting.keyAccounts = keyAccounts.rows;

    // 5. Account 1111 Breakdown by Branch
    const cash1111ByBranch = await client.query(`
      SELECT b.id as branch_id, b.name as branch_name, 
             b.deleted_at IS NOT NULL as is_soft_deleted,
             (b.id LIKE 'br_tc_%' OR b.id LIKE 'br_conc_%' OR b.id LIKE 'br_test_%' OR b.id LIKE 'test_%') as is_test_branch,
             COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric(15,2) as net_cash_1111
      FROM public.branch b
      LEFT JOIN public.accounting_journal_line jl ON jl.branch_id = b.id
      LEFT JOIN public.accounting_account a ON a.id = jl.account_id AND a.code = '1111'
      LEFT JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
      LEFT JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
      GROUP BY b.id, b.name, b.deleted_at
      HAVING COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0) != 0
      ORDER BY b.id;
    `);
    baseline.accounting.cash1111ByBranch = cash1111ByBranch.rows;

    // 6. Tax Tables & Active Rates (public.tax_rate)
    const taxRates = await client.query(`
      SELECT id, code, name, rate, is_default, metadata, created_at
      FROM public.tax_rate
      ORDER BY rate;
    `);
    baseline.taxGst.taxRates = taxRates.rows;

    const taxRules = await client.query(`
      SELECT id, tax_rate_id, reference, reference_id, created_at
      FROM public.tax_rate_rule;
    `);
    baseline.taxGst.taxRules = taxRules.rows;

    // Check seller GST registration
    const gstReg = await client.query(`
      SELECT *
      FROM public.gst_registration;
    `);
    baseline.taxGst.gstRegistrations = gstReg.rows;

    // 7. Orders and Quarantined Invoices
    const orderStats = await client.query(`
      SELECT status, count(*)::int as count,
             COALESCE(SUM((metadata->>'total')::numeric), 0)::numeric(15,2) as total_sum
      FROM public."order"
      GROUP BY status;
    `);
    baseline.historicalDiscrepancies.ordersByStatus = orderStats.rows;

    // Check if quarantined invoices exist in accounting_voucher or metadata
    const quarantinedVouchers = await client.query(`
      SELECT id, voucher_no, voucher_type, status, total_amount, narration, metadata
      FROM public.accounting_voucher
      WHERE narration ILIKE '%quarantin%' 
         OR narration ILIKE '%prototype%' 
         OR voucher_no ILIKE '%QUAR%'
         OR voucher_no ILIKE '%PROTO%'
         OR (metadata->>'is_quarantined')::boolean = true;
    `);
    baseline.historicalDiscrepancies.quarantinedVouchers = quarantinedVouchers.rows;

    // Check ₹550 test expenses
    const testExpenses550 = await client.query(`
      SELECT v.id, v.voucher_no, v.voucher_type, v.status, v.total_amount, v.narration,
             jl.debit_amount, jl.credit_amount, a.code as account_code, b.id as branch_id, b.name as branch_name
      FROM public.accounting_voucher v
      JOIN public.accounting_journal_entry je ON je.voucher_id = v.id
      JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
      JOIN public.accounting_account a ON a.id = jl.account_id
      LEFT JOIN public.branch b ON b.id = jl.branch_id
      WHERE (v.narration ILIKE '%test%' OR v.narration ILIKE '%tc_%' OR v.voucher_no ILIKE '%tc_%')
        AND (a.code = '1111' OR a.code = '1114')
      ORDER BY v.created_at;
    `);
    baseline.historicalDiscrepancies.testExpenses1111 = testExpenses550.rows;

    // Check AR 1121 ₹2,000 segregation of duties voucher
    const ar2000Vouchers = await client.query(`
      SELECT v.id, v.voucher_no, v.voucher_type, v.status, v.total_amount, v.narration,
             jl.debit_amount, jl.credit_amount, a.code as account_code, b.id as branch_id
      FROM public.accounting_voucher v
      JOIN public.accounting_journal_entry je ON je.voucher_id = v.id
      JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
      JOIN public.accounting_account a ON a.id = jl.account_id
      LEFT JOIN public.branch b ON b.id = jl.branch_id
      WHERE a.code = '1121'
      ORDER BY v.created_at;
    `);
    baseline.historicalDiscrepancies.ar1121Vouchers = ar2000Vouchers.rows;

    // Check Undeposited COD 1122
    const cod1122Vouchers = await client.query(`
      SELECT v.id, v.voucher_no, v.voucher_type, v.status, v.total_amount, v.narration,
             jl.debit_amount, jl.credit_amount, a.code as account_code, b.id as branch_id, b.name as branch_name
      FROM public.accounting_voucher v
      JOIN public.accounting_journal_entry je ON je.voucher_id = v.id
      JOIN public.accounting_journal_line jl ON jl.journal_entry_id = je.id
      JOIN public.accounting_account a ON a.id = jl.account_id
      LEFT JOIN public.branch b ON b.id = jl.branch_id
      WHERE a.code = '1122'
      ORDER BY v.created_at;
    `);
    baseline.historicalDiscrepancies.cod1122Vouchers = cod1122Vouchers.rows;

    // 8. Inventory & Production tables
    try {
      const invItemsCount = await client.query(`
        SELECT count(*)::int as count,
               COALESCE(SUM(quantity), 0) as total_stock,
               COALESCE(SUM(reserved), 0) as total_reserved
        FROM public.branch_inventory
        WHERE deleted_at IS NULL;
      `);
      baseline.inventoryProduction.branchInventory = invItemsCount.rows[0];
    } catch (e) {
      baseline.inventoryProduction.branchInventory = `Error: ${e.message}`;
    }

    try {
      const invMovementTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name ILIKE '%stock%' OR table_name ILIKE '%inventory%' OR table_name ILIKE '%movement%' OR table_name ILIKE '%batch%' OR table_name ILIKE '%production%')
        ORDER BY table_name;
      `);
      baseline.inventoryProduction.relevantTables = invMovementTables.rows.map(r => r.table_name);
    } catch (e) {
      baseline.inventoryProduction.relevantTables = `Error: ${e.message}`;
    }

    console.log("== Audit Query Pack Executed Successfully ==");
    fs.writeFileSync(path.join(__dirname, "phase0_baseline_report.json"), JSON.stringify(baseline, null, 2));
    console.log("Written baseline data to scratch/phase0_baseline_report.json");

  } finally {
    client.release();
    await pool.end();
  }
}

runAudit().catch(err => {
  console.error("FATAL in audit:", err);
  process.exit(1);
});
