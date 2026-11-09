/**
 * CakeToHome ERP — Independent PostgreSQL Accounting Verification Query Pack
 * 
 * Executes read-only queries for the 10 mandated metrics:
 * 1. Global posted GL Cash in Hand (1111)
 * 2. Operational-branch posted GL Cash in Hand
 * 3. Test-branch GL balances
 * 4. Branch petty cash (1114)
 * 5. Undeposited COD / clearing (1122)
 * 6. Active drawer custody
 * 7. Closed-session cash awaiting disposition
 * 8. Vault custody
 * 9. Total physical custody
 * 10. Branch-by-branch reconciliation variance
 */

const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const jiti = require(path.resolve(__dirname, '../frontend/node_modules/jiti'))(__filename);

const { BranchCashService } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/branch-cash.service.ts'));

function loadEnv() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}
const dbUrl = loadEnv();

async function runReconciliation() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cutoff = new Date().toISOString();
  console.log('=============================================================================');
  console.log(`CakeToHome ERP — Independent PostgreSQL Accounting Verification Report`);
  console.log(`Cutoff Timestamp: ${cutoff}`);
  console.log('=============================================================================\n');

  const report = { cutoff, metrics: {} };

  // ── Metric 1: Global Posted GL Cash in Hand (1111) ────────────────────────
  console.log('--- 1. Global Posted GL Cash in Hand (1111) ---');
  const q1 = `
    SELECT 
      a.code as account_code,
      a.name as account_name,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric(15,2) as net_balance
    FROM public.accounting_account a
    JOIN public.accounting_journal_line jl ON jl.account_id = a.id
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id
    WHERE a.code = '1111'
      AND v.status = 'POSTED'
      AND v.deleted_at IS NULL
    GROUP BY a.code, a.name;
  `;
  const res1 = await client.query(q1);
  console.table(res1.rows);
  report.metrics.global_gl_cash_1111 = res1.rows[0]?.net_balance || '0.00';

  // ── Metric 2: Operational-Branch Posted GL Cash in Hand ───────────────────
  console.log('\n--- 2. Operational-Branch Posted GL Cash in Hand (1111) ---');
  const q2 = `
    SELECT 
      b.id as branch_id,
      b.name as branch_name,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric(15,2) as net_balance
    FROM public.branch b
    JOIN public.accounting_journal_line jl ON jl.branch_id = b.id
    JOIN public.accounting_account a ON a.id = jl.account_id AND a.code = '1111'
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE b.deleted_at IS NULL
      AND b.id NOT LIKE 'br_tc_%'
      AND b.id NOT LIKE 'br_conc_%'
      AND b.id NOT LIKE 'br_test_%'
      AND b.id NOT LIKE 'test_%'
    GROUP BY b.id, b.name
    ORDER BY b.name;
  `;
  const res2 = await client.query(q2);
  console.table(res2.rows);
  const totalOperationalGl = res2.rows.reduce((sum, r) => sum + Number(r.net_balance), 0);
  console.log(`Total Operational GL 1111: ₹${totalOperationalGl.toFixed(2)}`);
  report.metrics.operational_branches_gl_1111 = {
    branches: res2.rows,
    total: totalOperationalGl.toFixed(2)
  };

  // ── Metric 3: Test-Branch GL Balances ─────────────────────────────────────
  console.log('\n--- 3. Test-Branch & Soft-Deleted GL Balances (1111) ---');
  const q3 = `
    SELECT 
      b.id as branch_id,
      b.name as branch_name,
      b.deleted_at IS NOT NULL as is_soft_deleted,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric(15,2) as net_balance
    FROM public.branch b
    JOIN public.accounting_journal_line jl ON jl.branch_id = b.id
    JOIN public.accounting_account a ON a.id = jl.account_id AND a.code = '1111'
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE b.deleted_at IS NOT NULL
       OR b.id LIKE 'br_tc_%'
       OR b.id LIKE 'br_conc_%'
       OR b.id LIKE 'br_test_%'
       OR b.id LIKE 'test_%'
    GROUP BY b.id, b.name, b.deleted_at
    ORDER BY b.id;
  `;
  const res3 = await client.query(q3);
  console.table(res3.rows);
  const totalTestGl = res3.rows.reduce((sum, r) => sum + Number(r.net_balance), 0);
  console.log(`Total Test & Soft-Deleted Branch GL 1111: ₹${totalTestGl.toFixed(2)}`);
  report.metrics.test_branches_gl_1111 = {
    branches: res3.rows,
    total: totalTestGl.toFixed(2)
  };

  // Proof of mathematical reconciliation: Global = Operational + Test
  const reconciledGlobal = (totalOperationalGl + totalTestGl).toFixed(2);
  console.log(`\nReconciliation Check: Operational (₹${totalOperationalGl.toFixed(2)}) + Test (₹${totalTestGl.toFixed(2)}) = ₹${reconciledGlobal}`);
  console.log(`Matches Metric 1 Global (₹${res1.rows[0]?.net_balance}): ${reconciledGlobal === String(res1.rows[0]?.net_balance)}`);

  // ── Metric 4: Branch Petty Cash (1114) ───────────────────────────────────
  console.log('\n--- 4. Operational Branch Petty Cash (1114) ---');
  const q4 = `
    SELECT 
      b.id as branch_id,
      b.name as branch_name,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric(15,2) as net_petty_cash
    FROM public.branch b
    JOIN public.accounting_journal_line jl ON jl.branch_id = b.id
    JOIN public.accounting_account a ON a.id = jl.account_id AND a.code = '1114'
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE b.deleted_at IS NULL
      AND b.id NOT LIKE 'br_tc_%'
      AND b.id NOT LIKE 'br_conc_%'
    GROUP BY b.id, b.name
    ORDER BY b.name;
  `;
  const res4 = await client.query(q4);
  console.table(res4.rows);
  report.metrics.petty_cash_1114 = res4.rows;

  // ── Metric 5: Undeposited COD / Clearing (1122) ──────────────────────────
  console.log('\n--- 5. Operational Undeposited COD / Clearing (1122) ---');
  const q5 = `
    SELECT 
      b.id as branch_id,
      b.name as branch_name,
      COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric(15,2) as net_undeposited_cod
    FROM public.branch b
    JOIN public.accounting_journal_line jl ON jl.branch_id = b.id
    JOIN public.accounting_account a ON a.id = jl.account_id AND a.code = '1122'
    JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    JOIN public.accounting_voucher v ON v.id = je.voucher_id AND v.status = 'POSTED' AND v.deleted_at IS NULL
    WHERE b.deleted_at IS NULL
      AND b.id NOT LIKE 'br_tc_%'
      AND b.id NOT LIKE 'br_conc_%'
    GROUP BY b.id, b.name
    ORDER BY b.name;
  `;
  const res5 = await client.query(q5);
  console.table(res5.rows);
  report.metrics.undeposited_cod_1122 = res5.rows;

  // ── Metric 6: Active Drawer Custody ──────────────────────────────────────
  console.log('\n--- 6. Active Drawer Custody (Open Sessions) ---');
  const q6 = `
    SELECT 
      ts.branch_id,
      b.name as branch_name,
      s.id as session_id,
      s.teller_id,
      s.opening_float,
      COALESCE(SUM(CASE WHEN tm.direction = 'IN' THEN tm.amount ELSE -tm.amount END), 0)::numeric(15,2) as net_movements,
      (s.opening_float + COALESCE(SUM(CASE WHEN tm.direction = 'IN' THEN tm.amount ELSE -tm.amount END), 0))::numeric(15,2) as expected_drawer_cash
    FROM public.teller_session s
    JOIN public.teller ts ON ts.id = s.teller_id
    JOIN public.branch b ON b.id = ts.branch_id
    LEFT JOIN public.teller_movement tm ON tm.teller_session_id = s.id
    WHERE s.status = 'OPEN'
      AND b.deleted_at IS NULL
      AND b.id NOT LIKE 'br_tc_%'
      AND b.id NOT LIKE 'br_conc_%'
    GROUP BY ts.branch_id, b.name, s.id, s.teller_id, s.opening_float
    ORDER BY b.name;
  `;
  const res6 = await client.query(q6);
  console.table(res6.rows);
  report.metrics.active_drawer_custody = res6.rows;

  // ── Metric 7: Closed-Session Cash Awaiting Disposition ────────────────────
  console.log('\n--- 7. Closed-Session Cash Awaiting Disposition ---');
  const q7 = `
    SELECT 
      ts.branch_id,
      b.name as branch_name,
      s.id as session_id,
      s.teller_id,
      s.status,
      s.closing_count::numeric(15,2) as closing_count,
      s.variance::numeric(15,2) as variance,
      s.closed_at,
      s.settled_at
    FROM public.teller_session s
    JOIN public.teller ts ON ts.id = s.teller_id
    JOIN public.branch b ON b.id = ts.branch_id
    WHERE s.status IN ('CLOSING', 'PENDING_VERIFICATION', 'SETTLED')
      AND b.deleted_at IS NULL
      AND b.id NOT LIKE 'br_tc_%'
      AND b.id NOT LIKE 'br_conc_%'
      AND ts.id NOT IN (SELECT teller_id FROM public.teller_session WHERE status = 'OPEN')
    ORDER BY ts.branch_id, s.created_at DESC;
  `;
  const res7 = await client.query(q7);
  console.table(res7.rows);
  report.metrics.closed_sessions_awaiting_disposition = res7.rows;

  // ── Metric 8: Vault Custody ──────────────────────────────────────────────
  console.log('\n--- 8. Operational Vault Custody ---');
  const q8 = `
    SELECT 
      b.id as branch_id,
      b.name as branch_name,
      COALESCE(SUM(CASE WHEN vm.direction = 'IN' THEN vm.amount ELSE -vm.amount END), 0)::numeric(15,2) as vault_cash
    FROM public.branch b
    LEFT JOIN public.branch_vault_movement vm ON vm.branch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.id NOT LIKE 'br_tc_%'
      AND b.id NOT LIKE 'br_conc_%'
    GROUP BY b.id, b.name
    ORDER BY b.name;
  `;
  const res8 = await client.query(q8);
  const activeVaults = res8.rows.filter(r => Number(r.vault_cash) !== 0);
  console.table(activeVaults.length > 0 ? activeVaults : [{ status: 'No active non-zero operational vaults' }]);
  report.metrics.vault_custody = res8.rows;

  // ── Metrics 9 & 10: Canonical Service Reconciliation & Variance ───────────
  console.log('\n--- 9 & 10. Canonical Service Branch Cash Reconciliation & Variance ---');
  const serviceSummary = await BranchCashService.getBranchCashSummary({}, client);
  const nonZeroBranches = serviceSummary.branches.filter(b => b.gl_cash_in_hand !== 0 || b.total_physical_cash !== 0 || b.variance !== 0);
  
  console.table(nonZeroBranches.map(b => ({
    branch_id: b.branch_id,
    branch_name: b.branch_name,
    gl_cash_in_hand: b.gl_cash_in_hand,
    active_drawer_cash: b.active_drawer_cash,
    closed_sessions_cash: b.closed_sessions_cash,
    vault_cash: b.vault_cash,
    total_physical_cash: b.total_physical_cash,
    variance: b.variance,
    status: b.reconciliation_status,
  })));

  report.metrics.service_summary = {
    total_gl_cash_in_hand: serviceSummary.total_gl_cash_in_hand,
    total_active_drawer_cash: serviceSummary.total_active_drawer_cash,
    total_closed_sessions_cash: serviceSummary.total_closed_sessions_cash,
    total_vault_cash: serviceSummary.total_vault_cash,
    total_physical_cash: serviceSummary.total_physical_cash,
    branches_reported: serviceSummary.branches.length,
    active_branches: nonZeroBranches
  };

  fs.writeFileSync(
    path.join(__dirname, 'independent_reconciliation_pack.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n[SUCCESS] Independent PostgreSQL Reconciliation Query Pack generated successfully.');
  await client.end();
}

runReconciliation().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});
