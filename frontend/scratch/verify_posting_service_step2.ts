/**
 * Phase 4F Step 2 — Independent PostingService Foundation Verification Suite
 *
 * Verifies all 12 required test conditions for the PostingService foundation:
 *  1. unconfigured accounting_start_date blocks posting (ACCOUNTING_START_DATE_NOT_CONFIGURED)
 *  2. zero fiscal periods returns PERIOD_NOT_CONFIGURED and blocks posting (FISCAL_PERIOD_NOT_CONFIGURED)
 *  3. locked period blocks posting (FISCAL_PERIOD_LOCKED)
 *  4. invalid account blocks posting (POSTING_ACCOUNT_INVALID)
 *  5. group account blocks posting (GROUP_ACCOUNT_NOT_POSTABLE)
 *  6. unbalanced journal blocks posting (JOURNAL_UNBALANCED)
 *  7. invalid single-sided journal line blocks posting (JOURNAL_LINE_INVALID)
 *  8. same created_by/approved_by blocks approval (SEGREGATION_OF_DUTIES_VIOLATION)
 *  9. already-posted voucher cannot post again (VOUCHER_ALREADY_POSTED)
 * 10. duplicate source event is rejected/idempotent according to DB semantics (DUPLICATE_SOURCE_EVENT)
 * 11. failed posting rolls back completely (zero partial state)
 * 12. successful test transaction rolls back completely (database counts remain 100% unchanged)
 *
 * CRITICAL SAFETY:
 * - All DB-modifying tests run inside isolated transactions that execute ROLLBACK.
 * - Live counts of vouchers, journals, and fiscal periods MUST remain exactly 0.
 * - accounting_start_date MUST remain UNCONFIGURED.
 */

import * as fs from "fs";
import * as path from "path";

// Ensure DATABASE_URL is set from backend/.env before importing db
if (!process.env.DATABASE_URL && !process.env.PG_URL) {
  const envPath = path.join(__dirname, "../../backend/.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.substring("DATABASE_URL=".length).trim();
        break;
      }
    }
  }
}

import { getDbPool } from "../src/lib/db";
import { PostingService, PostingServiceError } from "../src/lib/services/posting.service";
import { AccountingAccountRepository } from "../src/lib/repositories/accounting-account.repository";
import { AccountingFiscalPeriodRepository } from "../src/lib/repositories/accounting-fiscal-period.repository";
import { AccountingVoucherRepository } from "../src/lib/repositories/accounting-voucher.repository";
import type { PoolClient } from "pg";

