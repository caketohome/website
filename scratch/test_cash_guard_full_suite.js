const fs = require('fs');
const path = require('path');

// Populate DATABASE_URL before importing any services
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
const { ExpensePostingService, ExpensePostingError } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/expense-posting.service.ts'));
const { getDbPool } = jiti(path.resolve(__dirname, '../frontend/src/lib/db.ts'));

// 30-second bounded timeout guard
const boundedTimer = setTimeout(() => {
  console.error('\n[FATAL] Full suite exceeded 30s timeout guard. Terminating.');
  process.exit(1);
}, 30000);
boundedTimer.unref();

async function runSuite() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Concurrency-Safe Cash Overdraft Guard Integration Suite');
  console.log('PostgreSQL Target: aws-1-ap-south-1.pooler.supabase.com:6543/postgres');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const verifyClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await verifyClient.connect();

  const testRunId = `cguard_${Date.now()}`;
  console.log(`[Suite Init] Test run identifier: ${testRunId}`);

  try {
    await client.query('BEGIN');

    // 0. Setup test master records
    console.log('[Setup] Resolving canonical GL accounts...');
    const acc1114Res = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '1114'");
    const acc1111Res = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '1111'");
    const acc1112Res = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '1112'");
    const acc3300Res = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '3300'");
    const acc5230Res = await client.query("SELECT id, code, name FROM public.accounting_account WHERE code = '5230'");

    const pettyAccId = acc1114Res.rows[0].id;
    const cashAccId = acc1111Res.rows[0].id;
    const bankAccId = acc1112Res.rows[0].id;
    const equityOffsetId = acc3300Res.rows[0].id;
    const expenseGlId = acc5230Res.rows[0].id;

    console.log(`  ✓ 1114 Petty Cash: ${pettyAccId}`);
    console.log(`  ✓ 1111 Cash in Hand: ${cashAccId}`);
    console.log(`  ✓ 1112 Bank Operating: ${bankAccId}`);

    // Dynamic clone of branch row
    const sampleBranch = await client.query('SELECT id FROM public.branch LIMIT 1');
    const sourceBranchId = sampleBranch.rows[0].id;
    const testBranchId = `br_${testRunId}`;

    const bColsRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'branch' AND table_schema = 'public' 
      ORDER BY ordinal_position
    `);
    const selectCols = bColsRes.rows.map(r => {
      const c = r.column_name;
      if (c === 'id') return `$1 AS id`;
      if (c === 'name') return `'Test Cash Guard Hub' AS name`;
      if (c === 'code') return `$2 AS code`;
      if (c === 'metadata') return `'{"petty_cash_imprest_limit": 5000, "max_drawer_cash_limit": 25000}'::jsonb AS metadata`;
      if (c === 'created_at' || c === 'updated_at') return `NOW() AS ${c}`;
      if (c === 'deleted_at') return `NULL AS deleted_at`;
      return c;
    }).join(', ');

    await client.query(`
      INSERT INTO public.branch (${bColsRes.rows.map(r => r.column_name).join(', ')})
      SELECT ${selectCols}
      FROM public.branch
      WHERE id = $3
      LIMIT 1
    `, [testBranchId, `HUB_${testRunId.slice(-4)}`, sourceBranchId]);
    console.log(`  ✓ Created isolated test branch: ${testBranchId}`);

    // Resolve test expense category
    const catRes = await client.query(`SELECT id, gl_account_id, gl_account_code FROM public.expense_category LIMIT 1`);
    const testCatId = catRes.rows[0]?.id || `cat_${testRunId}`;
    console.log(`  ✓ Resolved active expense category: ${testCatId}`);

    // Helper: Create approved expense record
    async function createApprovedExpense(opts) {
      const expId = `exp_${opts.suffix}_${testRunId}`;
      const vchId = `vch_${opts.suffix}_${testRunId}`;
      const vchNo = `VCH-TEST-${opts.suffix.toUpperCase()}-${Date.now()}`;

      // Insert voucher draft/approved
      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
          reference_type, reference_id, reference_event, total_amount, narration,
          created_by, submitted_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, $2, 'EXPENSE', '2026-10-16', 'FY2026-27', $3, 'APPROVED',
          'EXPENSE', $4, 'PRIMARY', $5, $6,
          'maker_user_01', 'maker_user_01', 'checker_supervisor_02', NOW(), NOW()
        )
      `, [vchId, vchNo, testBranchId, expId, opts.total, opts.description]);

      await client.query(`
        INSERT INTO public.expense (
          id, expense_date, category_id, branch_id, description,
          subtotal, taxable_value, cgst, sgst, igst, total,
          settlement_type, payment_method, teller_session_id, bank_account_id,
          itc_eligibility, status, voucher_id,
          created_by, approved_by, created_at, updated_at
        ) VALUES (
          $1, '2026-10-16', $2, $3, $4,
          $5, $5, 0, 0, 0, $5,
          $6, $7, $8, $9,
          'ITC_INELIGIBLE', 'APPROVED', $10,
          'maker_user_01', 'checker_supervisor_02', NOW(), NOW()
        )
      `, [
        expId, testCatId, testBranchId, opts.description,
        opts.total, opts.settlement_type || 'DIRECT_PAYMENT', opts.payment_method || 'CASH',
        opts.teller_session_id || null, opts.bank_account_id || null, vchId
      ]);

      return { expId, vchId };
    }

    // Helper: Seed GL opening balance for branch
    async function seedGlBranchFloat(accountId, amount) {
      const obVchId = `vch_ob_${Date.now()}`;
      const obVchNo = `VCH-OB-${Date.now()}`;
      const jeId = `je_ob_${Date.now()}`;

      await client.query(`
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, fiscal_year, branch_id, status,
          total_amount, narration, created_by, approved_by, posted_by, posted_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'OPENING_BALANCE', '2026-04-01', 'FY2026-27', $3, 'POSTED',
          $4, 'Authorized Branch Opening Float', 'maker_user_01', 'supervisor_user_02', 'finance_controller_03', NOW(), NOW(), NOW()
        )
      `, [obVchId, obVchNo, testBranchId, amount]);

      await client.query(`
        INSERT INTO public.accounting_journal_entry (
          id, voucher_id, entry_no, entry_date, branch_id, fiscal_year, total_debit, total_credit,
          is_reversed, created_by, created_at
        ) VALUES (
          $1, $2, $3, '2026-04-01', $4, 'FY2026-27', $5, $5, false, 'finance_controller_03', NOW()
        )
      `, [jeId, obVchId, `JE-OB-${Date.now()}`, testBranchId, amount]);

      // Dr Cash Account, Cr 3300 Equity Offset
      await client.query(`
        INSERT INTO public.accounting_journal_line (
          id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
        ) VALUES 
        ($1, $2, 1, $3, $4, 0, $5, 'Debit Float'),
        ($6, $2, 2, $7, 0, $4, $5, 'Credit Offset')
      `, [`jln_ob_1_${Date.now()}`, jeId, accountId, amount, testBranchId, `jln_ob_2_${Date.now()}`, equityOffsetId]);

      console.log(`  ✓ Seeded GL Opening Float of ₹${amount} on account ${accountId} for branch ${testBranchId}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: DIRECT CASH PAYMENT WITH NO VALID OPENING FLOAT (MUST FAIL)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 1] Testing direct cash payment with NO valid opening float...');
    const exp1 = await createApprovedExpense({
      suffix: 'no_float',
      total: 500,
      description: 'Tea & Refreshments - Unfunded Branch',
      payment_method: 'CASH',
    });

    let test1Passed = false;
    try {
      await ExpensePostingService.postExpenseToGL(exp1.expId, 'finance_controller_03', testBranchId, client);
    } catch (err) {
      if (err.code === 'NO_AUTHORIZED_CASH_FLOAT') {
        test1Passed = true;
        console.log(`  ✓ Correctly rejected with NO_AUTHORIZED_CASH_FLOAT: "${err.message}"`);
      } else {
        throw new Error(`Unexpected error code: ${err.code} - ${err.message}`);
      }
    }

    if (!test1Passed) {
      throw new Error('Test 1 FAILED: Cash payment with no opening float was permitted!');
    }

    // Verify PostgreSQL state for Test 1
    const t1ExpCheck = await client.query('SELECT status FROM public.expense WHERE id = $1', [exp1.expId]);
    if (t1ExpCheck.rows[0].status !== 'APPROVED') {
      throw new Error(`Test 1 FAILED: Expense status mutated to '${t1ExpCheck.rows[0].status}' despite failure!`);
    }
    const t1VchCheck = await client.query('SELECT status FROM public.accounting_voucher WHERE id = $1', [exp1.vchId]);
    if (t1VchCheck.rows[0].status !== 'APPROVED') {
      throw new Error(`Test 1 FAILED: Voucher status mutated to '${t1VchCheck.rows[0].status}'!`);
    }
    const t1JlCheck = await client.query(`
      SELECT COUNT(*) as count FROM public.accounting_journal_line WHERE metadata->>'expense_id' = $1
    `, [exp1.expId]);
    if (Number(t1JlCheck.rows[0].count) !== 0) {
      throw new Error(`Test 1 FAILED: Orphan journal lines were persisted (${t1JlCheck.rows[0].count})!`);
    }
    console.log('  ✓ PostgreSQL integrity verified: zero partial vouchers or journal lines persisted.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: SEED FLOAT & TEST INSUFFICIENT FUNDS (MUST FAIL)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 2] Seeding float of ₹500 and testing expense of ₹600 (insufficient funds)...');
    await seedGlBranchFloat(pettyAccId, 500);

    const exp2 = await createApprovedExpense({
      suffix: 'overdraft_attempt',
      total: 600,
      description: 'Printer Cartridge exceeding cash float',
      payment_method: 'CASH',
    });

    let test2Passed = false;
    try {
      await ExpensePostingService.postExpenseToGL(exp2.expId, 'finance_controller_03', testBranchId, client);
    } catch (err) {
      if (err.code === 'INSUFFICIENT_CASH_BALANCE') {
        test2Passed = true;
        console.log(`  ✓ Correctly rejected with INSUFFICIENT_CASH_BALANCE: "${err.message}"`);
      } else {
        throw new Error(`Unexpected error code: ${err.code} - ${err.message}`);
      }
    }

    if (!test2Passed) {
      throw new Error('Test 2 FAILED: Expense exceeding cash balance was allowed to post!');
    }

    // Verify balance is still ₹500 and not negative
    const balCheck2 = await client.query(`
      SELECT COALESCE(SUM(debit_amount - credit_amount), 0)::numeric as bal
      FROM public.accounting_journal_line
      WHERE account_id = $1 AND branch_id = $2
    `, [pettyAccId, testBranchId]);
    const currentBal2 = Number(balCheck2.rows[0].bal);
    console.log(`  ✓ Verified book cash balance remains positive: ₹${currentBal2.toFixed(2)} (expected: 500.00)`);
    if (currentBal2 !== 500) {
      throw new Error(`Test 2 balance corrupt: expected 500, got ${currentBal2}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: SUFFICIENT FUNDS DISBURSEMENT (MUST SUCCEED)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 3] Testing valid cash expense of ₹300 against available ₹500 float (MUST SUCCEED)...');
    const exp3 = await createApprovedExpense({
      suffix: 'valid_cash',
      total: 300,
      description: 'Store Cleaning Supplies',
      payment_method: 'CASH',
    });

    const post3Res = await ExpensePostingService.postExpenseToGL(exp3.expId, 'finance_controller_03', testBranchId, client);
    console.log(`  ✓ Successfully posted expense: ${post3Res.expense.id} (status: ${post3Res.expense.status})`);
    console.log(`  ✓ Journal entry created: ${post3Res.journal_entry.entry_no}`);

    // Verify in PostgreSQL
    const balCheck3 = await client.query(`
      SELECT COALESCE(SUM(debit_amount - credit_amount), 0)::numeric as bal
      FROM public.accounting_journal_line
      WHERE account_id = $1 AND branch_id = $2
    `, [pettyAccId, testBranchId]);
    const currentBal3 = Number(balCheck3.rows[0].bal);
    console.log(`  ✓ Authoritative GL cash balance after ₹300 disbursement: ₹${currentBal3.toFixed(2)} (expected: 200.00)`);
    if (currentBal3 !== 200) {
      throw new Error(`Test 3 FAILED: expected 200, got ${currentBal3}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: DUPLICATE RETRY PREVENTION (MUST FAIL)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 4] Testing duplicate retry on already posted expense (MUST BE REJECTED)...');
    let test4Passed = false;
    try {
      await ExpensePostingService.postExpenseToGL(exp3.expId, 'finance_controller_03', testBranchId, client);
    } catch (err) {
      if (err.code === 'EXPENSE_ALREADY_POSTED') {
        test4Passed = true;
        console.log(`  ✓ Correctly rejected duplicate posting: "${err.message}"`);
      } else {
        throw new Error(`Unexpected error code: ${err.code} - ${err.message}`);
      }
    }
    if (!test4Passed) throw new Error('Test 4 FAILED: Duplicate posting was permitted!');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: VALID BANK PAYMENT WITHOUT CASH SESSION (MUST SUCCEED)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 5] Testing valid bank payment of ₹1,500 with no cash drawer (MUST SUCCEED)...');
    const exp5 = await createApprovedExpense({
      suffix: 'bank_transfer',
      total: 1500,
      description: 'Monthly Cloud Infrastructure Hosting',
      payment_method: 'BANK_TRANSFER',
    });

    const post5Res = await ExpensePostingService.postExpenseToGL(exp5.expId, 'finance_controller_03', testBranchId, client);
    console.log(`  ✓ Bank payment posted successfully: ${post5Res.expense.id}`);
    console.log(`  ✓ Voucher: ${post5Res.voucher.voucher_no}`);

    // Verify cash account 1114 balance was NOT touched
    const balCheck5 = await client.query(`
      SELECT COALESCE(SUM(debit_amount - credit_amount), 0)::numeric as bal
      FROM public.accounting_journal_line
      WHERE account_id = $1 AND branch_id = $2
    `, [pettyAccId, testBranchId]);
    const currentBal5 = Number(balCheck5.rows[0].bal);
    console.log(`  ✓ Petty cash balance remains untouched at: ₹${currentBal5.toFixed(2)} (expected: 200.00)`);
    if (currentBal5 !== 200) throw new Error('Bank payment mutated cash balance!');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: RETAIL TELLER DRAWER SESSION TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Test 6] Testing retail teller drawer session overdraft guards...');
    
    const uRes = await client.query('SELECT id FROM public."user" LIMIT 1');
    const validUserId = uRes.rows[0]?.id || 'usr_01';

    // Create teller station
    const tellerId = `tel_${testRunId}`;
    await client.query(`
      INSERT INTO public.teller (id, branch_id, user_id, name, code, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'Counter 1', $4, 'ACTIVE', NOW(), NOW())
    `, [tellerId, testBranchId, validUserId, `T1_${testRunId.slice(-4)}`]);

    // Open teller session with opening_float = 400
    const sessionId = `sess_${testRunId}`;
    await client.query(`
      INSERT INTO public.teller_session (
        id, teller_id, branch_id, status, opening_float, expected_cash, opened_by, opened_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'OPEN', 400.00, 400.00, $4, NOW(), NOW(), NOW()
      )
    `, [sessionId, tellerId, testBranchId, validUserId]);
    console.log(`  ✓ Opened teller session: ${sessionId} with opening_float = ₹400.00`);

    // Subtest 6A: Expense of ₹450 exceeds drawer balance of ₹400 (MUST FAIL)
    console.log('  - Subtest 6A: Attempting drawer disbursement of ₹450 (available: ₹400)...');
    const exp6A = await createApprovedExpense({
      suffix: 'drawer_overdraft',
      total: 450,
      description: 'Emergency Electrical Repair',
      payment_method: 'CASH',
      teller_session_id: sessionId,
    });

    let test6APassed = false;
    try {
      await ExpensePostingService.postExpenseToGL(exp6A.expId, 'finance_controller_03', testBranchId, client);
    } catch (err) {
      if (err.code === 'INSUFFICIENT_CASH_DRAWER_BALANCE') {
        test6APassed = true;
        console.log(`    ✓ Correctly rejected: "${err.message}"`);
      } else {
        throw new Error(`Unexpected error code: ${err.code} - ${err.message}`);
      }
    }
    if (!test6APassed) throw new Error('Subtest 6A FAILED: Drawer overdraft was allowed!');

    // Subtest 6B: Expense of ₹150 within drawer balance of ₹400 (MUST SUCCEED)
    console.log('  - Subtest 6B: Attempting drawer disbursement of ₹150 (available: ₹400)...');
    const exp6B = await createApprovedExpense({
      suffix: 'drawer_valid',
      total: 150,
      description: 'Store Packaging Bags',
      payment_method: 'CASH',
      teller_session_id: sessionId,
    });

    const post6BRes = await ExpensePostingService.postExpenseToGL(exp6B.expId, 'finance_controller_03', testBranchId, client);
    console.log(`    ✓ Successfully posted drawer expense: ${post6BRes.expense.id}`);

    // Verify teller movement was projected in C4 ledger
    const movCheck = await client.query(`
      SELECT * FROM public.teller_movement WHERE teller_session_id = $1 AND source_id = $2
    `, [sessionId, exp6B.expId]);
    if (movCheck.rows.length !== 1) throw new Error('Teller movement was not projected!');
    console.log(`    ✓ Persisted teller movement: ${movCheck.rows[0].direction} ₹${movCheck.rows[0].amount} (${movCheck.rows[0].movement_type})`);

    // ─────────────────────────────────────────────────────────────────────────
    // ROLLBACK & ISOLATION AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Rollback & Isolation Audit] Rolling back all test writes...');
    await client.query('ROLLBACK');
    console.log('  ✓ Transaction rolled back successfully.');

    // Verify independent database state
    const leakedExpenses = await verifyClient.query(`SELECT COUNT(*) as count FROM public.expense WHERE id LIKE '%${testRunId}%'`);
    const leakedVouchers = await verifyClient.query(`SELECT COUNT(*) as count FROM public.accounting_voucher WHERE id LIKE '%${testRunId}%'`);
    const leakedBranches = await verifyClient.query(`SELECT COUNT(*) as count FROM public.branch WHERE id = $1`, [testBranchId]);
    const leakedSessions = await verifyClient.query(`SELECT COUNT(*) as count FROM public.teller_session WHERE id = $1`, [sessionId]);

    console.log('\n[Verification via Independent PostgreSQL Client]');
    console.log(`  - Leaked test expenses:  ${leakedExpenses.rows[0].count} (expected: 0)`);
    console.log(`  - Leaked test vouchers:  ${leakedVouchers.rows[0].count} (expected: 0)`);
    console.log(`  - Leaked test branches:  ${leakedBranches.rows[0].count} (expected: 0)`);
    console.log(`  - Leaked test sessions:  ${leakedSessions.rows[0].count} (expected: 0)`);

    if (
      Number(leakedExpenses.rows[0].count) !== 0 ||
      Number(leakedVouchers.rows[0].count) !== 0 ||
      Number(leakedBranches.rows[0].count) !== 0 ||
      Number(leakedSessions.rows[0].count) !== 0
    ) {
      throw new Error('FATAL: Test records leaked into shared database!');
    }

    console.log('\n=============================================================================');
    console.log('ALL CASH OVERDRAFT GUARD INTEGRATION TESTS PASSED (ZERO SHARED DB POLLUTION)');
    console.log('=============================================================================');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
    await verifyClient.end().catch(() => {});
    await getDbPool().end().catch(() => {});
  }

  process.exit(0);
}

runSuite().catch(err => {
  console.error('\nSuite Failed:', err);
  process.exit(1);
});
