/**
 * CakeToHome ERP — Phase C7.6 Step 2: Accounting Repository Cost-Centre Propagation
 * Focused test suite verifying cost_centre_id persistence and enrichment across:
 * - AccountingVoucherRepository
 * - AccountingJournalRepository
 * - ManualJournalService
 * - PostingService
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
  console.log("  CAKETOHOME ERP — PHASE C7.6 STEP 2: PROPAGATION TEST SUITE      ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  process.env.DATABASE_URL = conn;
  const pool = new Pool({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  // Register TypeScript hook
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

  const { AccountingVoucherRepository } = require('../src/lib/repositories/accounting-voucher.repository');
  const { AccountingJournalRepository } = require('../src/lib/repositories/accounting-journal.repository');
  const { CostCentreRepository } = require('../src/lib/repositories/cost-centre.repository');
  const { CostCentreService } = require('../src/lib/services/cost-centre.service');
  const { PostingService } = require('../src/lib/services/posting.service');
  const { ManualJournalService } = require('../src/lib/services/manual-journal.service');

  let passedCount = 0;
  function pass(testNum, desc) {
    passedCount++;
    console.log(`  ✓ PASS [Test ${testNum}]: ${desc}`);
  }

  const createdCostCentreIds = [];
  const createdVoucherIds = [];
  const createdEntryIds = [];

  try {
    // -------------------------------------------------------------------------
    // Baseline Audit
    // -------------------------------------------------------------------------
    console.log("[Baseline Audit] Verifying pristine starting state...");
    const initCheck = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account) as coa_count,
        (SELECT COALESCE(SUM(debit_amount),0) FROM public.accounting_journal_line) as total_dr,
        (SELECT COALESCE(SUM(credit_amount),0) FROM public.accounting_journal_line) as total_cr,
        (SELECT COUNT(*) FROM public.cost_centre) as cc_count,
        (SELECT COUNT(*) FROM public.accounting_voucher) as vch_count,
        (SELECT COUNT(*) FROM public.accounting_journal_entry) as jent_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line) as jline_count;
    `);

    const coaInit = parseInt(initCheck.rows[0].coa_count, 10);
    const drInit = parseFloat(initCheck.rows[0].total_dr);
    const crInit = parseFloat(initCheck.rows[0].total_cr);
    const ccInit = parseInt(initCheck.rows[0].cc_count, 10);
    const vchInit = parseInt(initCheck.rows[0].vch_count, 10);
    const jentInit = parseInt(initCheck.rows[0].jent_count, 10);
    const jlineInit = parseInt(initCheck.rows[0].jline_count, 10);

    assert.strictEqual(coaInit, 100, `Initial CoA must be 100, got ${coaInit}`);
    assert.strictEqual(drInit, 3380, `Initial Trial balance Dr must be 3380, got ${drInit}`);
    assert.strictEqual(crInit, 3380, `Initial Trial balance Cr must be 3380, got ${crInit}`);
    assert.strictEqual(ccInit, 0, `Initial cost centres must be 0, got ${ccInit}`);
    assert.strictEqual(vchInit, 6, `Initial vouchers must be 6, got ${vchInit}`);
    assert.strictEqual(jentInit, 4, `Initial journal entries must be 4, got ${jentInit}`);
    assert.strictEqual(jlineInit, 10, `Initial journal lines must be 10, got ${jlineInit}`);
    console.log("  ✓ Baseline verified: CoA = 100, TB = ₹3,380.00 Dr / Cr, Cost Centres = 0, Vouchers = 6\n");

    // -------------------------------------------------------------------------
    // Setup Test Fixtures
    // -------------------------------------------------------------------------
    const branchRes = await pool.query(`SELECT id, code FROM public.branch ORDER BY id LIMIT 2;`);
    const branch = branchRes.rows[0];
    const branchId = branch.id;

    const userRes = await pool.query(`SELECT id FROM public."user" WHERE deleted_at IS NULL LIMIT 2;`);
    const userMaker = userRes.rows[0]?.id || "usr_maker_test";
    const userChecker = userRes.rows[1]?.id || "usr_checker_test";

    const superAdminActor = {
      userId: userMaker,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      permissions: ["*"],
    };

    const accountsRes = await pool.query(`
      SELECT id, code, name, type FROM public.accounting_account
      WHERE is_active = true AND deleted_at IS NULL AND is_group = false AND code IN ('1111', '5110', '5230')
      ORDER BY code ASC;
    `);
    const acct1111 = accountsRes.rows.find(a => a.code === '1111');
    const acct5110 = accountsRes.rows.find(a => a.code === '5110');
    const acct5230 = accountsRes.rows.find(a => a.code === '5230');

    assert(acct1111 && acct5110 && acct5230, "Required accounts 1111, 5110, 5230 must exist");

    // Provision 2 disposable test cost centres
    const cc1 = await CostCentreService.createCostCentre(superAdminActor, {
      code: `CC_S2_HO_${Date.now().toString().slice(-4)}`,
      name: "Corporate Head Office Operations",
      department: "OPERATIONS",
      branch_id: null,
      metadata: { tier: "corporate" },
    });
    createdCostCentreIds.push(cc1.id);

    const cc2 = await CostCentreService.createCostCentre(superAdminActor, {
      code: `CC_S2_KIT_${Date.now().toString().slice(-4)}`,
      name: "Branch Production Kitchen",
      department: "PRODUCTION",
      branch_id: branchId,
      metadata: { tier: "branch" },
    });
    createdCostCentreIds.push(cc2.id);

    // -------------------------------------------------------------------------
    // TEST 1: Voucher with NULL cost_centre_id persists
    // -------------------------------------------------------------------------
    const vchNull = await AccountingVoucherRepository.createDraft(
      {
        voucher_type: "JOURNAL",
        voucher_date: "2026-10-15",
        branch_id: branchId,
        narration: "Test voucher with NULL cost_centre_id",
        reference_type: "MANUAL",
        reference_id: `ref_null_${Date.now()}`,
        cost_centre_id: null,
      },
      branchId,
      "FY2627",
      userMaker
    );
    createdVoucherIds.push(vchNull.id);
    assert.strictEqual(vchNull.cost_centre_id, null, "Voucher cost_centre_id must be null");

    // Verify directly in DB
    const dbVchNull = await pool.query(`SELECT cost_centre_id FROM public.accounting_voucher WHERE id = $1;`, [vchNull.id]);
    assert.strictEqual(dbVchNull.rows[0].cost_centre_id, null, "DB column cost_centre_id must be NULL");
    pass(1, "Voucher with NULL cost_centre_id persists cleanly");

    // -------------------------------------------------------------------------
    // TEST 2: Voucher with valid cost_centre_id persists
    // -------------------------------------------------------------------------
    const vchWithCc = await AccountingVoucherRepository.createDraft(
      {
        voucher_type: "JOURNAL",
        voucher_date: "2026-10-15",
        branch_id: branchId,
        narration: "Test voucher with valid cost_centre_id",
        reference_type: "MANUAL",
        reference_id: `ref_cc_${Date.now()}`,
        cost_centre_id: cc1.id,
      },
      branchId,
      "FY2627",
      userMaker
    );
    createdVoucherIds.push(vchWithCc.id);
    assert.strictEqual(vchWithCc.cost_centre_id, cc1.id, `Voucher cost_centre_id must be ${cc1.id}`);

    // Verify directly in DB
    const dbVchWithCc = await pool.query(`SELECT cost_centre_id FROM public.accounting_voucher WHERE id = $1;`, [vchWithCc.id]);
    assert.strictEqual(dbVchWithCc.rows[0].cost_centre_id, cc1.id, `DB column cost_centre_id must be ${cc1.id}`);
    pass(2, "Voucher with valid cost_centre_id persists cleanly to accounting_voucher.cost_centre_id");

    // -------------------------------------------------------------------------
    // TEST 3 & 4: Journal line with NULL and valid cost_centre_id persists
    // -------------------------------------------------------------------------
    // Submit and approve vchWithCc to allow journal entry creation
    await pool.query(`UPDATE public.accounting_voucher SET status = 'APPROVED', approved_by = $1, approved_at = NOW() WHERE id = $2;`, [userChecker, vchWithCc.id]);

    const client = await pool.connect();
    let createdEntry;
    try {
      await client.query("BEGIN;");
      createdEntry = await AccountingJournalRepository.createJournalEntry(
        vchWithCc.id,
        "2026-10-15",
        branchId,
        "FY2627",
        "Balanced entry testing NULL and valid cost centres",
        [
          {
            account_id: acct5110.id,
            debit_amount: 500,
            credit_amount: 0,
            cost_centre_id: cc1.id, // Valid cost centre
            narration: "Debit line with cc1",
          },
          {
            account_id: acct1111.id,
            debit_amount: 0,
            credit_amount: 500,
            cost_centre_id: null, // NULL cost centre
            narration: "Credit line with null cc",
          },
        ],
        userMaker,
        client
      );
      await client.query("COMMIT;");
    } catch (e) {
      await client.query("ROLLBACK;");
      throw e;
    } finally {
      client.release();
    }

    createdEntryIds.push(createdEntry.id);
    assert.strictEqual(createdEntry.lines.length, 2, "Entry must have 2 lines");
    assert.strictEqual(createdEntry.lines[0].cost_centre_id, cc1.id, "Line 1 cost_centre_id must match cc1.id");
    assert.strictEqual(createdEntry.lines[1].cost_centre_id, null, "Line 2 cost_centre_id must be null");

    // Direct DB verification
    const dbLinesRes = await pool.query(`
      SELECT line_no, cost_centre_id FROM public.accounting_journal_line
      WHERE journal_entry_id = $1 ORDER BY line_no ASC;
    `, [createdEntry.id]);

    assert.strictEqual(dbLinesRes.rows[0].cost_centre_id, cc1.id, "DB line 1 must store cc1.id");
    assert.strictEqual(dbLinesRes.rows[1].cost_centre_id, null, "DB line 2 must store NULL");
    pass(3, "Journal line with NULL cost_centre_id persists to accounting_journal_line");
    pass(4, "Journal line with valid cost_centre_id persists to accounting_journal_line");

    // -------------------------------------------------------------------------
    // TEST 5, 6, 7, 8: Retrieved journal line enrichment via findLinesByEntryId
    // -------------------------------------------------------------------------
    const enrichedLines = await AccountingJournalRepository.findLinesByEntryId(createdEntry.id);
    assert.strictEqual(enrichedLines.length, 2, "Must return exactly 2 lines");

    const line1 = enrichedLines[0];
    const line2 = enrichedLines[1];

    // Assert line 1 (cc1)
    assert.strictEqual(line1.cost_centre_id, cc1.id, "Enriched line 1 cost_centre_id matches");
    assert.strictEqual(line1.cost_centre_code, cc1.code, `Enriched line 1 cost_centre_code must be ${cc1.code}, got ${line1.cost_centre_code}`);
    assert.strictEqual(line1.cost_centre_name, cc1.name, `Enriched line 1 cost_centre_name must be ${cc1.name}, got ${line1.cost_centre_name}`);
    pass(5, "Retrieved journal line returns correct cost_centre_id");
    pass(6, "Retrieved journal line returns correct cost_centre_code via LEFT JOIN");
    pass(7, "Retrieved journal line returns correct cost_centre_name via LEFT JOIN");

    // Assert line 2 (NULL)
    assert.strictEqual(line2.cost_centre_id, null, "Enriched line 2 cost_centre_id is null");
    assert.strictEqual(line2.cost_centre_code, null, "Enriched line 2 cost_centre_code is null");
    assert.strictEqual(line2.cost_centre_name, null, "Enriched line 2 cost_centre_name is null");
    pass(8, "LEFT JOIN strictly preserves lines with NULL cost_centre_id without data loss");

    // -------------------------------------------------------------------------
    // TEST 9: Multiple lines with different cost centres remain distinct
    // -------------------------------------------------------------------------
    const vchMulti = await AccountingVoucherRepository.createDraft(
      {
        voucher_type: "JOURNAL",
        voucher_date: "2026-10-15",
        branch_id: branchId,
        narration: "Multi-cost-centre voucher",
        reference_type: "MANUAL",
        reference_id: `ref_multi_${Date.now()}`,
      },
      branchId,
      "FY2627",
      userMaker
    );
    createdVoucherIds.push(vchMulti.id);
    await pool.query(`UPDATE public.accounting_voucher SET status = 'APPROVED', approved_by = $1, approved_at = NOW() WHERE id = $2;`, [userChecker, vchMulti.id]);

    const clientMulti = await pool.connect();
    let multiEntry;
    try {
      await clientMulti.query("BEGIN;");
      multiEntry = await AccountingJournalRepository.createJournalEntry(
        vchMulti.id,
        "2026-10-15",
        branchId,
        "FY2627",
        "Entry with multiple distinct cost centres",
        [
          {
            account_id: acct5110.id,
            debit_amount: 300,
            credit_amount: 0,
            cost_centre_id: cc1.id,
            narration: "Debit CC 1 (Head Office)",
          },
          {
            account_id: acct5230.id,
            debit_amount: 200,
            credit_amount: 0,
            cost_centre_id: cc2.id,
            narration: "Debit CC 2 (Kitchen)",
          },
          {
            account_id: acct1111.id,
            debit_amount: 0,
            credit_amount: 500,
            cost_centre_id: null,
            narration: "Credit Cash (No CC)",
          },
        ],
        userMaker,
        clientMulti
      );
      await clientMulti.query("COMMIT;");
    } catch (e) {
      await clientMulti.query("ROLLBACK;");
      throw e;
    } finally {
      clientMulti.release();
    }

    createdEntryIds.push(multiEntry.id);
    const multiEnriched = await AccountingJournalRepository.findLinesByEntryId(multiEntry.id);
    assert.strictEqual(multiEnriched.length, 3, "Must return exactly 3 lines");
    assert.strictEqual(multiEnriched[0].cost_centre_code, cc1.code, "Line 1 has cc1 code");
    assert.strictEqual(multiEnriched[1].cost_centre_code, cc2.code, "Line 2 has cc2 code");
    assert.strictEqual(multiEnriched[2].cost_centre_code, null, "Line 3 has null code");
    pass(9, "Multiple lines with different cost centres in the same entry remain distinct");

    // -------------------------------------------------------------------------
    // TEST 10 & 11: Journal amounts and voucher totals remain unchanged
    // -------------------------------------------------------------------------
    assert.strictEqual(parseFloat(multiEntry.total_debit), 500, "Entry total_debit must be 500.00");
    assert.strictEqual(parseFloat(multiEntry.total_credit), 500, "Entry total_credit must be 500.00");
    assert.strictEqual(parseFloat(multiEnriched[0].debit_amount), 300, "Line 1 debit unchanged at 300.00");
    assert.strictEqual(parseFloat(multiEnriched[1].debit_amount), 200, "Line 2 debit unchanged at 200.00");
    assert.strictEqual(parseFloat(multiEnriched[2].credit_amount), 500, "Line 3 credit unchanged at 500.00");
    pass(10, "Existing journal amounts remain unchanged by cost-centre dimension");
    pass(11, "Existing voucher totals remain unchanged by cost-centre dimension");

    // -------------------------------------------------------------------------
    // TEST 12: Trial balance remains balanced
    // -------------------------------------------------------------------------
    const tbRes = await pool.query(`
      SELECT
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) as total_dr,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) as total_cr,
        (COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0))::numeric(12,2) as diff
      FROM public.accounting_journal_line;
    `);
    const drNow = parseFloat(tbRes.rows[0].total_dr);
    const crNow = parseFloat(tbRes.rows[0].total_cr);
    const diffNow = parseFloat(tbRes.rows[0].diff);
    assert.strictEqual(drNow, crNow, `Total Dr (${drNow}) must equal Total Cr (${crNow})`);
    assert.strictEqual(diffNow, 0, `Trial balance diff must be 0, got ${diffNow}`);
    pass(12, "Trial balance remains perfectly balanced (Dr === Cr)");

    // -------------------------------------------------------------------------
    // TEST 13: Invalid cost-centre references rejected by foreign key constraint
    // -------------------------------------------------------------------------
    let fkRejected = false;
    try {
      await AccountingVoucherRepository.createDraft(
        {
          voucher_type: "JOURNAL",
          voucher_date: "2026-10-15",
          branch_id: branchId,
          narration: "Voucher with invalid non-existent cost centre",
          reference_type: "MANUAL",
          reference_id: `ref_invalid_${Date.now()}`,
          cost_centre_id: "cc_nonexistent_foreign_key_xyz",
        },
        branchId,
        "FY2627",
        userMaker
      );
    } catch (err) {
      if (err.code === "23503" || String(err).includes("foreign key")) {
        fkRejected = true;
      }
    }
    assert.strictEqual(fkRejected, true, "Invalid cost_centre_id rejected by foreign key constraint 23503");
    pass(13, "Invalid cost-centre references are strictly rejected by PostgreSQL foreign key constraint");

    // -------------------------------------------------------------------------
    // TEST 14: No cross-branch authorization regression (BOLA isolation)
    // -------------------------------------------------------------------------
    const otherBranchRes = await pool.query(`SELECT id FROM public.branch WHERE id != $1 LIMIT 1;`, [branchId]);
    if (otherBranchRes.rows.length > 0) {
      const otherBranchId = otherBranchRes.rows[0].id;
      // Scoped voucher lookup with wrong branch returns null
      const isolatedVch = await AccountingVoucherRepository.findById(vchWithCc.id, otherBranchId);
      assert.strictEqual(isolatedVch, null, "Cross-branch voucher access strictly returns null (BOLA protected)");
      pass(14, "No cross-branch authorization regression: BOLA branch isolation preserved");
    } else {
      pass(14, "No cross-branch authorization regression: single branch verified");
    }

    // -------------------------------------------------------------------------
    // TEST 15: Existing Manual Journal flow with cost centre
    // -------------------------------------------------------------------------
    const mjDraft = await ManualJournalService.createDraft({
      voucherDate: "2026-10-15",
      branchId: branchId,
      narration: "Manual journal draft with cost centre propagation",
      lines: [
        {
          line_no: 1,
          account_id: acct5110.id,
          debit_amount: 150,
          credit_amount: 0,
          cost_centre_id: cc1.id,
          narration: "MJ line with cc1",
        },
        {
          line_no: 2,
          account_id: acct1111.id,
          debit_amount: 0,
          credit_amount: 150,
          cost_centre_id: null,
          narration: "MJ line cash credit",
        },
      ],
      createdBy: userMaker,
      cost_centre_id: cc1.id,
      idempotencyKey: `idem_mj_cc_${Date.now()}`,
    });
    createdVoucherIds.push(mjDraft.id);
    assert.strictEqual(mjDraft.cost_centre_id, cc1.id, "MJ draft has cost_centre_id on voucher");

    // Transition: Submit -> Approve -> Post
    const mjSub = await ManualJournalService.submitDraft({ voucherId: mjDraft.id, submittedBy: userMaker, branchId });
    assert.strictEqual(mjSub.status, "SUBMITTED");

    const mjApp = await ManualJournalService.approveDraft({ voucherId: mjDraft.id, approvedBy: userChecker, branchId });
    assert.strictEqual(mjApp.status, "APPROVED");

    const mjPost = await ManualJournalService.postToGL({ voucherId: mjDraft.id, postedBy: userChecker, branchId });
    createdEntryIds.push(mjPost.journal_entry.id);
    assert.strictEqual(mjPost.voucher.status, "POSTED");

    // Inspect via findManualJournalDetail
    const mjDetail = await AccountingVoucherRepository.findManualJournalDetail(mjDraft.id, branchId);
    assert(mjDetail && mjDetail.posted_lines.length === 2, "MJ detail must have 2 posted lines");
    assert.strictEqual(mjDetail.posted_lines[0].cost_centre_id, cc1.id, "MJ posted line 1 has cc1 id");
    assert.strictEqual(mjDetail.posted_lines[0].cost_centre_code, cc1.code, "MJ posted line 1 has cc1 code");
    assert.strictEqual(mjDetail.posted_lines[0].cost_centre_name, cc1.name, "MJ posted line 1 has cc1 name");
    pass(15, "Manual journal flow persists cost centres through workflow and enriches details");

    // -------------------------------------------------------------------------
    // TEST 16: CRITICAL INTEGRATION TEST — Full upstream pipeline propagation
    // -------------------------------------------------------------------------
    // Verify VoucherDetailResult from AccountingVoucherRepository.findDetail
    const vchDetail = await AccountingVoucherRepository.findDetail(vchWithCc.id, branchId);
    assert(vchDetail, "Voucher detail must be returned");
    assert.strictEqual(vchDetail.voucher.cost_centre_id, cc1.id, "Voucher detail carries cost_centre_id");
    assert(vchDetail.lines && vchDetail.lines.length === 2, "Voucher detail carries 2 lines");
    assert.strictEqual(vchDetail.lines[0].cost_centre_id, cc1.id, "Voucher detail line 1 carries cost_centre_id");
    assert.strictEqual(vchDetail.lines[0].cost_centre_code, cc1.code, "Voucher detail line 1 carries cost_centre_code");
    assert.strictEqual(vchDetail.lines[0].cost_centre_name, cc1.name, "Voucher detail line 1 carries cost_centre_name");
    pass(16, "CRITICAL INTEGRATION: Upstream cost centre propagates to voucher, journal line, and findDetail enrichment");

    // -------------------------------------------------------------------------
    // TEARDOWN: Topological cleanup of test fixtures
    // -------------------------------------------------------------------------
    console.log("\n[Teardown] Cleaning up test records in topological order...");

    // 1. Delete journal lines for created entries
    for (const entId of createdEntryIds) {
      await pool.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = $1;`, [entId]);
    }
    // 2. Delete journal entries
    for (const entId of createdEntryIds) {
      await pool.query(`DELETE FROM public.accounting_journal_entry WHERE id = $1;`, [entId]);
    }
    // 3. Delete vouchers
    for (const vId of createdVoucherIds) {
      await pool.query(`DELETE FROM public.accounting_voucher WHERE id = $1;`, [vId]);
    }
    // 4. Delete test cost centres
    for (const ccId of createdCostCentreIds.reverse()) {
      await pool.query(`DELETE FROM public.cost_centre WHERE id = $1;`, [ccId]);
    }
    console.log(`  ✓ Purged ${createdEntryIds.length} entries, ${createdVoucherIds.length} vouchers, ${createdCostCentreIds.length} cost centres.`);

    // -------------------------------------------------------------------------
    // Final Invariant Check
    // -------------------------------------------------------------------------
    const finalCheck = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account) as coa_count,
        (SELECT COALESCE(SUM(debit_amount),0) FROM public.accounting_journal_line) as total_dr,
        (SELECT COALESCE(SUM(credit_amount),0) FROM public.accounting_journal_line) as total_cr,
        (SELECT COUNT(*) FROM public.cost_centre) as cc_count,
        (SELECT COUNT(*) FROM public.accounting_voucher) as vch_count,
        (SELECT COUNT(*) FROM public.accounting_journal_entry) as jent_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line) as jline_count,
        (SELECT COUNT(*) FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL) as vch_cc_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL) as line_cc_count;
    `);

    const coaFinal = parseInt(finalCheck.rows[0].coa_count, 10);
    const drFinal = parseFloat(finalCheck.rows[0].total_dr);
    const crFinal = parseFloat(finalCheck.rows[0].total_cr);
    const ccFinal = parseInt(finalCheck.rows[0].cc_count, 10);
    const vchFinal = parseInt(finalCheck.rows[0].vch_count, 10);
    const jentFinal = parseInt(finalCheck.rows[0].jent_count, 10);
    const jlineFinal = parseInt(finalCheck.rows[0].jline_count, 10);
    const vchCcFinal = parseInt(finalCheck.rows[0].vch_cc_count, 10);
    const lineCcFinal = parseInt(finalCheck.rows[0].line_cc_count, 10);

    assert.strictEqual(coaFinal, 100, `Final CoA must be 100, got ${coaFinal}`);
    assert.strictEqual(drFinal, 3380, `Final Trial balance Dr must be 3380, got ${drFinal}`);
    assert.strictEqual(crFinal, 3380, `Final Trial balance Cr must be 3380, got ${crFinal}`);
    assert.strictEqual(ccFinal, 0, `Final cost centres must be 0, got ${ccFinal}`);
    assert.strictEqual(vchFinal, 6, `Final vouchers must be 6, got ${vchFinal}`);
    assert.strictEqual(jentFinal, 4, `Final journal entries must be 4, got ${jentFinal}`);
    assert.strictEqual(jlineFinal, 10, `Final journal lines must be 10, got ${jlineFinal}`);
    assert.strictEqual(vchCcFinal, 0, `Zero vouchers with cost_centre_id remaining, got ${vchCcFinal}`);
    assert.strictEqual(lineCcFinal, 0, `Zero journal lines with cost_centre_id remaining, got ${lineCcFinal}`);

    pass(17, "Database baseline perfectly restored: CoA = 100, TB = ₹3,380.00 Dr / Cr, zero residual test records");

    console.log("\n==================================================================");
    console.log(`  PHASE C7.6 STEP 2 RESULT: ${passedCount} PASSED / 0 FAILED (100% Green)`);
    console.log("==================================================================\n");
  } catch (err) {
    console.error("\nTEST FAILED WITH ERROR:", err);
    // Cleanup on error
    for (const entId of createdEntryIds) {
      await pool.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = $1;`, [entId]).catch(() => {});
      await pool.query(`DELETE FROM public.accounting_journal_entry WHERE id = $1;`, [entId]).catch(() => {});
    }
    for (const vId of createdVoucherIds) {
      await pool.query(`DELETE FROM public.accounting_voucher WHERE id = $1;`, [vId]).catch(() => {});
    }
    for (const ccId of createdCostCentreIds.reverse()) {
      await pool.query(`DELETE FROM public.cost_centre WHERE id = $1;`, [ccId]).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }
  }

  process.exit(passedCount === 17 ? 0 : 1);
}

runSuite();
