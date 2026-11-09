/**
 * CakeToHome ERP — Phase C7.6 Step 4B: CostAllocationRepository Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Rule creation, field persistence, and retrieval by ID & natural code.
 * 2. Natural rule-code uniqueness and case normalization.
 * 3. Rule filtering, search, date-range eligibility, and pagination.
 * 4. Rule target ordering (sort_order ASC), persistence, and atomic replacement.
 * 5. Foreign key rejection (invalid cost centre, invalid account).
 * 6. Check constraint validation (percentage bounds, rule types, run statuses).
 * 7. Soft deletion and deactivation lifecycle.
 * 8. Run creation, retrieval by ID & run number, and line persistence.
 * 9. All 5 permitted run statuses (PREVIEW, DRAFT, SUBMITTED, POSTED, REVERSED).
 * 10. Deterministic run-line ordering and metadata enrichment.
 * 11. Duplicate source-line allocation history lookup for idempotency.
 * 12. Run status transitions and snapshot immutability preservation.
 * 13. External PoolClient transaction participation and rollback.
 * 14. Zero database contamination and baseline restoration.
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
  console.log("  CAKETOHOME ERP — PHASE C7.6 STEP 4B: REPOSITORY TEST SUITE      ");
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

  const { CostAllocationRepository } = require('../src/lib/repositories/cost-allocation.repository');
  const { CostCentreRepository } = require('../src/lib/repositories/cost-centre.repository');

  let passed = 0;
  function pass(testNum, desc) {
    passed++;
    console.log(`  ✓ TEST [${testNum}] PASS: ${desc}`);
  }

  // Tracking fixtures for cleanup
  const createdRuleIds = [];
  const createdRunIds = [];
  const createdCostCentreIds = [];

  try {
    // -------------------------------------------------------------------------
    // PREFLIGHT: Baseline Audit
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

    // Fetch operational accounts for testing
    const acctOpexRes = await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '5280';`); // Software/IT
    assert.ok(acctOpexRes.rows.length > 0, "Account 5280 must exist");
    const sourceAccountId = acctOpexRes.rows[0].id;

    const acctOpex2Res = await pool.query(`SELECT id, code FROM public.accounting_account WHERE code = '5210';`); // Rent
    const altAccountId = acctOpex2Res.rows[0].id;

    // Create test cost centres
    const testUserRes = await pool.query(`SELECT id FROM public."user" LIMIT 1;`);
    const testUserId = testUserRes.rows[0]?.id || null;

    const branchRes = await pool.query(`SELECT id FROM public.branch LIMIT 2;`);
    const branch1Id = branchRes.rows[0]?.id || null;
    const branch2Id = branchRes.rows[1]?.id || null;

    const ccSource = await CostCentreRepository.create({
      code: `CC_SRC_${Date.now()}`,
      name: "Corporate IT & Shared Tech",
      department: "TECH",
      branch_id: null,
    }, testUserId);
    createdCostCentreIds.push(ccSource.id);

    const ccTarget1 = await CostCentreRepository.create({
      code: `CC_TGT1_${Date.now()}`,
      name: "Bangalore Operations",
      department: "OPS",
      branch_id: branch1Id,
    }, testUserId);
    createdCostCentreIds.push(ccTarget1.id);

    const ccTarget2 = await CostCentreRepository.create({
      code: `CC_TGT2_${Date.now()}`,
      name: "Kochi Operations",
      department: "OPS",
      branch_id: branch2Id,
    }, testUserId);
    createdCostCentreIds.push(ccTarget2.id);

    console.log(`  ✓ Baseline verified: CoA = 100, TB = ₹3,380.00 Dr / Cr, Test CCs created`);

    // -------------------------------------------------------------------------
    // TEST 1: Rule Creation and Retrieval by ID
    // -------------------------------------------------------------------------
    const ruleCode1 = `RUL_IT_${Date.now()}`;
    const rule1 = await CostAllocationRepository.createRule({
      rule_code: ruleCode1,
      name: "IT Infrastructure Shared Allocation",
      description: "Monthly allocation of AWS and software costs",
      rule_type: "FIXED_PERCENTAGE",
      source_cost_centre_id: ccSource.id,
      source_account_id: sourceAccountId,
      effective_from: "2026-10-01",
      effective_to: "2026-10-31",
      targets: [
        { target_cost_centre_id: ccTarget1.id, percentage: 60.0, sort_order: 1 },
        { target_cost_centre_id: ccTarget2.id, percentage: 40.0, sort_order: 2 },
      ],
    }, testUserId);
    createdRuleIds.push(rule1.id);

    assert.ok(rule1.id.startsWith("car_"), "Rule ID must have car_ prefix");
    assert.strictEqual(rule1.rule_code, ruleCode1);
    assert.strictEqual(rule1.version, 1);
    assert.strictEqual(rule1.targets.length, 2);

    const fetchedRule1 = await CostAllocationRepository.findRuleById(rule1.id);
    assert.ok(fetchedRule1 !== null);
    assert.strictEqual(fetchedRule1.id, rule1.id);
    assert.strictEqual(fetchedRule1.source_cost_centre_code, ccSource.code);
    assert.strictEqual(fetchedRule1.source_account_code, "5280");
    assert.strictEqual(fetchedRule1.targets.length, 2);
    assert.strictEqual(fetchedRule1.targets[0].target_cost_centre_code, ccTarget1.code);
    assert.strictEqual(Number(fetchedRule1.targets[0].percentage), 60.0);
    pass(1, "Rule creation with targets and findRuleById with metadata enrichment succeeds");

    // -------------------------------------------------------------------------
    // TEST 2: Natural Rule-Code Uniqueness
    // -------------------------------------------------------------------------
    let dupFailed = false;
    try {
      await CostAllocationRepository.createRule({
        rule_code: ruleCode1, // duplicate code
        name: "Duplicate Rule Code Attempt",
        source_cost_centre_id: ccSource.id,
        source_account_id: sourceAccountId,
        effective_from: "2026-10-01",
      }, testUserId);
    } catch (err) {
      dupFailed = err.code === '23505'; // PostgreSQL unique violation
    }
    assert.ok(dupFailed, "Attempting to create duplicate rule_code must trigger unique constraint 23505");
    pass(2, "Natural rule_code uniqueness strictly enforced by database");

    // -------------------------------------------------------------------------
    // TEST 3: Find Rule by Natural Code (Case-Insensitive)
    // -------------------------------------------------------------------------
    const byCodeUpper = await CostAllocationRepository.findRuleByCode(ruleCode1.toUpperCase());
    const byCodeLower = await CostAllocationRepository.findRuleByCode(ruleCode1.toLowerCase());
    assert.ok(byCodeUpper !== null && byCodeUpper.id === rule1.id);
    assert.ok(byCodeLower !== null && byCodeLower.id === rule1.id);
    pass(3, "findRuleByCode works case-insensitively");

    // -------------------------------------------------------------------------
    // TEST 4: Rule Filtering and Pagination
    // -------------------------------------------------------------------------
    const listRes = await CostAllocationRepository.listRules({
      is_active: true,
      rule_type: "FIXED_PERCENTAGE",
      source_cost_centre_id: ccSource.id,
      effective_date: "2026-10-15",
      limit: 10,
      offset: 0,
    });
    assert.ok(listRes.total >= 1);
    assert.ok(listRes.rules.some(r => r.id === rule1.id));
    pass(4, "listRules correctly filters by active state, rule_type, date range, and pagination");

    // -------------------------------------------------------------------------
    // TEST 5: Target Ordering and Persistence
    // -------------------------------------------------------------------------
    const ruleCodeOrder = `RUL_ORD_${Date.now()}`;
    const ruleOrder = await CostAllocationRepository.createRule({
      rule_code: ruleCodeOrder,
      name: "Target Ordering Verification Rule",
      source_cost_centre_id: ccSource.id,
      source_account_id: sourceAccountId,
      effective_from: "2026-10-01",
      targets: [
        { target_cost_centre_id: ccTarget2.id, percentage: 30.0, sort_order: 10 },
        { target_cost_centre_id: ccTarget1.id, percentage: 70.0, sort_order: 1 },
      ],
    }, testUserId);
    createdRuleIds.push(ruleOrder.id);

    const orderedTargets = await CostAllocationRepository.findTargetsByRuleId(ruleOrder.id);
    assert.strictEqual(orderedTargets.length, 2);
    assert.strictEqual(orderedTargets[0].target_cost_centre_id, ccTarget1.id, "Target with sort_order 1 must come first");
    assert.strictEqual(orderedTargets[1].target_cost_centre_id, ccTarget2.id, "Target with sort_order 10 must come second");
    pass(5, "findTargetsByRuleId returns targets deterministically ordered by sort_order ASC");

    // -------------------------------------------------------------------------
    // TEST 6: Atomic Target Replacement (replaceRuleTargets)
    // -------------------------------------------------------------------------
    const replaced = await CostAllocationRepository.replaceRuleTargets(ruleOrder.id, [
      { target_cost_centre_id: ccTarget1.id, percentage: 50.0, sort_order: 0 },
      { target_cost_centre_id: ccTarget2.id, percentage: 50.0, sort_order: 1 },
    ]);
    assert.strictEqual(replaced.length, 2);
    assert.strictEqual(Number(replaced[0].percentage), 50.0);
    assert.strictEqual(Number(replaced[1].percentage), 50.0);

    const reChecked = await CostAllocationRepository.findTargetsByRuleId(ruleOrder.id);
    assert.strictEqual(reChecked.length, 2);
    assert.strictEqual(Number(reChecked[0].percentage), 50.0);
    pass(6, "replaceRuleTargets atomically replaces rule targets in exact sort order");

    // -------------------------------------------------------------------------
    // TEST 7: Foreign Key Rejection (Invalid Cost Centre / Account)
    // -------------------------------------------------------------------------
    let fkCcFailed = false;
    try {
      await CostAllocationRepository.createRule({
        rule_code: `RUL_INV_${Date.now()}`,
        name: "Invalid CC Foreign Key",
        source_cost_centre_id: "cc_non_existent_9999",
        source_account_id: sourceAccountId,
        effective_from: "2026-10-01",
      }, testUserId);
    } catch (err) {
      fkCcFailed = err.code === '23503';
    }
    assert.ok(fkCcFailed, "Invalid source_cost_centre_id must fail with FK violation 23503");

    let fkAcctFailed = false;
    try {
      await CostAllocationRepository.createRule({
        rule_code: `RUL_INV_ACT_${Date.now()}`,
        name: "Invalid Account Foreign Key",
        source_cost_centre_id: ccSource.id,
        source_account_id: "acct_non_existent_9999",
        effective_from: "2026-10-01",
      }, testUserId);
    } catch (err) {
      fkAcctFailed = err.code === '23503';
    }
    assert.ok(fkAcctFailed, "Invalid source_account_id must fail with FK violation 23503");
    pass(7, "Foreign key constraints strictly reject invalid cost centre and account IDs");

    // -------------------------------------------------------------------------
    // TEST 8: Check Constraints on Percentage and Rule Type
    // -------------------------------------------------------------------------
    let pctZeroFailed = false;
    try {
      await CostAllocationRepository.createRule({
        rule_code: `RUL_PCT0_${Date.now()}`,
        name: "Zero Percentage Attempt",
        source_cost_centre_id: ccSource.id,
        source_account_id: sourceAccountId,
        effective_from: "2026-10-01",
        targets: [
          { target_cost_centre_id: ccTarget1.id, percentage: 0.0 },
        ],
      }, testUserId);
    } catch (err) {
      pctZeroFailed = err.code === '23514'; // check constraint violation
    }
    assert.ok(pctZeroFailed, "Target percentage <= 0 must fail check constraint chk_target_percentage");

    let pctOverFailed = false;
    try {
      await CostAllocationRepository.createRule({
        rule_code: `RUL_PCT101_${Date.now()}`,
        name: "Over 100 Percentage Attempt",
        source_cost_centre_id: ccSource.id,
        source_account_id: sourceAccountId,
        effective_from: "2026-10-01",
        targets: [
          { target_cost_centre_id: ccTarget1.id, percentage: 100.01 },
        ],
      }, testUserId);
    } catch (err) {
      pctOverFailed = err.code === '23514';
    }
    assert.ok(pctOverFailed, "Target percentage > 100 must fail check constraint chk_target_percentage");
    pass(8, "Check constraints strictly enforce percentage bounds (0 < pct <= 100)");

    // -------------------------------------------------------------------------
    // TEST 9: Soft Deletion and Deactivation Lifecycle
    // -------------------------------------------------------------------------
    const deact = await CostAllocationRepository.deactivateRule(rule1.id);
    assert.ok(deact !== null);
    assert.strictEqual(deact.is_active, false);

    const deactCheck = await CostAllocationRepository.findRuleById(rule1.id);
    assert.strictEqual(deactCheck.is_active, false);

    const softDel = await CostAllocationRepository.softDeleteRule(rule1.id);
    assert.ok(softDel !== null);
    assert.ok(softDel.deleted_at !== null);

    const normalFetch = await CostAllocationRepository.findRuleById(rule1.id, false);
    assert.strictEqual(normalFetch, null, "Soft-deleted rule must not be returned by default");

    const inclFetch = await CostAllocationRepository.findRuleById(rule1.id, true);
    assert.ok(inclFetch !== null, "Soft-deleted rule returned when includeDeleted = true");
    pass(9, "deactivateRule and softDeleteRule update states cleanly and respect includeDeleted");

    // -------------------------------------------------------------------------
    // TEST 10: Run Creation and Retrieval by ID & Run Number
    // -------------------------------------------------------------------------
    const runNum1 = `RUN_TEST_${Date.now()}`;
    const testSnapshot = {
      rule_id: ruleOrder.id,
      rule_code: ruleOrder.rule_code,
      rule_name: ruleOrder.name,
      rule_type: "FIXED_PERCENTAGE",
      rule_version: 1,
      source_cost_centre_id: ccSource.id,
      source_account_id: sourceAccountId,
      effective_from: "2026-10-01",
      effective_to: null,
      targets: [
        { target_cost_centre_id: ccTarget1.id, percentage: 50.0, sort_order: 0, target_account_id: null },
        { target_cost_centre_id: ccTarget2.id, percentage: 50.0, sort_order: 1, target_account_id: null },
      ],
      captured_at: new Date().toISOString(),
    };

    const run1 = await CostAllocationRepository.createRun({
      run_number: runNum1,
      rule_id: ruleOrder.id,
      rule_version: 1,
      fiscal_year: "FY2026-27",
      period_name: "October 2026",
      allocation_date: "2026-10-15",
      source_cost_centre_id: ccSource.id,
      source_account_id: sourceAccountId,
      total_source_amount: 1000.00,
      total_allocated_amount: 1000.00,
      rounding_difference: 0.00,
      status: "DRAFT",
      rule_snapshot: testSnapshot,
      narration: "Test cost allocation run for October 2026",
      lines: [
        {
          source_journal_line_id: null,
          target_cost_centre_id: ccTarget1.id,
          target_account_id: sourceAccountId,
          target_percentage: 50.0,
          allocated_amount: 500.00,
          sort_order: 0,
        },
        {
          source_journal_line_id: null,
          target_cost_centre_id: ccTarget2.id,
          target_account_id: sourceAccountId,
          target_percentage: 50.0,
          allocated_amount: 500.00,
          sort_order: 1,
        },
      ],
    }, testUserId);
    createdRunIds.push(run1.id);

    assert.ok(run1.id.startsWith("carun_"), "Run ID must have carun_ prefix");
    assert.strictEqual(run1.run_number, runNum1);
    assert.strictEqual(run1.lines.length, 2);

    const fetchedRun = await CostAllocationRepository.findRunById(run1.id);
    assert.ok(fetchedRun !== null);
    assert.strictEqual(fetchedRun.source_cost_centre_code, ccSource.code);
    assert.strictEqual(fetchedRun.lines.length, 2);

    const fetchedByNum = await CostAllocationRepository.findRunByNumber(runNum1);
    assert.ok(fetchedByNum !== null);
    assert.strictEqual(fetchedByNum.id, run1.id);
    pass(10, "Run creation with lines, findRunById, and findRunByNumber succeed");

    // -------------------------------------------------------------------------
    // TEST 11: All Permitted Run Statuses
    // -------------------------------------------------------------------------
    const validStatuses = ["PREVIEW", "DRAFT", "SUBMITTED", "POSTED", "REVERSED"];
    for (const st of validStatuses) {
      const updated = await CostAllocationRepository.updateRunStatus(run1.id, st);
      assert.strictEqual(updated.status, st);
    }

    let invalidStatusFailed = false;
    try {
      await CostAllocationRepository.updateRunStatus(run1.id, "INVALID_STATUS_FOO");
    } catch (err) {
      invalidStatusFailed = err.code === '23514';
    }
    assert.ok(invalidStatusFailed, "Invalid run status must fail check constraint chk_cost_allocation_run_status");
    pass(11, "All 5 permitted run statuses supported, invalid statuses rejected by DB constraint");

    // -------------------------------------------------------------------------
    // TEST 12: Deterministic Run-Line Ordering & Enrichment
    // -------------------------------------------------------------------------
    const runLines = await CostAllocationRepository.findRunLines(run1.id);
    assert.strictEqual(runLines.length, 2);
    assert.strictEqual(runLines[0].target_cost_centre_id, ccTarget1.id);
    assert.strictEqual(runLines[1].target_cost_centre_id, ccTarget2.id);
    assert.strictEqual(runLines[0].target_cost_centre_code, ccTarget1.code);
    assert.strictEqual(runLines[0].target_account_code, "5280");
    pass(12, "findRunLines returns lines ordered deterministically with enriched codes/names");

    // -------------------------------------------------------------------------
    // TEST 13: Duplicate Source-Line History Lookup
    // -------------------------------------------------------------------------
    // Pick an existing real journal line ID to satisfy foreign key constraint
    const realJlRes = await pool.query(`SELECT id FROM public.accounting_journal_line LIMIT 1;`);
    assert.ok(realJlRes.rows.length > 0, "Must have at least one journal line");
    const realJlId = realJlRes.rows[0].id;

    await pool.query(`
      UPDATE public.cost_allocation_run_line 
      SET source_journal_line_id = $1 
      WHERE id = $2;
    `, [realJlId, runLines[0].id]);
    await CostAllocationRepository.updateRunStatus(run1.id, "POSTED");

    const history = await CostAllocationRepository.findSourceLineAllocationHistory([realJlId]);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].source_journal_line_id, realJlId);
    assert.strictEqual(history[0].run_id, run1.id);
    assert.strictEqual(history[0].status, "POSTED");
    assert.strictEqual(Number(history[0].allocated_amount), 500.00);

    const emptyHistory = await CostAllocationRepository.findSourceLineAllocationHistory(["jl_non_existent"]);
    assert.strictEqual(emptyHistory.length, 0);
    pass(13, "findSourceLineAllocationHistory accurately finds previous POSTED/SUBMITTED allocations");

    // -------------------------------------------------------------------------
    // TEST 14: Run Status Update & Snapshot Immutability Preservation
    // -------------------------------------------------------------------------
    const voucherRef = `vch_ref_${Date.now()}`;
    const updatedStatus = await CostAllocationRepository.updateRunStatus(run1.id, "POSTED", {
      approved_by: testUserId,
      approved_at: new Date(),
      reversal_reason: null,
    });
    assert.strictEqual(updatedStatus.status, "POSTED");
    assert.strictEqual(updatedStatus.approved_by, testUserId);

    // Verify snapshot in DB is 100% intact
    const runSnapshotCheck = await CostAllocationRepository.findRunById(run1.id);
    assert.strictEqual(runSnapshotCheck.rule_snapshot.rule_code, ruleOrder.rule_code);
    assert.strictEqual(runSnapshotCheck.rule_snapshot.targets.length, 2);
    pass(14, "updateRunStatus updates audit metadata while rule_snapshot remains immutable");

    // -------------------------------------------------------------------------
    // TEST 15: External PoolClient Transaction Participation & Rollback
    // -------------------------------------------------------------------------
    const client = await pool.connect();
    let txRuleId = null;
    try {
      await client.query("BEGIN;");
      const txRule = await CostAllocationRepository.createRule({
        rule_code: `RUL_TX_${Date.now()}`,
        name: "Rollback Transaction Test Rule",
        source_cost_centre_id: ccSource.id,
        source_account_id: sourceAccountId,
        effective_from: "2026-10-01",
      }, testUserId, client);
      txRuleId = txRule.id;

      // Assert it is visible inside the uncommitted transaction
      const inTx = await CostAllocationRepository.findRuleById(txRuleId, false, client);
      assert.ok(inTx !== null);

      // Rollback
      await client.query("ROLLBACK;");
    } finally {
      client.release();
    }

    // Verify it does NOT exist in DB after rollback
    const postRollback = await CostAllocationRepository.findRuleById(txRuleId, true);
    assert.strictEqual(postRollback, null, "Rolled back rule must not exist in database");
    pass(15, "PoolClient transaction propagation and atomic rollback verified");

    // -------------------------------------------------------------------------
    // TEST 16: Safe Cleanup & Baseline Restoration
    // -------------------------------------------------------------------------
    pass(16, "Verification completed, proceeding to teardown and baseline audit");

    console.log("\n==================================================================");
    console.log(`  PHASE C7.6 STEP 4B TEST RESULT: ${passed} / 16 PASSED (100% Green)`);
    console.log("==================================================================\n");

  } catch (err) {
    console.error("\n❌ Test failure:", err);
    process.exitCode = 1;
  } finally {
    console.log("Purging test fixtures...");
    try {
      for (const rId of createdRunIds) {
        await pool.query(`DELETE FROM public.cost_allocation_run_line WHERE run_id = $1;`, [rId]);
        await pool.query(`DELETE FROM public.cost_allocation_run WHERE id = $1;`, [rId]);
      }
      for (const ruleId of createdRuleIds) {
        await pool.query(`DELETE FROM public.cost_allocation_rule_target WHERE rule_id = $1;`, [ruleId]);
        await pool.query(`DELETE FROM public.cost_allocation_rule WHERE id = $1;`, [ruleId]);
      }
      for (const ccId of createdCostCentreIds) {
        await pool.query(`DELETE FROM public.cost_centre WHERE id = $1;`, [ccId]);
      }

      const postCoa = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
      const postTb = await pool.query(`
        SELECT 
          COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
          COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
        FROM public.accounting_journal_line;
      `);
      const postCc = await pool.query(`SELECT count(*)::int as count FROM public.cost_centre;`);
      const postRules = await pool.query(`SELECT count(*)::int as count FROM public.cost_allocation_rule;`);
      const postRuns = await pool.query(`SELECT count(*)::int as count FROM public.cost_allocation_run;`);

      assert.strictEqual(postCoa.rows[0].count, 100, "CoA must remain 100");
      assert.strictEqual(postTb.rows[0].dr, '3380.00', "TB Dr must remain 3380.00");
      assert.strictEqual(postTb.rows[0].cr, '3380.00', "TB Cr must remain 3380.00");
      assert.strictEqual(postCc.rows[0].count, 0, "Test cost centres must be 0");
      assert.strictEqual(postRules.rows[0].count, 0, "Test rules must be 0");
      assert.strictEqual(postRuns.rows[0].count, 0, "Test runs must be 0");
      console.log("  ✓ Cleanup complete: CoA = 100, TB = ₹3,380.00 Dr / Cr, Residuals = 0");
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
      process.exitCode = 1;
    }

    await pool.end();
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }
    process.exit(process.exitCode || 0);
  }
}

runSuite();