interface TestResult {
  testId: number;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function record(testId: number, name: string, passed: boolean, details: string) {
  testResults.push({ testId, name, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] Test ${testId}: ${name} — ${details}`);
}

async function runSuite() {
  const pool = getDbPool();
  console.log("=== PHASE 4F STEP 2: POSTING SERVICE FOUNDATION VERIFICATION ===\n");

  // ── Baseline Count Check ──────────────────────────────────────────────────
  const baselineRes = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM public.accounting_account)         AS accounting_account,
      (SELECT COUNT(*) FROM public.accounting_voucher)         AS accounting_voucher,
      (SELECT COUNT(*) FROM public.accounting_journal_entry)   AS accounting_journal_entry,
      (SELECT COUNT(*) FROM public.accounting_journal_line)    AS accounting_journal_line,
      (SELECT COUNT(*) FROM public.accounting_fiscal_period)   AS accounting_fiscal_period,
      (SELECT COUNT(*) FROM public."order")                    AS orders,
      (SELECT COUNT(*) FROM public.payment_transaction)        AS payment_transaction,
      (SELECT COUNT(*) FROM public.branch_inventory)           AS branch_inventory
  `);
  const baseline = baselineRes.rows[0];
  console.log("Pre-test Baseline Database Counts:");
  console.log(`  accounting_account       = ${baseline.accounting_account}`);
  console.log(`  accounting_voucher       = ${baseline.accounting_voucher}`);
  console.log(`  accounting_journal_entry = ${baseline.accounting_journal_entry}`);
  console.log(`  accounting_journal_line  = ${baseline.accounting_journal_line}`);
  console.log(`  accounting_fiscal_period = ${baseline.accounting_fiscal_period}`);
  console.log(`  orders                   = ${baseline.orders}`);
  console.log(`  payment_transaction      = ${baseline.payment_transaction}`);
  console.log(`  branch_inventory         = ${baseline.branch_inventory}\n`);

  // Obtain sample branch ID and posting account IDs for test harnesses
  const branchRes = await pool.query(`SELECT id FROM public.branch LIMIT 1`);
  const testBranchId = branchRes.rows[0]?.id;
  if (!testBranchId) throw new Error("No branch found in DB for test fixture.");

  const leafAccountsRes = await pool.query(`
    SELECT id, code, name FROM public.accounting_account
    WHERE is_group = false AND is_active = true AND deleted_at IS NULL
    ORDER BY code LIMIT 2
  `);
  if (leafAccountsRes.rows.length < 2) throw new Error("Need at least 2 active posting accounts.");
  const accountA = leafAccountsRes.rows[0].id;
  const accountB = leafAccountsRes.rows[1].id;

  const groupAccountRes = await pool.query(`
    SELECT id, code, name FROM public.accounting_account
    WHERE is_group = true AND deleted_at IS NULL
    LIMIT 1
  `);
  if (groupAccountRes.rows.length === 0) throw new Error("Need at least 1 group account.");
  const groupAccountId = groupAccountRes.rows[0].id;

  // ── TEST 1: Unconfigured accounting_start_date blocks posting ──────────────
  try {
    let errCode = "";
    try {
      await PostingService.validateAccountingStartDate("2026-09-24");
    } catch (err: any) {
      errCode = err?.code || "";
    }
    const passed = errCode === "ACCOUNTING_START_DATE_NOT_CONFIGURED";
    record(
      1,
      "unconfigured accounting_start_date blocks posting",
      passed,
      `validateAccountingStartDate threw code '${errCode}' (expected ACCOUNTING_START_DATE_NOT_CONFIGURED)`
    );
  } catch (err: any) {
    record(1, "unconfigured accounting_start_date blocks posting", false, err.message);
  }

  // ── TEST 2: Zero fiscal periods returns PERIOD_NOT_CONFIGURED ───────────────
  try {
    const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate("2026-09-24");
    let errCode = "";
    try {
      await PostingService.validateFiscalPeriod("2026-09-24");
    } catch (err: any) {
      errCode = err?.code || "";
    }
    const passed =
      periodStatus.status === "PERIOD_NOT_CONFIGURED" &&
      errCode === "FISCAL_PERIOD_NOT_CONFIGURED";
    record(
      2,
      "zero fiscal periods returns PERIOD_NOT_CONFIGURED",
      passed,
      `Repo status='${periodStatus.status}', PostingService error code='${errCode}'`
    );
  } catch (err: any) {
    record(2, "zero fiscal periods returns PERIOD_NOT_CONFIGURED", false, err.message);
  }

  // ── TEST 3: Locked period blocks posting (in isolated rollback txn) ────────
  {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      // Insert a temporary locked fiscal period
      const dummyPeriodId = "00000000-0000-0000-0000-000000000099";
      await client.query(`
        INSERT INTO public.accounting_fiscal_period
          (id, period_name, fiscal_year, start_date, end_date, is_locked)
        VALUES
          ($1, 'TEST-LOCKED-PERIOD', 'FY2627', '2026-04-01', '2027-03-31', true)
      `, [dummyPeriodId]);

      let errCode = "";
      try {
        await PostingService.validateFiscalPeriod("2026-09-24", client);
      } catch (err: any) {
        errCode = err?.code || "";
      }
      const passed = errCode === "FISCAL_PERIOD_LOCKED";
      record(
        3,
        "locked period blocks posting",
        passed,
        `validateFiscalPeriod threw code '${errCode}' (expected FISCAL_PERIOD_LOCKED)`
      );
    } catch (err: any) {
      record(3, "locked period blocks posting", false, err.message);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  // ── TEST 4: Invalid account blocks posting ──────────────────────────────────
  try {
    let errCode = "";
    try {
      await PostingService.validatePostingAccounts(["00000000-0000-0000-0000-000000000000"]);
    } catch (err: any) {
      errCode = err?.code || "";
    }
    const passed = errCode === "POSTING_ACCOUNT_INVALID";
    record(
      4,
      "invalid account blocks posting",
      passed,
      `validatePostingAccounts threw code '${errCode}' (expected POSTING_ACCOUNT_INVALID)`
    );
  } catch (err: any) {
    record(4, "invalid account blocks posting", false, err.message);
  }

  // ── TEST 5: Group account blocks posting ────────────────────────────────────
  try {
    let errCode = "";
    try {
      await PostingService.validatePostingAccounts([groupAccountId]);
    } catch (err: any) {
      errCode = err?.code || "";
    }
    const passed = errCode === "GROUP_ACCOUNT_NOT_POSTABLE";
    record(
      5,
      "group account blocks posting",
      passed,
      `validatePostingAccounts threw code '${errCode}' (expected GROUP_ACCOUNT_NOT_POSTABLE)`
    );
  } catch (err: any) {
    record(5, "group account blocks posting", false, err.message);
  }

  // ── TEST 6: Unbalanced journal blocks posting ───────────────────────────────
  try {
    let unbalCode = "";
    try {
      PostingService.validateJournalLines([
        { account_id: accountA, debit_amount: 100, credit_amount: 0 },
        { account_id: accountB, debit_amount: 0, credit_amount: 80 },
      ]);
    } catch (err: any) {
      unbalCode = err?.code || "";
    }

    let zeroDebitCode = "";
    try {
      PostingService.validateJournalLines([
        { account_id: accountA, debit_amount: 0, credit_amount: 0 },
        { account_id: accountB, debit_amount: 0, credit_amount: 0 },
      ]);
    } catch (err: any) {
      zeroDebitCode = err?.code || "";
    }

    const passed = unbalCode === "JOURNAL_UNBALANCED" && zeroDebitCode === "JOURNAL_LINE_INVALID";
    record(
      6,
      "unbalanced journal blocks posting",
      passed,
      `Unbalanced code='${unbalCode}', zero lines code='${zeroDebitCode}'`
    );
  } catch (err: any) {
    record(6, "unbalanced journal blocks posting", false, err.message);
  }

  // ── TEST 7: Invalid single-sided journal line blocks posting ────────────────
  try {
    let dualSidedCode = "";
    try {
      // Both debit and credit positive on same line
      PostingService.validateJournalLines([
        { account_id: accountA, debit_amount: 100, credit_amount: 50 },
        { account_id: accountB, debit_amount: 0, credit_amount: 50 },
      ]);
    } catch (err: any) {
      dualSidedCode = err?.code || "";
    }

    let negAmountCode = "";
    try {
      // Negative amount
      PostingService.validateJournalLines([
        { account_id: accountA, debit_amount: -100, credit_amount: 0 },
        { account_id: accountB, debit_amount: 0, credit_amount: 100 },
      ]);
    } catch (err: any) {
      negAmountCode = err?.code || "";
    }

    let singleLineCode = "";
    try {
      // Only 1 line
      PostingService.validateJournalLines([
        { account_id: accountA, debit_amount: 100, credit_amount: 0 },
      ]);
    } catch (err: any) {
      singleLineCode = err?.code || "";
    }

    const passed =
      dualSidedCode === "JOURNAL_LINE_INVALID" &&
      negAmountCode === "JOURNAL_LINE_INVALID" &&
      singleLineCode === "JOURNAL_LINE_INVALID";
    record(
      7,
      "invalid single-sided journal line blocks posting",
      passed,
      `Dual-sided='${dualSidedCode}', Negative='${negAmountCode}', Single-line='${singleLineCode}'`
    );
  } catch (err: any) {
    record(7, "invalid single-sided journal line blocks posting", false, err.message);
  }

  // ── TEST 8: Same created_by/approved_by blocks approval (SoD) ───────────────
  {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "JOURNAL",
          voucher_date: "2026-09-24",
          narration: "SoD Test Voucher",
        },
        branchId: testBranchId,
        fiscalYear: "FY2627",
        createdBy: "staff_creator_01",
        client,
      });

