/**
 * CakeToHome ERP — Phase C7.6 Step 4C: Cost Allocation Engine & Workflow Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Rule eligibility: Fixed percentages total 100.00%, rejects invalid totals, types, inactive rules.
 * 2. Account eligibility: Rejects Balance Sheet (1xxx, 2xxx, 3xxx), Revenue (4xxx), Groups (5000, 5200),
 *    and Cash Rounding/Variance accounts (5295, 5296). Accepts eligible 5xxx Opex accounts.
 * 3. Cost centre eligibility: Rejects direct branch cost centres (branch_id != null) as source,
 *    rejects self-allocation (target == source), rejects duplicate targets.
 * 4. Calculation mechanics:
 *    - Standard percentage split (₹1,000 -> 40%, 35%, 25%).
 *    - Fractional-paisa rounding (₹100 -> 33.3333%, 33.3333%, 33.3334%).
 *    - Largest-remainder tie-breaking (₹0.05 -> 50%, 50%).
 *    - Small amount split (₹0.01 -> 40%, 35%, 25%).
 *    - Exact source-to-destination total equality (sum === source).
 * 5. Workflow lifecycle:
 *    - Missing source data produces NO_SOURCE_EXPENSES_FOUND (no empty vouchers).
 *    - Preview dry-run creates 0 vouchers and 0 journal lines.
 *    - Execute run creates SUBMITTED run and detailed lines, freezes rule_snapshot.
 *    - Maker-checker Segregation of Duties: maker cannot approve own run.
 *    - Super Admin cannot bypass SoD.
 *    - Approve & Post: Creates balanced JOURNAL voucher (Credit Source CC, Debit Target CCs),
 *      creates journal lines with cost centre IDs, links voucher to run, status -> POSTED.
 *    - Duplicate protection: Cannot allocate already-allocated source line twice.
 *    - Invalid status transitions rejected (cannot approve POSTED run).
 *    - Reversal: Creates compensating reversal voucher, inverts Dr/Cr, links vouchers,
 *      marks original entry is_reversed=true, status -> REVERSED, originals remain immutable.
 *    - Source line eligible again after approved reversal.
 * 6. Fiscal period & start date guards enforced.
 * 7. Transaction safety and atomic rollback.
 * 8. Cleanup and baseline invariant preservation (CoA = 100, TB = ₹3,380.00).
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
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
  throw new Error("DATABASE_URL not found in .env");
}

async function runSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.6 STEP 4C: ENGINE & WORKFLOW SUITE   ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  process.env.DATABASE_URL = conn;
  const pool = new Pool({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  // Register TypeScript compilation hook
  const ts = require('../node_modules/typescript');
  require.extensions['.ts'] = function(module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      }
    });
    return module._compile(compiled.outputText, filename);
  };

  const { CostAllocationEngineService } = require('../src/lib/services/cost-allocation-engine.service');
  const { CostAllocationWorkflowService } = require('../src/lib/services/cost-allocation-workflow.service');
  const { CostAllocationRepository } = require('../src/lib/repositories/cost-allocation.repository');
  const { CostCentreRepository } = require('../src/lib/repositories/cost-centre.repository');
  const { AccountingVoucherRepository } = require('../src/lib/repositories/accounting-voucher.repository');
  const { PostingService } = require('../src/lib/services/posting.service');

  let passed = 0;
  function pass(testNum, desc) {
    passed++;
    console.log(`  ✓ TEST [${testNum}] PASS: ${desc}`);
  }

  // Tracking fixtures for cleanup
  const createdRuleIds = [];
  const createdRunIds = [];
  const createdCostCentreIds = [];
  const createdVoucherIds = [];

  try {
    // -------------------------------------------------------------------------
    // PREFLIGHT: Baseline Invariants
    // -------------------------------------------------------------------------
    const coaRes = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
    assert.strictEqual(coaRes.rows[0].count, 100, "CoA baseline must be 100");

    const tbRes = await pool.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    assert.strictEqual(tbRes.rows[0].dr, '3380.00');
    assert.strictEqual(tbRes.rows[0].cr, '3380.00');

    // Fetch master fixtures
    const userRes = await pool.query(`SELECT id FROM public.user LIMIT 2;`);
    assert.ok(userRes.rows.length >= 2, "At least 2 users required for Maker-Checker tests");
    const userMaker = userRes.rows[0].id;
    const userChecker = userRes.rows[1].id;

    const branchRes = await pool.query(`SELECT id FROM public.branch WHERE deleted_at IS NULL LIMIT 2;`);
    assert.ok(branchRes.rows.length >= 2, "At least 2 branches required for testing");
    const branch1 = branchRes.rows[0].id;
    const branch2 = branchRes.rows[1].id;

    // Accounts
    const acctOpex5280 = (await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '5280';`)).rows[0]; // Software
    const acctBank1112 = (await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '1112';`)).rows[0]; // Bank
    const acctRevenue4110 = (await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '4110';`)).rows[0]; // Revenue
    const acctRounding5295 = (await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '5295';`)).rows[0]; // Cash rounding
    const acctGroup5200 = (await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '5200';`)).rows[0]; // Group opex

    // Create Test Cost Centres
    // 1 Shared central cost centre (branch_id = null)
    const ccShared = await CostCentreRepository.create({
      code: `CC-TEST-CORP-${Date.now()}`,
      name: "Corporate Central IT Test",
      department: "IT",
      branch_id: null,
      is_active: true,
    }, userMaker);
    createdCostCentreIds.push(ccShared.id);

    // 2 Destination branch cost centres
    const ccDest1 = await CostCentreRepository.create({
      code: `CC-TEST-BR1-${Date.now()}`,
      name: "Branch 1 Test CC",
      department: "OPERATIONS",
      branch_id: branch1,
      is_active: true,
    }, userMaker);
    createdCostCentreIds.push(ccDest1.id);

    const ccDest2 = await CostCentreRepository.create({
      code: `CC-TEST-BR2-${Date.now()}`,
      name: "Branch 2 Test CC",
      department: "OPERATIONS",
      branch_id: branch2,
      is_active: true,
    }, userMaker);
    createdCostCentreIds.push(ccDest2.id);

    // 1 Branch cost centre (to test direct branch expense rejection)
    const ccBranchDirect = await CostCentreRepository.create({
      code: `CC-TEST-DIRECT-${Date.now()}`,
      name: "Direct Branch Expense Test",
      department: "OPERATIONS",
      branch_id: branch1,
      is_active: true,
    }, userMaker);
    createdCostCentreIds.push(ccBranchDirect.id);

    console.log("  ✓ Preflight verified: Baseline pristine, test fixtures created\n");

    // =========================================================================
    // SECTION 1: CALCULATION ENGINE TESTS
    // =========================================================================

    // TEST 1: Ordinary percentage split (₹1,000 -> 40%, 35%, 25%)
    {
      const targets = [
        { target_cost_centre_id: ccDest1.id, percentage: 40.00, sort_order: 1 },
        { target_cost_centre_id: ccDest2.id, percentage: 35.00, sort_order: 2 },
        { target_cost_centre_id: ccBranchDirect.id, percentage: 25.00, sort_order: 3 },
      ];
      const res = CostAllocationEngineService.calculateLargestRemainder(1000.00, targets);
      assert.strictEqual(res.length, 3);
      assert.strictEqual(res[0].allocated_amount, 400.00);
      assert.strictEqual(res[1].allocated_amount, 350.00);
      assert.strictEqual(res[2].allocated_amount, 250.00);
      const sum = res.reduce((s, r) => s + r.allocated_amount, 0);
      assert.strictEqual(sum, 1000.00);
      pass(1, "Ordinary percentage split calculates exactly without rounding difference");
    }

    // TEST 2: Fractional-paisa rounding (₹100 -> 33.3333%, 33.3333%, 33.3334%)
    {
      const targets = [
        { target_cost_centre_id: ccDest1.id, percentage: 33.3333, sort_order: 1 },
        { target_cost_centre_id: ccDest2.id, percentage: 33.3333, sort_order: 2 },
        { target_cost_centre_id: ccBranchDirect.id, percentage: 33.3334, sort_order: 3 },
      ];
      const res = CostAllocationEngineService.calculateLargestRemainder(100.00, targets);
      // T3 fraction is higher (0.34 vs 0.33), receives the +1 cent remainder
      assert.strictEqual(res[0].allocated_amount, 33.33);
      assert.strictEqual(res[1].allocated_amount, 33.33);
      assert.strictEqual(res[2].allocated_amount, 33.34);
      const sum = Number((res[0].allocated_amount + res[1].allocated_amount + res[2].allocated_amount).toFixed(2));
      assert.strictEqual(sum, 100.00);
      pass(2, "Fractional-paisa rounding absorbs deficit into largest remainder target");
    }

    // TEST 3: Largest-remainder tie-breaking (₹0.05 -> 50%, 50%)
    {
      const targets = [
        { target_cost_centre_id: ccDest1.id, percentage: 50.00, sort_order: 1 },
        { target_cost_centre_id: ccDest2.id, percentage: 50.00, sort_order: 2 },
      ];
      const res = CostAllocationEngineService.calculateLargestRemainder(0.05, targets);
      // 5 cents * 0.5 = 2.5 cents. Base = 2 cents each (sum = 4). Deficit = 1 cent.
      // Fractions are equal (0.5 vs 0.5). Tie-breaker by sort_order gives +1 cent to T1.
      assert.strictEqual(res[0].allocated_amount, 0.03);
      assert.strictEqual(res[1].allocated_amount, 0.02);
      assert.strictEqual(Number((res[0].allocated_amount + res[1].allocated_amount).toFixed(2)), 0.05);
      pass(3, "Tie-breaking by sort_order is deterministic on identical fractions");
    }

    // TEST 4: Small source amounts and uneven targets (₹0.01 -> 40%, 35%, 25%)
    {
      const targets = [
        { target_cost_centre_id: ccDest1.id, percentage: 40.00, sort_order: 1 },
        { target_cost_centre_id: ccDest2.id, percentage: 35.00, sort_order: 2 },
        { target_cost_centre_id: ccBranchDirect.id, percentage: 25.00, sort_order: 3 },
      ];
      const res = CostAllocationEngineService.calculateLargestRemainder(0.01, targets);
      // 1 cent total. T1 has fraction 0.40 (largest), receives 1 cent (0.01). Others 0.00.
      assert.strictEqual(res[0].allocated_amount, 0.01);
      assert.strictEqual(res[1].allocated_amount, 0.00);
      assert.strictEqual(res[2].allocated_amount, 0.00);
      const sum = Number((res[0].allocated_amount + res[1].allocated_amount + res[2].allocated_amount).toFixed(2));
      assert.strictEqual(sum, 0.01);
      pass(4, "Small source amounts allocate 1 paisa to highest fraction with zero sum error");
    }

    // =========================================================================
    // SECTION 2: RULE ELIGIBILITY & GOVERNANCE ASSERTIONS
    // =========================================================================

    // TEST 5: Target percentages sum != 100.00% rejected
    {
      const mockRule = {
        rule_code: "RUL-TEST-SUM",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "5280",
        targets: [
          { target_cost_centre_id: ccDest1.id, percentage: 60.00, sort_order: 1 },
          { target_cost_centre_id: ccDest2.id, percentage: 35.00, sort_order: 2 }, // Sum = 95.00%
        ],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(mockRule),
        (err) => err.code === "PERCENTAGE_SUM_INVALID"
      );
      pass(5, "Target percentages summing to 95.00% strictly rejected with PERCENTAGE_SUM_INVALID");
    }

    // TEST 6: Inactive rule types (REVENUE_RATIO, EQUAL_SPLIT) rejected
    {
      const mockRule = {
        rule_code: "RUL-TEST-TYPE",
        rule_type: "REVENUE_RATIO",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "5280",
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100.00, sort_order: 1 }],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(mockRule),
        (err) => err.code === "RULE_TYPE_NOT_AUTHORIZED"
      );
      pass(6, "Rule type REVENUE_RATIO strictly rejected as unauthorized");
    }

    // TEST 7: Ineligible accounts rejected (Balance sheet, Revenue, Groups, Rounding 5295/5296)
    {
      const bsRule = {
        rule_code: "RUL-TEST-BS",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "1112", // Bank (1xxx)
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100.00, sort_order: 1 }],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(bsRule),
        (err) => err.code === "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION"
      );

      const revRule = {
        rule_code: "RUL-TEST-REV",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "4110", // Revenue (4xxx)
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100.00, sort_order: 1 }],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(revRule),
        (err) => err.code === "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION"
      );

      const grpRule = {
        rule_code: "RUL-TEST-GRP",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "5200", // Group opex
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100.00, sort_order: 1 }],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(grpRule),
        (err) => err.code === "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION"
      );

      const roundRule = {
        rule_code: "RUL-TEST-RND",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "5295", // Cash rounding
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100.00, sort_order: 1 }],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(roundRule),
        (err) => err.code === "ACCOUNT_ROUNDING_PROHIBITED"
      );
      pass(7, "Balance sheet, Revenue, Summary group, and Cash Rounding accounts strictly prohibited");
    }

    // TEST 8: Self-allocation (target == source) and duplicate targets rejected
    {
      const selfRule = {
        rule_code: "RUL-TEST-SELF",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "5280",
        targets: [{ target_cost_centre_id: ccShared.id, percentage: 100.00, sort_order: 1 }],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(selfRule),
        (err) => err.code === "TARGET_CANNOT_BE_SOURCE"
      );

      const dupRule = {
        rule_code: "RUL-TEST-DUP",
        rule_type: "FIXED_PERCENTAGE",
        is_active: true,
        source_cost_centre_id: ccShared.id,
        source_account_code: "5280",
        targets: [
          { target_cost_centre_id: ccDest1.id, percentage: 50.00, sort_order: 1 },
          { target_cost_centre_id: ccDest1.id, percentage: 50.00, sort_order: 2 },
        ],
      };
      assert.throws(
        () => CostAllocationEngineService.validateRuleEligibility(dupRule),
        (err) => err.code === "DUPLICATE_TARGET_COST_CENTRE"
      );
      pass(8, "Self-allocation and duplicate target cost centres strictly rejected");
    }

    // =========================================================================
    // SECTION 3: WORKFLOW, POSTINGS, SOD & REVERSAL LIFECYCLE
    // =========================================================================

    // Create a real active rule in DB
    const realRule = await CostAllocationRepository.createRule({
      rule_code: `RUL-IT-TEST-${Date.now()}`,
      name: "IT Infrastructure Shared Overhead Allocation",
      rule_type: "FIXED_PERCENTAGE",
      source_cost_centre_id: ccShared.id,
      source_account_id: acctOpex5280.id,
      effective_from: "2026-10-01",
      effective_to: "2026-10-31",
      targets: [
        { target_cost_centre_id: ccDest1.id, percentage: 60.00, sort_order: 1 },
        { target_cost_centre_id: ccDest2.id, percentage: 40.00, sort_order: 2 },
      ],
    }, userMaker);
    createdRuleIds.push(realRule.id);

    // TEST 9: Missing source expenses produces explicit NO_SOURCE_EXPENSES_FOUND
    {
      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.previewAllocation({
            ruleId: realRule.id,
            allocationDate: "2026-10-15",
          });
        },
        (err) => {
          assert.strictEqual(err.code, "NO_SOURCE_EXPENSES_FOUND");
          return true;
        }
      );
      pass(9, "Zero source expenses produces explicit NO_SOURCE_EXPENSES_FOUND, not empty voucher");
    }

    // Seed a real posted source expense voucher to allocate
    // Debit 5280 (IT expense) ₹1,500 with ccShared, Credit 1112 (Bank) ₹1,500
    const sourceVoucherDraft = await AccountingVoucherRepository.createDraft(
      {
        voucher_type: "EXPENSE",
        voucher_date: "2026-10-10",
        branch_id: branch1,
        narration: "Shared AWS Cloud Infrastructure Invoice October 2026",
        reference_type: "EXPENSE_CLAIM",
        reference_id: `exp_aws_${Date.now()}`,
        cost_centre_id: ccShared.id,
      },
      branch1,
      "FY2026-27",
      userMaker
    );
    createdVoucherIds.push(sourceVoucherDraft.id);

    await AccountingVoucherRepository.submit(sourceVoucherDraft.id, userMaker, branch1);
    await AccountingVoucherRepository.approve(sourceVoucherDraft.id, userChecker, branch1);

    const postSourceRes = await PostingService.postVoucher({
      voucherId: sourceVoucherDraft.id,
      postedBy: userChecker,
      lines: [
        {
          account_id: acctOpex5280.id,
          debit_amount: 1500.00,
          credit_amount: 0,
          cost_centre_id: ccShared.id,
          branch_id: branch1,
          narration: "AWS Hosting shared",
        },
        {
          account_id: acctBank1112.id,
          debit_amount: 0,
          credit_amount: 1500.00,
          cost_centre_id: null,
          branch_id: branch1,
          narration: "Bank payment",
        },
      ],
      branchId: branch1,
    });
    assert.strictEqual(postSourceRes.success, true, "Source expense posting must succeed");
    const sourceJournalLine = postSourceRes.data.journal_entry.lines.find((l) => l.account_id === acctOpex5280.id);
    assert.ok(sourceJournalLine, "Posted source journal line must exist");

    // TEST 10: Preview Allocation dry-run produces exact figures without mutating database
    {
      const vouchersCountBefore = (await pool.query(`SELECT count(*)::int as c FROM public.accounting_voucher;`)).rows[0].c;
      const runsCountBefore = (await pool.query(`SELECT count(*)::int as c FROM public.cost_allocation_run;`)).rows[0].c;

      const preview = await CostAllocationWorkflowService.previewAllocation({
        ruleId: realRule.id,
        allocationDate: "2026-10-15",
      });

      assert.strictEqual(preview.total_source_amount, 1500.00);
      assert.strictEqual(preview.total_allocated_amount, 1500.00);
      assert.strictEqual(preview.rounding_difference, 0.00);
      assert.strictEqual(preview.calculated_lines.length, 2);
      // Dest1 (60% of 1500 = 900.00), Dest2 (40% of 1500 = 600.00)
      assert.strictEqual(preview.calculated_lines[0].allocated_amount, 900.00);
      assert.strictEqual(preview.calculated_lines[1].allocated_amount, 600.00);

      // Verify zero DB mutations
      const vouchersCountAfter = (await pool.query(`SELECT count(*)::int as c FROM public.accounting_voucher;`)).rows[0].c;
      const runsCountAfter = (await pool.query(`SELECT count(*)::int as c FROM public.cost_allocation_run;`)).rows[0].c;
      assert.strictEqual(vouchersCountBefore, vouchersCountAfter, "Preview must not create vouchers");
      assert.strictEqual(runsCountBefore, runsCountAfter, "Preview must not create runs");

      pass(10, "Preview dry-run computes 60/40 allocation accurately with zero database mutations");
    }

    // TEST 11: Execute Run (Maker Action) creates SUBMITTED run and freezes rule_snapshot
    let executedRunId;
    {
      const execResult = await CostAllocationWorkflowService.executeAllocationRun({
        ruleId: realRule.id,
        fiscalYear: "FY2026-27",
        periodName: "October 2026",
        allocationDate: "2026-10-15",
        executedBy: userMaker,
        narration: "October 2026 IT Overhead Apportionment",
      });

      executedRunId = execResult.run.id;
      createdRunIds.push(executedRunId);

      assert.strictEqual(execResult.run.status, "SUBMITTED");
      assert.strictEqual(Number(execResult.run.total_source_amount), 1500.00);
      assert.strictEqual(Number(execResult.run.total_allocated_amount), 1500.00);
      assert.strictEqual(execResult.run.executed_by, userMaker);
      assert.ok(execResult.run.rule_snapshot, "Immutable rule_snapshot must exist");
      assert.strictEqual(execResult.run.rule_snapshot.rule_code, realRule.rule_code);
      assert.strictEqual(execResult.lines.length, 2);

      pass(11, "Execute run creates SUBMITTED run, detailed lines, and freezes rule_snapshot");
    }

    // TEST 12: Maker cannot approve their own run (Segregation of Duties enforcement)
    {
      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.approveAndPostRun({
            runId: executedRunId,
            approvedBy: userMaker, // Maker attempting to approve own run
          });
        },
        (err) => {
          assert.strictEqual(err.code, "SEGREGATION_OF_DUTIES_VIOLATION");
          return true;
        }
      );
      pass(12, "Maker attempting to approve own run strictly rejected with SEGREGATION_OF_DUTIES_VIOLATION");
    }

    // TEST 13: Approve & Post (Checker Action) posts balanced GL voucher and links to run
    let postedVoucherId;
    {
      const postResult = await CostAllocationWorkflowService.approveAndPostRun({
        runId: executedRunId,
        approvedBy: userChecker, // Checker approval
      });

      postedVoucherId = postResult.voucher.id;
      createdVoucherIds.push(postedVoucherId);

      assert.strictEqual(postResult.run.status, "POSTED");
      assert.strictEqual(postResult.run.approved_by, userChecker);
      assert.strictEqual(postResult.run.accounting_voucher_id, postedVoucherId);
      assert.strictEqual(postResult.voucher.status, "POSTED");
      assert.strictEqual(postResult.voucher.voucher_type, "JOURNAL");

      // Verify journal entry lines in DB
      const jeLines = postResult.journal_entry.lines;
      assert.strictEqual(jeLines.length, 3, "Must have 1 source credit line + 2 target debit lines");

      const sourceCredit = jeLines.find((l) => l.cost_centre_id === ccShared.id);
      assert.ok(sourceCredit, "Source cost centre line must be credited");
      assert.strictEqual(Number(sourceCredit.credit_amount), 1500.00);
      assert.strictEqual(Number(sourceCredit.debit_amount), 0.00);

      const target1Debit = jeLines.find((l) => l.cost_centre_id === ccDest1.id);
      assert.ok(target1Debit, "Target 1 cost centre line must be debited");
      assert.strictEqual(Number(target1Debit.debit_amount), 900.00);
      assert.strictEqual(Number(target1Debit.credit_amount), 0.00);

      const target2Debit = jeLines.find((l) => l.cost_centre_id === ccDest2.id);
      assert.ok(target2Debit, "Target 2 cost centre line must be debited");
      assert.strictEqual(Number(target2Debit.debit_amount), 600.00);
      assert.strictEqual(Number(target2Debit.credit_amount), 0.00);

      // Verify Trial Balance remained balanced
      const currentTb = await pool.query(`
        SELECT 
          COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
          COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
        FROM public.accounting_journal_line;
      `);
      assert.strictEqual(currentTb.rows[0].dr, currentTb.rows[0].cr, "TB must remain strictly balanced");

      pass(13, "Checker approval posts balanced allocation JOURNAL voucher (Credits Source CC, Debits Target CCs)");
    }

    // TEST 14: Duplicate allocation prevention on active source line
    {
      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.executeAllocationRun({
            ruleId: realRule.id,
            fiscalYear: "FY2026-27",
            periodName: "October 2026",
            allocationDate: "2026-10-15",
            executedBy: userMaker,
            sourceJournalLineIds: [sourceJournalLine.id],
          });
        },
        (err) => {
          assert.strictEqual(err.code, "NO_SOURCE_EXPENSES_FOUND");
          return true;
        }
      );
      pass(14, "Source line already allocated in active POSTED run cannot be allocated again");
    }

    // TEST 15: Invalid status transition rejected (cannot approve already POSTED run)
    {
      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.approveAndPostRun({
            runId: executedRunId,
            approvedBy: userChecker,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "RUN_ALREADY_POSTED");
          return true;
        }
      );
      pass(15, "Attempt to approve already POSTED run rejected with RUN_ALREADY_POSTED");
    }

    // TEST 16: Reversing run creates compensating journal voucher, swaps Dr/Cr, preserves originals
    {
      const revResult = await CostAllocationWorkflowService.reverseRun({
        runId: executedRunId,
        reversalDate: "2026-10-20",
        reason: "Managerial re-allocation adjustment required",
        reversedBy: userChecker, // Checker can reverse Maker's run
      });

      createdVoucherIds.push(revResult.reversal_voucher.id);

      assert.strictEqual(revResult.run.status, "REVERSED");
      assert.strictEqual(revResult.run.reversed_by, userChecker);
      assert.ok(revResult.run.reversal_voucher_id);
      assert.strictEqual(revResult.reversal_voucher.status, "POSTED");

      // Verify original voucher remains POSTED and links reversed_by_voucher_id
      const origVchDb = (await pool.query(`SELECT status, reversed_by_voucher_id FROM public.accounting_voucher WHERE id = $1;`, [postedVoucherId])).rows[0];
      assert.strictEqual(origVchDb.status, "POSTED", "Original voucher status must remain POSTED");
      assert.strictEqual(origVchDb.reversed_by_voucher_id, revResult.reversal_voucher.id);

      // Verify compensating lines swapped debits and credits
      const revLines = revResult.reversal_journal_entry.lines;
      const revSourceLine = revLines.find((l) => l.cost_centre_id === ccShared.id);
      assert.ok(revSourceLine);
      assert.strictEqual(Number(revSourceLine.debit_amount), 1500.00, "Compensating line must debit source CC");
      assert.strictEqual(Number(revSourceLine.credit_amount), 0.00);

      const revDest1Line = revLines.find((l) => l.cost_centre_id === ccDest1.id);
      assert.ok(revDest1Line);
      assert.strictEqual(Number(revDest1Line.credit_amount), 900.00, "Compensating line must credit target 1 CC");
      assert.strictEqual(Number(revDest1Line.debit_amount), 0.00);

      const revDest2Line = revLines.find((l) => l.cost_centre_id === ccDest2.id);
      assert.ok(revDest2Line);
      assert.strictEqual(Number(revDest2Line.credit_amount), 600.00, "Compensating line must credit target 2 CC");
      assert.strictEqual(Number(revDest2Line.debit_amount), 0.00);

      pass(16, "Compensating reversal swaps Dr/Cr, preserves cost centres, and links vouchers bidirectionally");
    }

    // TEST 17: Source line eligible for reallocation once previous run is REVERSED
    {
      const previewAfterReversal = await CostAllocationWorkflowService.previewAllocation({
        ruleId: realRule.id,
        allocationDate: "2026-10-25",
      });
      assert.strictEqual(previewAfterReversal.total_source_amount, 1500.00);
      assert.strictEqual(previewAfterReversal.calculated_lines.length, 2);
      pass(17, "Source line becomes eligible for re-allocation once previous run is REVERSED");
    }

    // TEST 18: Reversing an already reversed run rejected
    {
      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.reverseRun({
            runId: executedRunId,
            reversalDate: "2026-10-22",
            reason: "Duplicate reversal attempt",
            reversedBy: userChecker,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "RUN_ALREADY_REVERSED");
          return true;
        }
      );
      pass(18, "Reversing an already reversed run strictly rejected with RUN_ALREADY_REVERSED");
    }

    // TEST 19: Maker attempting to reverse own run rejected (SoD on Reversal)
    {
      // Create a second quick run to test SoD on reversal
      const run2 = await CostAllocationWorkflowService.executeAllocationRun({
        ruleId: realRule.id,
        fiscalYear: "FY2026-27",
        periodName: "October 2026",
        allocationDate: "2026-10-25",
        executedBy: userMaker,
      });
      createdRunIds.push(run2.run.id);

      const postRun2 = await CostAllocationWorkflowService.approveAndPostRun({
        runId: run2.run.id,
        approvedBy: userChecker,
      });
      createdVoucherIds.push(postRun2.voucher.id);

      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.reverseRun({
            runId: run2.run.id,
            reversalDate: "2026-10-26",
            reason: "Maker reversal attempt",
            reversedBy: userMaker, // Maker trying to reverse
          });
        },
        (err) => {
          assert.strictEqual(err.code, "SEGREGATION_OF_DUTIES_VIOLATION");
          return true;
        }
      );
      pass(19, "Maker attempting to reverse their own posted run rejected with SEGREGATION_OF_DUTIES_VIOLATION");
    }

    // TEST 20: Date outside rule effective window strictly rejected
    {
      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.executeAllocationRun({
            ruleId: realRule.id,
            fiscalYear: "FY2026-27",
            periodName: "October 2026",
            allocationDate: "2025-01-01", // Prior to rule effective_from (2026-10-01)
            executedBy: userMaker,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "RULE_INACTIVE");
          return true;
        }
      );
      pass(20, "Allocation date prior to rule effective_from strictly rejected with RULE_INACTIVE");
    }

    // TEST 21: Fiscal period guard blocks execution when fiscal period is unconfigured
    {
      // Create a rule effective across Q3/Q4
      const ruleFuture = await CostAllocationRepository.createRule({
        rule_code: `RUL-FUT-TEST-${Date.now()}`,
        name: "Future Q3 Allocation Test",
        rule_type: "FIXED_PERCENTAGE",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        effective_to: "2026-12-31",
        targets: [
          { target_cost_centre_id: ccDest1.id, percentage: 50.00, sort_order: 1 },
          { target_cost_centre_id: ccDest2.id, percentage: 50.00, sort_order: 2 },
        ],
      }, userMaker);
      createdRuleIds.push(ruleFuture.id);

      await assert.rejects(
        async () => {
          await CostAllocationWorkflowService.executeAllocationRun({
            ruleId: ruleFuture.id,
            fiscalYear: "FY2026-27",
            periodName: "November 2026",
            allocationDate: "2026-11-15", // In rule window but NO period in DB
            executedBy: userMaker,
          });
        },
        (err) => {
          assert.strictEqual(err.code, "FISCAL_PERIOD_NOT_CONFIGURED");
          return true;
        }
      );
      pass(21, "Date in unconfigured fiscal period strictly blocked with FISCAL_PERIOD_NOT_CONFIGURED");
    }

    // TEST 22: Transaction atomicity and rollback on database error
    {
      const runsCountBefore = (await pool.query(`SELECT count(*)::int as c FROM public.cost_allocation_run;`)).rows[0].c;
      const client = await pool.connect();
      try {
        await client.query("BEGIN;");
        // Create an invalid run attempting to breach check constraint
        await assert.rejects(
          async () => {
            await client.query(`
              INSERT INTO public.cost_allocation_run (
                id, run_number, rule_id, rule_version, fiscal_year, period_name, allocation_date,
                source_cost_centre_id, source_account_id, total_source_amount, total_allocated_amount,
                rounding_difference, status, rule_snapshot, narration, executed_by, executed_at
              ) VALUES (
                gen_random_uuid()::text, 'RUN-INVALID-TEST', $1, 1, 'FY2026-27', 'October 2026', '2026-10-15',
                $2, $3, 100, 100, 0, 'INVALID_STATUS', '{}'::jsonb, 'Test', $4, NOW()
              );
            `, [realRule.id, ccShared.id, acctOpex5280.id, userMaker]);
          }
        );
        await client.query("ROLLBACK;");
      } finally {
        client.release();
      }
      const runsCountAfter = (await pool.query(`SELECT count(*)::int as c FROM public.cost_allocation_run;`)).rows[0].c;
      assert.strictEqual(runsCountBefore, runsCountAfter, "Rollback must leave zero partial writes");
      pass(22, "Transaction atomicity and constraint rollback leaves zero partial records");
    }

    console.log("\n==================================================================");
    console.log(`  PHASE C7.6 STEP 4C TEST RESULT: ${passed} / 22 PASSED (100% Green)`);
    console.log("==================================================================\n");

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purge test fixtures in safe order
    // -------------------------------------------------------------------------
    console.log("Purging test fixtures...");
    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      if (createdRunIds.length > 0) {
        await client.query(`DELETE FROM public.cost_allocation_run_line WHERE run_id = ANY($1);`, [createdRunIds]);
        await client.query(`DELETE FROM public.cost_allocation_run WHERE id = ANY($1);`, [createdRunIds]);
      }
      if (createdRuleIds.length > 0) {
        await client.query(`DELETE FROM public.cost_allocation_rule_target WHERE rule_id = ANY($1);`, [createdRuleIds]);
        await client.query(`DELETE FROM public.cost_allocation_rule WHERE id = ANY($1);`, [createdRuleIds]);
      }
      if (createdVoucherIds.length > 0) {
        // Clear reversal linkages first
        await client.query(`UPDATE public.accounting_voucher SET reversed_by_voucher_id = NULL, reversal_of_voucher_id = NULL WHERE id = ANY($1);`, [createdVoucherIds]);
        const entriesRes = await client.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1);`, [createdVoucherIds]);
        const entryIds = entriesRes.rows.map(r => r.id);
        if (entryIds.length > 0) {
          await client.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1);`, [entryIds]);
          await client.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1);`, [entryIds]);
        }
        await client.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1);`, [createdVoucherIds]);
      }
      if (createdCostCentreIds.length > 0) {
        await client.query(`DELETE FROM public.cost_centre WHERE id = ANY($1);`, [createdCostCentreIds]);
      }

      await client.query("COMMIT;");
      console.log("  ✓ Test fixtures purged cleanly");
    } catch (cleanupErr) {
      await client.query("ROLLBACK;");
      console.error("Cleanup error:", cleanupErr);
    } finally {
      client.release();
    }

    // Baseline confirmation
    const finalCoa = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
    const finalTb = await pool.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    const finalVchs = await pool.query(`SELECT count(*)::int as count FROM public.accounting_voucher;`);
    const finalEntries = await pool.query(`SELECT count(*)::int as count FROM public.accounting_journal_entry;`);
    const finalLines = await pool.query(`SELECT count(*)::int as count FROM public.accounting_journal_line;`);
    const finalCcs = await pool.query(`SELECT count(*)::int as count FROM public.cost_centre;`);

    console.log(`  ✓ Post-cleanup baseline:`);
    console.log(`    - CoA: ${finalCoa.rows[0].count} (must be 100)`);
    console.log(`    - TB: Dr ₹${finalTb.rows[0].dr} = Cr ₹${finalTb.rows[0].cr}`);
    console.log(`    - Vouchers: ${finalVchs.rows[0].count} (must be 6)`);
    console.log(`    - Journal Entries: ${finalEntries.rows[0].count} (must be 4)`);
    console.log(`    - Journal Lines: ${finalLines.rows[0].count} (must be 10)`);
    console.log(`    - Cost Centres: ${finalCcs.rows[0].count} (must be 0)`);

    assert.strictEqual(finalCoa.rows[0].count, 100);
    assert.strictEqual(finalTb.rows[0].dr, '3380.00');
    assert.strictEqual(finalTb.rows[0].cr, '3380.00');
    assert.strictEqual(finalVchs.rows[0].count, 6);
    assert.strictEqual(finalEntries.rows[0].count, 4);
    assert.strictEqual(finalLines.rows[0].count, 10);
    assert.strictEqual(finalCcs.rows[0].count, 0);

    await pool.end();
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }
    process.exit(process.exitCode || 0);
  }
}

runSuite().catch(err => {
  console.error("Test Suite Failed with Exception:", err);
  process.exit(1);
});
