const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env.DATABASE_URL = val;
      return val;
    }
  }
}
const dbUrl = loadEnv();

const { Client } = require('../frontend/node_modules/pg');
const jiti = require(path.resolve(__dirname, '../frontend/node_modules/jiti'))(__filename);
const { ExpensePostingService } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/expense-posting.service.ts'));
const { getDbPool } = jiti(path.resolve(__dirname, '../frontend/src/lib/db.ts'));

// 30-second fail-safe bounded timer
const boundedTimer = setTimeout(() => {
  console.error('\n[FATAL] Concurrency test exceeded 30s timeout guard. Terminating.');
  process.exit(1);
}, 30000);
boundedTimer.unref();

async function runConcurrencyTest() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Cash Overdraft Concurrency-Race Test (Simultaneous Spends)');
  console.log('=============================================================================\n');

  // We use a shared setup transaction that we clean up manually
  const setupClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await setupClient.connect();

  const runId = `conc_${Date.now()}`;
  const testBranchId = `br_${runId}`;

  try {
    console.log('[Setup] Creating test branch and seeding ₹500 float...');
    const sampleBranch = await setupClient.query('SELECT id FROM public.branch LIMIT 1');
    const sourceBranchId = sampleBranch.rows[0].id;

    const bColsRes = await setupClient.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'branch' AND table_schema = 'public' 
      ORDER BY ordinal_position
    `);
    const selectCols = bColsRes.rows.map(r => {
      const c = r.column_name;
      if (c === 'id') return `$1 AS id`;
      if (c === 'name') return `'Test Concurrency Branch' AS name`;
      if (c === 'code') return `$2 AS code`;
      if (c === 'metadata') return `'{"petty_cash_imprest_limit": 5000, "max_drawer_cash_limit": 25000}'::jsonb AS metadata`;
      if (c === 'created_at' || c === 'updated_at') return `NOW() AS ${c}`;
      if (c === 'deleted_at') return `NULL AS deleted_at`;
      return c;
    }).join(', ');

    await setupClient.query(`
      INSERT INTO public.branch (${bColsRes.rows.map(r => r.column_name).join(', ')})
      SELECT ${selectCols}
      FROM public.branch
      WHERE id = $3
      LIMIT 1
    `, [testBranchId, `HB_${runId.slice(-4)}`, sourceBranchId]);

    const acc1114Res = await setupClient.query("SELECT id FROM public.accounting_account WHERE code = '1114'");
    const acc3300Res = await setupClient.query("SELECT id FROM public.accounting_account WHERE code = '3300'");
    const pettyAccId = acc1114Res.rows[0].id;
    const equityOffsetId = acc3300Res.rows[0].id;

    // Seed ₹500 opening float committed for this test
    const obVchId = `vch_ob_${runId}`;
    const jeId = `je_ob_${runId}`;
    await setupClient.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
        total_amount, narration, created_by, approved_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'OPENING_BALANCE', '2026-04-01', 'FY2026-27', $3, 'POSTED',
        500.00, 'Concurrency Test Float', 'maker_user_01', 'supervisor_user_02', 'finance_controller_03', NOW(), NOW(), NOW()
      )
    `, [obVchId, `VCH-OB-${runId}`, testBranchId]);

    await setupClient.query(`
      INSERT INTO public.accounting_journal_entry (
        id, voucher_id, entry_no, entry_date, branch_id, fiscal_year, total_debit, total_credit,
        is_reversed, created_by, created_at
      ) VALUES (
        $1, $2, $3, '2026-04-01', $4, 'FY2026-27', 500.00, 500.00, false, 'finance_controller_03', NOW()
      )
    `, [jeId, obVchId, `JE-OB-${runId}`, testBranchId]);

    await setupClient.query(`
      INSERT INTO public.accounting_journal_line (
        id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
      ) VALUES 
      ($1, $2, 1, $3, 500.00, 0, $5, 'Debit Float'),
      ($4, $2, 2, $6, 0, 500.00, $5, 'Credit Offset')
    `, [`jln_ob1_${runId}`, jeId, pettyAccId, `jln_ob2_${runId}`, testBranchId, equityOffsetId]);

    // Create Expense A (₹350) and Expense B (₹300). Combined ₹650 > ₹500!
    const catRes = await setupClient.query(`SELECT id FROM public.expense_category LIMIT 1`);
    const catId = catRes.rows[0].id;

    async function makeExpense(suffix, amount) {
      const expId = `exp_${suffix}_${runId}`;
      const vchId = `vch_${suffix}_${runId}`;
      await setupClient.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
          reference_type, reference_id, reference_event, total_amount, narration,
          created_by, submitted_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, $2, 'EXPENSE', '2026-10-16', 'FY2026-27', $3, 'APPROVED',
          'EXPENSE', $4, 'PRIMARY', $5, 'Concurrent Expense',
          'maker_user_01', 'maker_user_01', 'checker_supervisor_02', NOW(), NOW()
        )
      `, [vchId, `VCH-${suffix}-${runId}`, testBranchId, expId, amount]);

      await setupClient.query(`
        INSERT INTO public.expense (
          id, expense_date, category_id, branch_id, description,
          subtotal, taxable_value, cgst, sgst, igst, total,
          settlement_type, payment_method, itc_eligibility, status, voucher_id,
          created_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, '2026-10-16', $2, $3, 'Concurrent spend',
          $4, $4, 0, 0, 0, $4,
          'DIRECT_PAYMENT', 'CASH', 'ITC_INELIGIBLE', 'APPROVED', $5,
          'maker_user_01', 'checker_supervisor_02', NOW(), NOW()
        )
      `, [expId, catId, testBranchId, amount, vchId]);

      return expId;
    }

    const expAId = await makeExpense('A', 350);
    const expBId = await makeExpense('B', 300);
    console.log(`  ✓ Created Expense A (₹350): ${expAId}`);
    console.log(`  ✓ Created Expense B (₹300): ${expBId}`);
    console.log('  - Available Float: ₹500.00 | Total Attempted: ₹650.00');

    // Launch BOTH concurrently through separate database clients
    console.log('\n[Concurrency Execution] Disagreeing race launched via separate database connections...');
    const clientA = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const clientB = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await clientA.connect();
    await clientB.connect();

    const [resA, resB] = await Promise.allSettled([
      ExpensePostingService.postExpenseToGL(expAId, 'finance_controller_03', testBranchId),
      ExpensePostingService.postExpenseToGL(expBId, 'finance_controller_03', testBranchId),
    ]);

    await clientA.end();
    await clientB.end();

    console.log(`  - Expense A Result: status=${resA.status}, value=${resA.status === 'fulfilled' ? 'POSTED' : resA.reason?.message}`);
    console.log(`  - Expense B Result: status=${resB.status}, value=${resB.status === 'fulfilled' ? 'POSTED' : resB.reason?.message}`);

    const successes = [resA, resB].filter(r => r.status === 'fulfilled');
    const failures = [resA, resB].filter(r => r.status === 'rejected');

    console.log(`\n[Concurrency Results Audit]`);
    console.log(`  - Successful disbursements: ${successes.length} (Expected: EXACTLY 1)`);
    console.log(`  - Blocked overdrafts:       ${failures.length} (Expected: EXACTLY 1)`);

    if (successes.length !== 1 || failures.length !== 1) {
      throw new Error(`Concurrency race check FAILED: expected 1 success and 1 failure, got ${successes.length} / ${failures.length}`);
    }

    const failedReason = failures[0].reason;
    if (failedReason.code !== 'INSUFFICIENT_CASH_BALANCE') {
      throw new Error(`Unexpected failure code: ${failedReason.code} - ${failedReason.message}`);
    }
    console.log(`  ✓ Failed transaction rejected with INSUFFICIENT_CASH_BALANCE: "${failedReason.message}"`);

    // Verify end balance in GL
    const finalBalRes = await setupClient.query(`
      SELECT COALESCE(SUM(debit_amount - credit_amount), 0)::numeric as bal
      FROM public.accounting_journal_line
      WHERE account_id = $1 AND branch_id = $2
    `, [pettyAccId, testBranchId]);
    const finalBal = Number(finalBalRes.rows[0].bal);
    console.log(`  ✓ Authoritative final GL cash balance: ₹${finalBal.toFixed(2)} (never overdrawn!)`);

    if (finalBal < 0) {
      throw new Error(`CRITICAL: Cash balance was overdrawn to ₹${finalBal}!`);
    }

  } finally {
    console.log('\n[Teardown] Purging concurrency test records...');
    await setupClient.query(`DELETE FROM public.accounting_journal_line WHERE branch_id = $1`, [testBranchId]).catch(() => {});
    await setupClient.query(`DELETE FROM public.accounting_journal_entry WHERE branch_id = $1`, [testBranchId]).catch(() => {});
    await setupClient.query(`DELETE FROM public.expense WHERE branch_id = $1`, [testBranchId]).catch(() => {});
    await setupClient.query(`DELETE FROM public.accounting_voucher WHERE branch_id = $1`, [testBranchId]).catch(() => {});
    await setupClient.query(`DELETE FROM public.branch WHERE id = $1`, [testBranchId]).catch(() => {});
    console.log('  ✓ Cleaned up all concurrency test rows.');
    await setupClient.end().catch(() => {});
    await getDbPool().end().catch(() => {});
  }

  console.log('\n=============================================================================');
  console.log('CONCURRENCY RACE TEST PASSED: CASH OVERDRAFT STRICTLY PREVENTED');
  console.log('=============================================================================');
  process.exit(0);
}

runConcurrencyTest().catch(err => {
  console.error('\nConcurrency test failed:', err);
  process.exit(1);
});