      if (!draftRes.success) throw new Error(`Draft creation failed: ${draftRes.error}`);
      const voucherId = draftRes.data.id;

      // Submit
      const submitRes = await PostingService.submitVoucher({
        voucherId,
        submittedBy: "staff_creator_01",
        branchId: testBranchId,
        client,
      });
      if (!submitRes.success) throw new Error(`Submit failed: ${submitRes.error}`);

      // Attempt self-approval by same staff
      const selfApproveRes = await PostingService.approveVoucher({
        voucherId,
        approvedBy: "staff_creator_01", // SAME AS CREATED_BY
        branchId: testBranchId,
        client,
      });

      const sodBlocked =
        !selfApproveRes.success &&
        selfApproveRes.code === "SEGREGATION_OF_DUTIES_VIOLATION";

      // Independent approval by different staff
      const validApproveRes = await PostingService.approveVoucher({
        voucherId,
        approvedBy: "staff_approver_02", // DIFFERENT STAFF
        branchId: testBranchId,
        client,
      });

      const approveAllowed = validApproveRes.success && validApproveRes.data.status === "APPROVED";
      const passed = sodBlocked && approveAllowed;
      record(
        8,
        "same created_by/approved_by blocks approval (SoD)",
        passed,
        `Self-approval blocked code='${selfApproveRes.code}', Different-staff approval success=${approveAllowed}`
      );
    } catch (err: any) {
      record(8, "same created_by/approved_by blocks approval (SoD)", false, err.message);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  // ── TEST 9: Already-posted voucher cannot post again ─────────────────────────
  {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // Temporarily configure start date and open fiscal period inside transaction
      await client.query(`
        INSERT INTO public.setting (id, "group", key, value, is_json, is_secret)
        VALUES ('test_setting_start_date', 'accounting', 'accounting_start_date', '2026-04-01', false, false)
      `);

      const tempPeriodId = "00000000-0000-0000-0000-000000000088";
      await client.query(`
        INSERT INTO public.accounting_fiscal_period
          (id, period_name, fiscal_year, start_date, end_date, is_locked)
        VALUES
          ($1, 'TEST-OPEN-PERIOD', 'FY2627', '2026-04-01', '2027-03-31', false)
      `, [tempPeriodId]);

      // Create draft -> submit -> approve
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "JOURNAL",
          voucher_date: "2026-09-24",
          narration: "Re-posting Test Voucher",
        },
        branchId: testBranchId,
        fiscalYear: "FY2627",
        createdBy: "staff_maker",
        client,
      });
      if (!draftRes.success) throw new Error(draftRes.error);
      const voucherId = draftRes.data.id;

      await PostingService.submitVoucher({
        voucherId,
        submittedBy: "staff_maker",
        branchId: testBranchId,
        client,
      });

      await PostingService.approveVoucher({
        voucherId,
        approvedBy: "staff_checker",
        branchId: testBranchId,
        client,
      });

      const lines = [
        { account_id: accountA, debit_amount: 250, credit_amount: 0 },
        { account_id: accountB, debit_amount: 0, credit_amount: 250 },
      ];

      // First posting -> should succeed in this simulated environment
      const post1 = await PostingService.postVoucher({
        voucherId,
        postedBy: "staff_poster",
        lines,
        branchId: testBranchId,
        client,
      });

      if (!post1.success) throw new Error(`Initial post failed: ${post1.error}`);

      // Second posting attempt -> must fail with VOUCHER_ALREADY_POSTED
      const post2 = await PostingService.postVoucher({
        voucherId,
        postedBy: "staff_poster",
        lines,
        branchId: testBranchId,
        client,
      });

      const passed =
        post1.success &&
        !post2.success &&
        post2.code === "VOUCHER_ALREADY_POSTED";

      record(
        9,
        "already-posted voucher cannot post again",
        passed,
        `First post success=${post1.success}, Second post error code='${post2.code}'`
      );
    } catch (err: any) {
      record(9, "already-posted voucher cannot post again", false, err.message);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  // ── TEST 10: Duplicate source event is rejected/idempotent ──────────────────
  {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const refId = `test-po-${Date.now()}`;

      // First draft with source event
      const draft1 = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "PURCHASE",
          voucher_date: "2026-09-24",
          reference_type: "PURCHASE",
          reference_id: refId,
          reference_event: "PRIMARY",
          narration: "Original Purchase Voucher",
        },
        branchId: testBranchId,
        fiscalYear: "FY2627",
        createdBy: "staff_buyer",
        client,
      });

      if (!draft1.success) throw new Error(draft1.error);

      // Attempt second draft with identical source event
      const draft2 = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "PURCHASE",
          voucher_date: "2026-09-24",
          reference_type: "PURCHASE",
          reference_id: refId,
          reference_event: "PRIMARY",
          narration: "Duplicate Purchase Voucher Attempt",
        },
        branchId: testBranchId,
        fiscalYear: "FY2627",
        createdBy: "staff_buyer",
        client,
      });

      const passed =
        draft1.success &&
        !draft2.success &&
        draft2.code === "DUPLICATE_SOURCE_EVENT";

      record(
        10,
        "duplicate source event is rejected/idempotent according to DB semantics",
        passed,
        `Draft 1 success=${draft1.success}, Draft 2 error code='${draft2.code}'`
      );
    } catch (err: any) {
      record(10, "duplicate source event is rejected/idempotent according to DB semantics", false, err.message);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  // ── TEST 11: Failed posting rolls back completely ───────────────────────────
  {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // Count journals before
      const preCountRes = await client.query(`SELECT COUNT(*) FROM public.accounting_journal_entry`);
      const preCount = parseInt(preCountRes.rows[0].count);

      // Create draft -> submit -> approve
      const draft = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "JOURNAL",
          voucher_date: "2026-09-24",
          narration: "Rollback Test Voucher",
        },
        branchId: testBranchId,
        fiscalYear: "FY2627",
        createdBy: "staff_a",
        client,
      });
      if (!draft.success) throw new Error(draft.error);

      await PostingService.submitVoucher({
        voucherId: draft.data.id,
        submittedBy: "staff_a",
        branchId: testBranchId,
        client,
      });

      await PostingService.approveVoucher({
        voucherId: draft.data.id,
        approvedBy: "staff_b",
        branchId: testBranchId,
        client,
      });

      // Post without accounting_start_date configured -> MUST FAIL AND ROLLBACK
      const postFail = await PostingService.postVoucher({
        voucherId: draft.data.id,
        postedBy: "staff_c",
        lines: [
          { account_id: accountA, debit_amount: 100, credit_amount: 0 },
          { account_id: accountB, debit_amount: 0, credit_amount: 100 },
        ],
        branchId: testBranchId,
        client,
      });

      // Journal entry count inside transaction should still be equal to preCount
      const postCountRes = await client.query(`SELECT COUNT(*) FROM public.accounting_journal_entry`);
      const postCount = parseInt(postCountRes.rows[0].count);

      const passed =
        !postFail.success &&
        postFail.code === "ACCOUNTING_START_DATE_NOT_CONFIGURED" &&
        preCount === postCount;

      record(
        11,
        "failed posting rolls back completely",
        passed,
        `Post failed with '${postFail.code}', journal count unchanged (${preCount} -> ${postCount})`
      );
    } catch (err: any) {
      record(11, "failed posting rolls back completely", false, err.message);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  // ── TEST 12: Successful test transaction rolls back completely ──────────────
  {
    // Verify that all live DB counts outside the transaction remain 100% untouched
    const postSuiteRes = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account)         AS accounting_account,
        (SELECT COUNT(*) FROM public.accounting_voucher)         AS accounting_voucher,
        (SELECT COUNT(*) FROM public.accounting_journal_entry)   AS accounting_journal_entry,
        (SELECT COUNT(*) FROM public.accounting_journal_line)    AS accounting_journal_line,
        (SELECT COUNT(*) FROM public.accounting_fiscal_period)   AS accounting_fiscal_period,
        (SELECT COUNT(*) FROM public."order")                    AS orders,
        (SELECT COUNT(*) FROM public.payment_transaction)        AS payment_transaction,
        (SELECT COUNT(*) FROM public.branch_inventory)           AS branch_inventory
    `);
    const after = postSuiteRes.rows[0];

    const countsUnchanged =
      parseInt(after.accounting_account) === 98 &&
      parseInt(after.accounting_voucher) === 0 &&
      parseInt(after.accounting_journal_entry) === 0 &&
      parseInt(after.accounting_journal_line) === 0 &&
      parseInt(after.accounting_fiscal_period) === 0 &&
      parseInt(after.orders) === 173 &&
      parseInt(after.payment_transaction) === 53 &&
      parseInt(after.branch_inventory) === 424;

    const startDateSetting = await pool.query(`
      SELECT value FROM public.setting
      WHERE key = 'accounting_start_date' AND deleted_at IS NULL
    `);
    const startDateUnconfigured = startDateSetting.rows.length === 0;

    const passed = countsUnchanged && startDateUnconfigured;
    record(
      12,
      "successful test transaction rolls back completely",
      passed,
      `vouchers=${after.accounting_voucher}, journals=${after.accounting_journal_entry}, lines=${after.accounting_journal_line}, periods=${after.accounting_fiscal_period}, start_date unconfigured=${startDateUnconfigured}`
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== TEST SUITE SUMMARY ===");
  const allPassed = testResults.every((r) => r.passed);
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed:      ${testResults.filter((r) => r.passed).length}`);
  console.log(`Failed:      ${testResults.filter((r) => !r.passed).length}`);
  console.log(`Verdict:     ${allPassed ? "ALL 12/12 TESTS PASSED" : "SOME TESTS FAILED"}\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runSuite()
  .catch((err) => {
    console.error("Fatal error running test suite:", err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const pool = getDbPool();
      await pool.end();
    } catch {}
  });
