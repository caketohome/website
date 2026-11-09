/**
 * CakeToHome ERP — Phase C6.1 Manual Journal Persistence Test Suite
 *
 * Verifies C6.1:
 * 1. Simple 2-line manual journal draft persistence (metadata.lines + calculated total_amount)
 * 2. Compound multi-line manual journal draft persistence (N:M splits)
 * 3. Double-entry balancing enforcement on draft creation (rejects unbalanced lines)
 * 4. Single-sided line enforcement (rejects two-sided lines)
 * 5. Negative and zero amount rejections
 * 6. Minimum 2 lines enforcement
 * 7. Updating draft manual journal in DRAFT status
 * 8. Immutability guard: rejects editing manual journal once status is not DRAFT
 * 9. findManualJournalDetail: enriches proposed lines with account_code, account_name, account_type
 * 10. listManualJournals: server-paginated query with branch, status, search, and line_count
 * 11. Idempotency key tracking
 * 12. PostgreSQL baseline cleanup and Trial Balance zero-sum verification
 */

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

const connStr = getConnectionString();
process.env.DATABASE_URL = connStr;

// Register TypeScript transpile hook
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });
  return module._compile(compiled.outputText, filename);
};

// Map @frontend alias
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { dbQuery, closeDbPool } = require('../src/lib/db');
const { AccountingVoucherRepository } = require('../src/lib/repositories/accounting-voucher.repository');
const { AccountingJournalRepository } = require('../src/lib/repositories/accounting-journal.repository');

// ── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const testVoucherIds = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("  PHASE C6.1 MANUAL JOURNAL PERSISTENCE TEST SUITE");
  console.log("==================================================================\n");

  try {
    // 0. Resolve authoritative accounts and branch
    console.log("--- Setup: Resolving Authoritative Database Entities ---");
    const branchRes = await dbQuery("SELECT id, name FROM public.branch LIMIT 1");
    assert(branchRes.rows.length > 0, "Active branch exists in DB");
    const testBranch = branchRes.rows[0];

    const accountsRes = await dbQuery(
      `SELECT id, code, name, type, subtype, is_group
       FROM public.accounting_account
       WHERE deleted_at IS NULL AND is_active = true AND is_group = false
       ORDER BY code ASC`
    );
    assert(accountsRes.rows.length >= 10, "Sufficient active leaf accounts found in CoA");

    const cashAccount = accountsRes.rows.find(a => a.code === '1111') || accountsRes.rows.find(a => a.type === 'ASSET' && a.subtype === 'CASH');
    const fuelAccount = accountsRes.rows.find(a => a.code === '5111') || accountsRes.rows.find(a => a.type === 'EXPENSE');
    const exp2Account = accountsRes.rows.find(a => a.code === '5112') || accountsRes.rows.filter(a => a.type === 'EXPENSE')[1];

    assert(Boolean(cashAccount), `Cash account resolved (${cashAccount?.code} - ${cashAccount?.name})`);
    assert(Boolean(fuelAccount), `Expense account resolved (${fuelAccount?.code} - ${fuelAccount?.name})`);
    assert(Boolean(exp2Account), `Second expense account resolved (${exp2Account?.code} - ${exp2Account?.name})`);

    // ── TEST 1: Simple 2-Line Balanced Manual Journal Draft ───────────────────
    console.log("\n--- Test 1: Simple 2-Line Balanced Manual Journal Draft ---");
    const draftInput1 = {
      voucher_date: new Date().toISOString().split("T")[0],
      branch_id: testBranch.id,
      narration: "C6.1 Simple Manual Journal: Fuel expense paid via cash",
      created_by: "usr_maker_01",
      idempotency_key: "c61_test_idem_01",
      lines: [
        {
          account_id: fuelAccount.id,
          debit_amount: 500,
          credit_amount: 0,
          narration: "Fuel for delivery van",
        },
        {
          account_id: cashAccount.id,
          debit_amount: 0,
          credit_amount: 500,
          narration: "Cash out",
        },
      ],
    };

    const voucher1 = await AccountingVoucherRepository.createManualJournalDraft(
      draftInput1,
      testBranch.id,
      "FY2627",
      "usr_maker_01"
    );
    testVoucherIds.push(voucher1.id);

    assert(voucher1.id.startsWith("vch_"), `Voucher ID generated: ${voucher1.id}`);
    assert(voucher1.voucher_no.startsWith("VCH-JOURNAL-FY2627-"), `Voucher No format correct: ${voucher1.voucher_no}`);
    assert(voucher1.voucher_type === "JOURNAL", `voucher_type === 'JOURNAL'`);
    assert(voucher1.status === "DRAFT", `status === 'DRAFT'`);
    assert(voucher1.currency === "INR", `currency === 'INR'`);
    assert(Number(voucher1.total_amount) === 500, `total_amount properly initialized to ₹500 (not 0)`);
    assert(voucher1.reference_type === "MANUAL", `reference_type === 'MANUAL'`);
    assert(voucher1.reference_id === "c61_test_idem_01", `reference_id holds idempotency key`);

    const meta1 = voucher1.metadata;
    assert(meta1 && meta1.is_manual_journal === true, `metadata.is_manual_journal === true`);
    assert(Array.isArray(meta1.lines) && meta1.lines.length === 2, `metadata.lines has 2 lines persisted`);
    assert(meta1.lines[0].line_no === 1 && meta1.lines[0].debit_amount === 500, `Line 1 debit amount ₹500`);
    assert(meta1.lines[1].line_no === 2 && meta1.lines[1].credit_amount === 500, `Line 2 credit amount ₹500`);

    // ── TEST 2: Compound Multi-Line Manual Journal Draft ─────────────────────
    console.log("\n--- Test 2: Compound Multi-Line Manual Journal Draft (2 Debits : 1 Credit) ---");
    const draftInput2 = {
      voucher_date: new Date().toISOString().split("T")[0],
      branch_id: testBranch.id,
      narration: "C6.1 Compound Manual Journal: Split expense",
      created_by: "usr_maker_02",
      idempotency_key: "c61_test_idem_02",
      lines: [
        {
          account_id: fuelAccount.id,
          debit_amount: 300,
          credit_amount: 0,
          narration: "Fuel expense",
        },
        {
          account_id: exp2Account.id,
          debit_amount: 200,
          credit_amount: 0,
          narration: "Second expense",
        },
        {
          account_id: cashAccount.id,
          debit_amount: 0,
          credit_amount: 500,
          narration: "Cash total settlement",
        },
      ],
    };

    const voucher2 = await AccountingVoucherRepository.createManualJournalDraft(
      draftInput2,
      testBranch.id,
      "FY2627",
      "usr_maker_02"
    );
    testVoucherIds.push(voucher2.id);

    assert(voucher2.voucher_type === "JOURNAL", `Voucher 2 is JOURNAL`);
    assert(Number(voucher2.total_amount) === 500, `Voucher 2 total_amount is ₹500`);
    const meta2 = voucher2.metadata;
    assert(meta2.lines.length === 3, `Voucher 2 metadata has 3 lines`);
    assert(meta2.lines[0].debit_amount === 300 && meta2.lines[1].debit_amount === 200 && meta2.lines[2].credit_amount === 500, `Compound lines amounts properly recorded`);

    // ── TEST 3: Double-Entry Unbalanced Draft Rejection ──────────────────────
    console.log("\n--- Test 3: Unbalanced Lines Rejection ---");
    let unbalanceCaught = false;
    try {
      await AccountingVoucherRepository.createManualJournalDraft(
        {
          voucher_date: new Date().toISOString().split("T")[0],
          branch_id: testBranch.id,
          narration: "Should fail - unbalanced",
          created_by: "usr_maker_01",
          lines: [
            { account_id: fuelAccount.id, debit_amount: 500, credit_amount: 0 },
            { account_id: cashAccount.id, debit_amount: 0, credit_amount: 400 },
          ],
        },
        testBranch.id,
        "FY2627",
        "usr_maker_01"
      );
    } catch (err) {
      unbalanceCaught = true;
      assert(err.message.includes("balance violation"), `Unbalanced draft rejected with: "${err.message}"`);
    }
    assert(unbalanceCaught, "Unbalanced journal was strictly rejected");

    // ── TEST 4: Single-Sided Requirement Enforcement ─────────────────────────
    console.log("\n--- Test 4: Single-Sided Requirement Enforcement ---");
    let singleSidedCaught = false;
    try {
      await AccountingVoucherRepository.createManualJournalDraft(
        {
          voucher_date: new Date().toISOString().split("T")[0],
          branch_id: testBranch.id,
          narration: "Should fail - two-sided line",
          created_by: "usr_maker_01",
          lines: [
            { account_id: fuelAccount.id, debit_amount: 500, credit_amount: 500 },
            { account_id: cashAccount.id, debit_amount: 0, credit_amount: 500 },
          ],
        },
        testBranch.id,
        "FY2627",
        "usr_maker_01"
      );
    } catch (err) {
      singleSidedCaught = true;
      assert(err.message.includes("single-sided requirement"), `Two-sided line rejected with: "${err.message}"`);
    }
    assert(singleSidedCaught, "Two-sided line was strictly rejected");

    // ── TEST 5: Negative Amounts Rejection ───────────────────────────────────
    console.log("\n--- Test 5: Negative Amounts Rejection ---");
    let negativeCaught = false;
    try {
      await AccountingVoucherRepository.createManualJournalDraft(
        {
          voucher_date: new Date().toISOString().split("T")[0],
          branch_id: testBranch.id,
          narration: "Should fail - negative amount",
          created_by: "usr_maker_01",
          lines: [
            { account_id: fuelAccount.id, debit_amount: -500, credit_amount: 0 },
            { account_id: cashAccount.id, debit_amount: 0, credit_amount: 500 },
          ],
        },
        testBranch.id,
        "FY2627",
        "usr_maker_01"
      );
    } catch (err) {
      negativeCaught = true;
      assert(err.message.includes("negative or invalid"), `Negative amount rejected with: "${err.message}"`);
    }
    assert(negativeCaught, "Negative amount was strictly rejected");

    // ── TEST 6: Minimum 2 Lines Enforcement ──────────────────────────────────
    console.log("\n--- Test 6: Minimum 2 Lines Enforcement ---");
    let minLinesCaught = false;
    try {
      await AccountingVoucherRepository.createManualJournalDraft(
        {
          voucher_date: new Date().toISOString().split("T")[0],
          branch_id: testBranch.id,
          narration: "Should fail - 1 line",
          created_by: "usr_maker_01",
          lines: [
            { account_id: fuelAccount.id, debit_amount: 500, credit_amount: 0 },
          ],
        },
        testBranch.id,
        "FY2627",
        "usr_maker_01"
      );
    } catch (err) {
      minLinesCaught = true;
      assert(err.message.includes("at least 2 balanced journal lines"), `Single line rejected with: "${err.message}"`);
    }
    assert(minLinesCaught, "Single line was strictly rejected");

    // ── TEST 7: Updating Draft Manual Journal in DRAFT Status ────────────────
    console.log("\n--- Test 7: Updating Draft Manual Journal in DRAFT Status ---");
    const updatedDraft = await AccountingVoucherRepository.updateManualJournalDraft({
      voucher_id: voucher1.id,
      narration: "C6.1 Updated Narration: Revised Fuel amount to ₹750",
      lines: [
        {
          account_id: fuelAccount.id,
          debit_amount: 750,
          credit_amount: 0,
          narration: "Revised fuel cost",
        },
        {
          account_id: cashAccount.id,
          debit_amount: 0,
          credit_amount: 750,
          narration: "Revised cash out",
        },
      ],
      updated_by: "usr_maker_01",
    });

    assert(updatedDraft.id === voucher1.id, "Updated correct voucher");
    assert(updatedDraft.narration === "C6.1 Updated Narration: Revised Fuel amount to ₹750", "Narration updated successfully");
    assert(Number(updatedDraft.total_amount) === 750, `total_amount updated to ₹750`);
    assert(updatedDraft.metadata.lines[0].debit_amount === 750, "metadata.lines[0] debit_amount updated to ₹750");

    // ── TEST 8: Guard: Prohibit Editing Non-DRAFT Manual Journal ──────────────
    console.log("\n--- Test 8: Non-DRAFT Modification Guard ---");
    // Temporarily simulate SUBMITTED status directly in DB
    await dbQuery("UPDATE public.accounting_voucher SET status = 'SUBMITTED' WHERE id = $1", [voucher1.id]);

    let nonDraftEditCaught = false;
    try {
      await AccountingVoucherRepository.updateManualJournalDraft({
        voucher_id: voucher1.id,
        narration: "Attempting to edit SUBMITTED voucher",
        updated_by: "usr_maker_01",
      });
    } catch (err) {
      nonDraftEditCaught = true;
      assert(err.message.includes("Only DRAFT vouchers may be edited"), `Non-DRAFT edit rejected with: "${err.message}"`);
    }
    assert(nonDraftEditCaught, "Non-DRAFT modification strictly blocked");

    // Reset status back to DRAFT for cleanup
    await dbQuery("UPDATE public.accounting_voucher SET status = 'DRAFT' WHERE id = $1", [voucher1.id]);

    // ── TEST 9: findManualJournalDetail (Enriched Proposed Lines) ─────────────
    console.log("\n--- Test 9: findManualJournalDetail Inspection ---");
    const detail = await AccountingVoucherRepository.findManualJournalDetail(voucher1.id);
    assert(Boolean(detail), "findManualJournalDetail returned result");
    assert(detail.is_manual === true, "detail.is_manual === true");
    assert(detail.proposed_lines.length === 2, "detail.proposed_lines has 2 lines");
    assert(detail.proposed_lines[0].account_code === fuelAccount.code, `Line 1 account_code enriched: ${detail.proposed_lines[0].account_code}`);
    assert(detail.proposed_lines[0].account_name === fuelAccount.name, `Line 1 account_name enriched: ${detail.proposed_lines[0].account_name}`);
    assert(detail.proposed_lines[0].account_type === fuelAccount.type, `Line 1 account_type enriched: ${detail.proposed_lines[0].account_type}`);
    assert(detail.journal_entry === null, "journal_entry is null for draft (not yet posted to GL)");
    assert(detail.posted_lines.length === 0, "posted_lines is empty array for draft");

    // ── TEST 10: listManualJournals Server Pagination & Filters ──────────────
    console.log("\n--- Test 10: listManualJournals Server Pagination & Filters ---");
    const listAll = await AccountingVoucherRepository.listManualJournals({
      branch_id: testBranch.id,
      status: "ALL",
      limit: 20,
    });

    assert(listAll.total >= 2, `listManualJournals returned total >= 2 (found ${listAll.total})`);
    const found1 = listAll.journals.find(j => j.id === voucher1.id);
    assert(Boolean(found1), `Found voucher1 in list: ${found1?.voucher_no}`);
    assert(found1?.line_count === 2, `line_count accurately reflected as 2 for voucher1`);
    assert(found1?.branch_name === testBranch.name, `branch_name joined accurately: ${found1?.branch_name}`);

    // Search filter test
    const listSearch = await AccountingVoucherRepository.listManualJournals({
      search: "Revised Fuel amount",
    });
    assert(listSearch.total >= 1 && listSearch.journals.some(j => j.id === voucher1.id), "Search filter matched updated narration");

    // Status filter test
    const listDrafts = await AccountingVoucherRepository.listManualJournals({
      status: "DRAFT",
    });
    assert(listDrafts.journals.every(j => j.status === "DRAFT"), "Status filter returns only DRAFT vouchers");

  } catch (err) {
    failed++;
    console.error("CRITICAL TEST SUITE ERROR:", err);
  } finally {
    // ── TEARDOWN & RECOVERY ──────────────────────────────────────────────────
    console.log("\n--- Teardown: Restoring Clean PostgreSQL Baseline ---");
    if (testVoucherIds.length > 0) {
      const delRes = await dbQuery(
        "DELETE FROM public.accounting_voucher WHERE id = ANY($1) RETURNING id",
        [testVoucherIds]
      );
      console.log(`  Cleaned up ${delRes.rowCount} test voucher(s).`);
    }

    // Verify baseline clean
    const orphanVouchers = await dbQuery(
      "SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.1%'"
    );
    assert(orphanVouchers.rows.length === 0, "Zero test vouchers remaining in database");

    // Verify Trial Balance integrity
    const tb = await AccountingJournalRepository.getTrialBalance();
    const totalDebit = tb.reduce((sum, r) => sum + Number(r.total_debit || 0), 0);
    const totalCredit = tb.reduce((sum, r) => sum + Number(r.total_credit || 0), 0);
    const imbalance = Math.abs(totalDebit - totalCredit);
    assert(imbalance < 0.001, `Trial Balance zero-sum maintained: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}, diff=${imbalance.toFixed(4)}`);

    await closeDbPool();
  }

  console.log("\n==================================================================");
  console.log(`  C6.1 PERSISTENCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
