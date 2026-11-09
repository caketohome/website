/**
 * CakeToHome ERP — Phase C6.2 ManualJournalService Test Suite
 *
 * Covers all 8 Locked C6.2 Requirements:
 * 1. Draft creation orchestration (accounts, leaf-only, AR/AP party dimensions, INR-only, start date, fiscal period, balance, idempotency)
 * 2. Draft update (only DRAFT, revalidate lines, preserve metadata contract, reject post-submission mutation)
 * 3. Submit (DRAFT -> SUBMITTED, maker identity preserved, audit timestamps)
 * 4. Approve (SUBMITTED -> APPROVED, SoD enforced: maker != checker, no bypass)
 * 5. Post (APPROVED -> POSTED, canonical PostingService, metadata.lines -> journal lines, atomic tx, row locking, no duplicate post)
 * 6. Cancel (pre-posted permitted, never cancel POSTED, audit trail)
 * 7. Reversal orchestration (only posted/unreversed, canonical linkReversal, inverted lines, no reversal-of-reversal, SoD)
 * 8. Error contracts (deterministic ManualJournalDomainError codes)
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
const { ManualJournalService, ManualJournalDomainError } = require('../src/lib/services/manual-journal.service');
const { AccountingJournalRepository } = require('../src/lib/repositories/accounting-journal.repository');

// ── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const testVoucherIds = [];
let createdTestSupplier = false;

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
  console.log("  PHASE C6.2 MANUAL JOURNAL SERVICE DOMAIN TEST SUITE");
  console.log("==================================================================\n");

  try {
    // 0. Setup and entity resolution
    console.log("--- Setup: Resolving Entities ---");
    await dbQuery("DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.2%' OR reference_id LIKE 'c62%'))");
    await dbQuery("DELETE FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.2%' OR reference_id LIKE 'c62%')");
    await dbQuery("DELETE FROM public.accounting_voucher WHERE narration LIKE 'C6.2%' OR reference_id LIKE 'c62%'");
    await dbQuery("DELETE FROM public.supplier WHERE id = 'supp_c62_test_01'");

    const branchRes = await dbQuery("SELECT id, name FROM public.branch LIMIT 1");
    const testBranch = branchRes.rows[0];

    const accountsRes = await dbQuery(
      `SELECT id, code, name, type, subtype, is_group
       FROM public.accounting_account
       WHERE deleted_at IS NULL AND is_active = true
       ORDER BY code ASC`
    );

    const cashAccount = accountsRes.rows.find(a => a.code === '1111');
    const cogsAccount = accountsRes.rows.find(a => a.code === '5110');
    const arAccount = accountsRes.rows.find(a => a.code === '1121');
    const apAccount = accountsRes.rows.find(a => a.code === '2111');
    const groupAccount = accountsRes.rows.find(a => a.is_group === true);

    const customerRes = await dbQuery("SELECT id, first_name, last_name FROM public.customer LIMIT 1");
    const supplierRes = await dbQuery("SELECT id, name FROM public.supplier LIMIT 1");
    const testCustomer = customerRes.rows[0] || null;
    let testSupplier = supplierRes.rows[0] || null;
    createdTestSupplier = false;
    if (!testSupplier) {
      const insRes = await dbQuery(
        `INSERT INTO public.supplier (id, name, is_active, created_by)
         VALUES ($1, $2, true, $3)
         RETURNING id, name`,
        ['supp_c62_test_01', 'Test Supplier C6.2', 'usr_c62_maker_01']
      );
      testSupplier = insRes.rows[0];
      createdTestSupplier = true;
    }

    assert(Boolean(cashAccount && !cashAccount.is_group), `Cash account resolved (${cashAccount?.code})`);
    assert(Boolean(cogsAccount && !cogsAccount.is_group), `COGS account resolved (${cogsAccount?.code})`);
    assert(Boolean(arAccount && !arAccount.is_group), `AR account resolved (${arAccount?.code})`);
    assert(Boolean(apAccount && !apAccount.is_group), `AP account resolved (${apAccount?.code})`);
    assert(Boolean(groupAccount && groupAccount.is_group), `Group account resolved for negative testing (${groupAccount?.code})`);
    assert(Boolean(testCustomer), `Test customer resolved (${testCustomer?.id})`);
    assert(Boolean(testSupplier), `Test supplier resolved (${testSupplier?.id})`);

    // Determine safe date in open fiscal period
    const periodRes = await dbQuery(
      "SELECT start_date, end_date, fiscal_year FROM public.accounting_fiscal_period WHERE is_locked = false ORDER BY start_date ASC LIMIT 1"
    );
    assert(periodRes.rows.length > 0, "Open fiscal period found");
    const safeDate = periodRes.rows[0].start_date;
    console.log(`  Safe testing date: ${safeDate} (Fiscal Year: ${periodRes.rows[0].fiscal_year})`);

    // ── 1. Draft Creation Orchestration ──────────────────────────────────────
    console.log("\n--- 1. Draft Creation Orchestration ---");
    const draft1 = await ManualJournalService.createDraft({
      voucherDate: safeDate,
      branchId: testBranch.id,
      narration: "C6.2 Test 1: Manual Expense Adjustment",
      createdBy: "usr_c62_maker_01",
      idempotencyKey: "c62_idem_01",
      lines: [
        {
          account_id: cogsAccount.id,
          debit_amount: 600,
          credit_amount: 0,
          narration: "Debit COGS",
        },
        {
          account_id: cashAccount.id,
          debit_amount: 0,
          credit_amount: 600,
          narration: "Credit Cash",
        },
      ],
    });
    testVoucherIds.push(draft1.id);

    assert(draft1.voucher_type === "JOURNAL", "draft1.voucher_type === 'JOURNAL'");
    assert(draft1.status === "DRAFT", "draft1.status === 'DRAFT'");
    assert(draft1.currency === "INR", "draft1.currency === 'INR' (INR-only)");
    assert(Number(draft1.total_amount) === 600, "draft1.total_amount === 600");
    assert(draft1.created_by === "usr_c62_maker_01", "draft1.created_by === 'usr_c62_maker_01'");

    // ── 2. Group Account Rejection ───────────────────────────────────────────
    console.log("\n--- 2. Group Account Rejection ---");
    let groupCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Should fail - group account",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: groupAccount.id, debit_amount: 600, credit_amount: 0 },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 600 },
        ],
      });
    } catch (err) {
      groupCaught = true;
      assert(err instanceof ManualJournalDomainError, "Error is ManualJournalDomainError");
      assert(err.code === "GROUP_ACCOUNT_NOT_POSTABLE", `Error code is GROUP_ACCOUNT_NOT_POSTABLE (got ${err.code})`);
    }
    assert(groupCaught, "Group account direct posting was strictly blocked");

    // ── 3. Invalid Account Rejection ─────────────────────────────────────────
    console.log("\n--- 3. Invalid Account Rejection ---");
    let invalidAcctCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Should fail - invalid account",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: "acct_non_existent_id", debit_amount: 600, credit_amount: 0 },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 600 },
        ],
      });
    } catch (err) {
      invalidAcctCaught = true;
      assert(err.code === "POSTING_ACCOUNT_INVALID", `Error code is POSTING_ACCOUNT_INVALID (got ${err.code})`);
    }
    assert(invalidAcctCaught, "Non-existent account rejected");

    // ── 4. AR Party Dimension Validation (customer_id) ──────────────────────
    console.log("\n--- 4. AR Party Dimension Validation ---");
    // 4a. Valid customer on AR line
    const arDraft = await ManualJournalService.createDraft({
      voucherDate: safeDate,
      branchId: testBranch.id,
      narration: "C6.2 AR Adjustment with customer",
      createdBy: "usr_c62_maker_01",
      idempotencyKey: "c62_ar_valid_01",
      lines: [
        {
          account_id: arAccount.id,
          debit_amount: 450,
          credit_amount: 0,
          customer_id: testCustomer.id,
        },
        {
          account_id: cashAccount.id,
          debit_amount: 0,
          credit_amount: 450,
        },
      ],
    });
    testVoucherIds.push(arDraft.id);
    assert(arDraft.metadata.lines[0].customer_id === testCustomer.id, "Valid customer_id preserved on AR line");

    // 4b. Non-existent customer on AR line -> rejected
    let badCustCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Should fail - non-existent customer",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: arAccount.id, debit_amount: 450, credit_amount: 0, customer_id: "cust_fake_999" },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 450 },
        ],
      });
    } catch (err) {
      badCustCaught = true;
      assert(err.code === "PARTY_DIMENSION_INVALID", `Non-existent customer rejected with PARTY_DIMENSION_INVALID (got ${err.code})`);
    }
    assert(badCustCaught, "Non-existent customer strictly rejected");

    // 4c. Supplier on AR line -> rejected
    let suppOnArCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Should fail - supplier on AR",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: arAccount.id, debit_amount: 450, credit_amount: 0, supplier_id: testSupplier.id },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 450 },
        ],
      });
    } catch (err) {
      suppOnArCaught = true;
      assert(err.code === "PARTY_DIMENSION_INVALID", `Supplier on AR rejected with PARTY_DIMENSION_INVALID (got ${err.code})`);
    }
    assert(suppOnArCaught, "Supplier on AR line strictly rejected");

    // ── 5. AP Party Dimension Validation (supplier_id) ──────────────────────
    console.log("\n--- 5. AP Party Dimension Validation ---");
    // 5a. Valid supplier on AP line
    const apDraft = await ManualJournalService.createDraft({
      voucherDate: safeDate,
      branchId: testBranch.id,
      narration: "C6.2 AP Adjustment with supplier",
      createdBy: "usr_c62_maker_01",
      idempotencyKey: "c62_ap_valid_01",
      lines: [
        {
          account_id: cashAccount.id,
          debit_amount: 350,
          credit_amount: 0,
        },
        {
          account_id: apAccount.id,
          debit_amount: 0,
          credit_amount: 350,
          supplier_id: testSupplier.id,
        },
      ],
    });
    testVoucherIds.push(apDraft.id);
    assert(apDraft.metadata.lines[1].supplier_id === testSupplier.id, "Valid supplier_id preserved on AP line");

    // 5b. Customer on AP line -> rejected
    let custOnApCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Should fail - customer on AP",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: cashAccount.id, debit_amount: 350, credit_amount: 0 },
          { account_id: apAccount.id, debit_amount: 0, credit_amount: 350, customer_id: testCustomer.id },
        ],
      });
    } catch (err) {
      custOnApCaught = true;
      assert(err.code === "PARTY_DIMENSION_INVALID", `Customer on AP rejected with PARTY_DIMENSION_INVALID (got ${err.code})`);
    }
    assert(custOnApCaught, "Customer on AP line strictly rejected");

    // ── 6. Party Dimension Clearance on Unrelated Accounts ───────────────────
    console.log("\n--- 6. Party Dimension Clearance on Unrelated Accounts ---");
    const unrelatedDraft = await ManualJournalService.createDraft({
      voucherDate: safeDate,
      branchId: testBranch.id,
      narration: "C6.2 Party clearance on non-party accounts",
      createdBy: "usr_c62_maker_01",
      idempotencyKey: "c62_party_clear_01",
      lines: [
        {
          account_id: cogsAccount.id,
          debit_amount: 200,
          credit_amount: 0,
          customer_id: testCustomer.id, // should be nullified
        },
        {
          account_id: cashAccount.id,
          debit_amount: 0,
          credit_amount: 200,
          supplier_id: testSupplier.id, // should be nullified
        },
      ],
    });
    testVoucherIds.push(unrelatedDraft.id);
    assert(unrelatedDraft.metadata.lines[0].customer_id === null, "customer_id on COGS line was nullified per Rule 5");
    assert(unrelatedDraft.metadata.lines[1].supplier_id === null, "supplier_id on Cash line was nullified per Rule 5");

    // ── 7. Accounting Start Date Guard ───────────────────────────────────────
    console.log("\n--- 7. Accounting Start Date Guard ---");
    let startDateCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: "2019-01-01",
        branchId: testBranch.id,
        narration: "Should fail - before accounting start date",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: cogsAccount.id, debit_amount: 100, credit_amount: 0 },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 100 },
        ],
      });
    } catch (err) {
      startDateCaught = true;
      assert(err.code === "POSTING_BEFORE_ACCOUNTING_START_DATE", `Rejected with code POSTING_BEFORE_ACCOUNTING_START_DATE (got ${err.code})`);
    }
    assert(startDateCaught, "Posting prior to accounting start date blocked");

    // ── 8. Open Fiscal Period Guard ──────────────────────────────────────────
    console.log("\n--- 8. Open Fiscal Period Guard ---");
    let periodCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: "2038-06-15",
        branchId: testBranch.id,
        narration: "Should fail - unconfigured fiscal period",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: cogsAccount.id, debit_amount: 100, credit_amount: 0 },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 100 },
        ],
      });
    } catch (err) {
      periodCaught = true;
      assert(err.code === "FISCAL_PERIOD_NOT_CONFIGURED", `Rejected with code FISCAL_PERIOD_NOT_CONFIGURED (got ${err.code})`);
    }
    assert(periodCaught, "Posting to unconfigured fiscal period blocked");

    // ── 9. Double-Entry Balance Validation ───────────────────────────────────
    console.log("\n--- 9. Double-Entry Balance Validation ---");
    let unbalCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Should fail - unbalanced",
        createdBy: "usr_c62_maker_01",
        lines: [
          { account_id: cogsAccount.id, debit_amount: 500, credit_amount: 0 },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 490 },
        ],
      });
    } catch (err) {
      unbalCaught = true;
      assert(err.code === "JOURNAL_UNBALANCED", `Rejected with code JOURNAL_UNBALANCED (got ${err.code})`);
    }
    assert(unbalCaught, "Unbalanced lines strictly blocked");

    // ── 10. Idempotency Guard ────────────────────────────────────────────────
    console.log("\n--- 10. Idempotency Guard ---");
    let idemCaught = false;
    try {
      await ManualJournalService.createDraft({
        voucherDate: safeDate,
        branchId: testBranch.id,
        narration: "Duplicate idempotency attempt",
        createdBy: "usr_c62_maker_01",
        idempotencyKey: "c62_idem_01", // already used in draft1
        lines: [
          { account_id: cogsAccount.id, debit_amount: 600, credit_amount: 0 },
          { account_id: cashAccount.id, debit_amount: 0, credit_amount: 600 },
        ],
      });
    } catch (err) {
      idemCaught = true;
      assert(err.code === "DUPLICATE_SOURCE_EVENT", `Duplicate idempotency rejected with DUPLICATE_SOURCE_EVENT (got ${err.code})`);
    }
    assert(idemCaught, "Duplicate idempotency strictly blocked");

    // ── 11. Draft Update in DRAFT Status ─────────────────────────────────────
    console.log("\n--- 11. Draft Update in DRAFT Status ---");
    const updatedDraft1 = await ManualJournalService.updateDraft({
      voucherId: draft1.id,
      narration: "C6.2 Updated Narration: Revised Fuel amount to ₹800",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 800, credit_amount: 0, narration: "Revised Dr" },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 800, narration: "Revised Cr" },
      ],
      updatedBy: "usr_c62_maker_01",
    });

    assert(updatedDraft1.narration.includes("Revised Fuel amount to ₹800"), "Narration updated");
    assert(Number(updatedDraft1.total_amount) === 800, "total_amount updated to ₹800");
    assert(updatedDraft1.metadata.lines[0].debit_amount === 800, "metadata.lines[0].debit_amount === 800");

    // ── 12. Submit (DRAFT -> SUBMITTED) ──────────────────────────────────────
    console.log("\n--- 12. Submit Draft (DRAFT -> SUBMITTED) ---");
    const submitted1 = await ManualJournalService.submitDraft({
      voucherId: draft1.id,
      submittedBy: "usr_c62_maker_01",
    });

    assert(submitted1.status === "SUBMITTED", "Voucher transitioned to SUBMITTED");
    assert(submitted1.submitted_by === "usr_c62_maker_01", "submitted_by preserved");
    assert(Boolean(submitted1.submitted_at), "submitted_at timestamp recorded");

    // ── 13. Mutation Guard: Reject Editing SUBMITTED Voucher ─────────────────
    console.log("\n--- 13. Mutation Guard (Cannot edit SUBMITTED voucher) ---");
    let editSubmittedCaught = false;
    try {
      await ManualJournalService.updateDraft({
        voucherId: draft1.id,
        narration: "Attempt edit submitted",
        updatedBy: "usr_c62_maker_01",
      });
    } catch (err) {
      editSubmittedCaught = true;
      assert(err.code === "INVALID_VOUCHER_STATE", `Edit submitted rejected with INVALID_VOUCHER_STATE (got ${err.code})`);
    }
    assert(editSubmittedCaught, "Editing submitted voucher strictly blocked");

    // ── 14. Approve: Segregation of Duties Enforcement ───────────────────────
    console.log("\n--- 14. Approve & Segregation of Duties (SoD) ---");
    // 14a. Maker self-approval attempt -> rejected
    let selfApproveCaught = false;
    try {
      await ManualJournalService.approveDraft({
        voucherId: draft1.id,
        approvedBy: "usr_c62_maker_01", // Maker attempting self-approval!
      });
    } catch (err) {
      selfApproveCaught = true;
      assert(err.code === "SEGREGATION_OF_DUTIES_VIOLATION", `Self-approval rejected with SEGREGATION_OF_DUTIES_VIOLATION (got ${err.code})`);
    }
    assert(selfApproveCaught, "Maker self-approval strictly blocked (SoD)");

    // 14b. Distinct Checker approves -> succeeds
    const approved1 = await ManualJournalService.approveDraft({
      voucherId: draft1.id,
      approvedBy: "usr_c62_checker_01", // Distinct checker
    });

    assert(approved1.status === "APPROVED", "Voucher transitioned to APPROVED");
    assert(approved1.approved_by === "usr_c62_checker_01", "approved_by recorded as checker");
    assert(Boolean(approved1.approved_at), "approved_at recorded");

    // ── 15. Post to GL (APPROVED -> POSTED) ──────────────────────────────────
    console.log("\n--- 15. Post to General Ledger (APPROVED -> POSTED) ---");
    // 15a. Maker self-post attempt -> rejected
    let selfPostCaught = false;
    try {
      await ManualJournalService.postToGL({
        voucherId: draft1.id,
        postedBy: "usr_c62_maker_01", // Maker attempting to post!
      });
    } catch (err) {
      selfPostCaught = true;
      assert(err.code === "SEGREGATION_OF_DUTIES_VIOLATION", `Maker self-post rejected with SEGREGATION_OF_DUTIES_VIOLATION (got ${err.code})`);
    }
    assert(selfPostCaught, "Maker self-posting strictly blocked (SoD)");

    // 15b. Distinct GL Poster posts -> succeeds
    const postResult = await ManualJournalService.postToGL({
      voucherId: draft1.id,
      postedBy: "usr_c62_poster_01", // Distinct poster
    });

    assert(postResult.voucher.status === "POSTED", "Voucher status is POSTED");
    assert(postResult.voucher.posted_by === "usr_c62_poster_01", "posted_by is recorded");
    assert(Boolean(postResult.journal_entry), "Journal entry created");
    assert(postResult.journal_entry.lines.length === 2, "2 authoritative journal lines created in accounting_journal_line");
    assert(Number(postResult.journal_entry.total_debit) === 800, "total_debit === 800");
    assert(Number(postResult.journal_entry.total_credit) === 800, "total_credit === 800");

    // Verify in PostgreSQL directly
    const jeDb = await dbQuery("SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1", [draft1.id]);
    assert(jeDb.rows.length === 1, "Journal entry row exists in public.accounting_journal_entry");
    const jlDb = await dbQuery("SELECT * FROM public.accounting_journal_line WHERE journal_entry_id = $1 ORDER BY line_no ASC", [jeDb.rows[0].id]);
    assert(jlDb.rows.length === 2, "2 lines exist in public.accounting_journal_line");
    assert(Number(jlDb.rows[0].debit_amount) === 800 && Number(jlDb.rows[1].credit_amount) === 800, "Journal lines have exact ₹800 debit/credit");

    // ── 16. Duplicate Posting Protection ─────────────────────────────────────
    console.log("\n--- 16. Duplicate Posting Protection ---");
    let dupPostCaught = false;
    try {
      await ManualJournalService.postToGL({
        voucherId: draft1.id,
        postedBy: "usr_c62_poster_01",
      });
    } catch (err) {
      dupPostCaught = true;
      assert(err.code === "VOUCHER_ALREADY_POSTED", `Duplicate post rejected with VOUCHER_ALREADY_POSTED (got ${err.code})`);
    }
    assert(dupPostCaught, "Duplicate posting strictly blocked");

    // ── 17. Cancellation Lifecycle ───────────────────────────────────────────
    console.log("\n--- 17. Cancellation Lifecycle ---");
    // 17a. Pre-posted voucher cancellation -> succeeds
    const cancelDraft = await ManualJournalService.createDraft({
      voucherDate: safeDate,
      branchId: testBranch.id,
      narration: "C6.2 Voucher to be cancelled",
      createdBy: "usr_c62_maker_01",
      idempotencyKey: "c62_cancel_test_01",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 100, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 100 },
      ],
    });
    testVoucherIds.push(cancelDraft.id);

    const cancelled = await ManualJournalService.cancel({
      voucherId: cancelDraft.id,
      cancelledBy: "usr_c62_maker_01",
    });
    assert(cancelled.status === "CANCELLED", "Draft voucher successfully CANCELLED");
    assert(cancelled.cancelled_by === "usr_c62_maker_01", "cancelled_by recorded");

    // 17b. Attempt to cancel a POSTED voucher -> rejected
    let cancelPostedCaught = false;
    try {
      await ManualJournalService.cancel({
        voucherId: draft1.id, // POSTED!
        cancelledBy: "usr_c62_maker_01",
      });
    } catch (err) {
      cancelPostedCaught = true;
      assert(err.code === "INVALID_VOUCHER_STATE", `Cancel posted voucher rejected with INVALID_VOUCHER_STATE (got ${err.code})`);
    }
    assert(cancelPostedCaught, "Cancelling a posted voucher is strictly blocked");

    // ── 18. Reversal Orchestration ───────────────────────────────────────────
    console.log("\n--- 18. Reversal Orchestration ---");
    // 18a. Creator cannot reverse own voucher -> rejected
    let creatorReverseCaught = false;
    try {
      await ManualJournalService.reverse({
        voucherId: draft1.id,
        reversalDate: safeDate,
        reason: "Creator attempting reversal",
        reversedBy: "usr_c62_maker_01", // Voucher creator!
      });
    } catch (err) {
      creatorReverseCaught = true;
      assert(err.code === "SEGREGATION_OF_DUTIES_VIOLATION", `Creator reversal rejected with SEGREGATION_OF_DUTIES_VIOLATION (got ${err.code})`);
    }
    assert(creatorReverseCaught, "Creator cannot reverse own voucher (SoD)");

    // 18b. Distinct financial controller reverses -> succeeds
    const reversalResult = await ManualJournalService.reverse({
      voucherId: draft1.id,
      reversalDate: safeDate,
      reason: "Auditor reversal: Reclassifying fuel expense",
      reversedBy: "usr_c62_controller_01",
    });
    testVoucherIds.push(reversalResult.reversal_voucher.id);

    assert(reversalResult.reversal_voucher.status === "POSTED", "Reversal voucher status is POSTED");
    assert(reversalResult.reversal_voucher.reference_type === "MANUAL_REVERSAL", "reference_type === 'MANUAL_REVERSAL'");
    assert(reversalResult.reversal_voucher.reversal_of_voucher_id === draft1.id, "reversal_of_voucher_id links to original");
    assert(reversalResult.original_voucher.reversed_by_voucher_id === reversalResult.reversal_voucher.id, "original reversed_by_voucher_id links to reversal");

    // Check lines inverted
    const revLines = reversalResult.journal_entry.lines;
    assert(revLines.length === 2, "Compensating reversal journal has 2 lines");
    const origDebitLine = jlDb.rows.find(l => Number(l.debit_amount) > 0);
    const revCreditLine = revLines.find(l => l.account_id === origDebitLine.account_id);
    assert(Number(revCreditLine.credit_amount) === Number(origDebitLine.debit_amount), "Original Dr was strictly inverted to Cr in compensating voucher");

    // Check original journal entry is_reversed = true in DB
    const origJeAfter = await dbQuery("SELECT is_reversed, reversed_at FROM public.accounting_journal_entry WHERE voucher_id = $1", [draft1.id]);
    assert(origJeAfter.rows[0].is_reversed === true, "Original journal entry marked is_reversed = true in PostgreSQL");
    assert(Boolean(origJeAfter.rows[0].reversed_at), "reversed_at timestamp set on original journal entry");

    // ── 19. Double Reversal Protection ───────────────────────────────────────
    console.log("\n--- 19. Double Reversal Protection ---");
    // 19a. Attempt to reverse already reversed voucher -> rejected
    let doubleRevCaught = false;
    try {
      await ManualJournalService.reverse({
        voucherId: draft1.id,
        reversalDate: safeDate,
        reason: "Attempt second reversal",
        reversedBy: "usr_c62_controller_01",
      });
    } catch (err) {
      doubleRevCaught = true;
      assert(err.code === "REVERSAL_VIOLATION", `Second reversal rejected with REVERSAL_VIOLATION (got ${err.code})`);
    }
    assert(doubleRevCaught, "Double reversal strictly blocked");

    // 19b. Attempt to reverse the reversal voucher itself -> rejected
    let revOfRevCaught = false;
    try {
      await ManualJournalService.reverse({
        voucherId: reversalResult.reversal_voucher.id,
        reversalDate: safeDate,
        reason: "Attempt to reverse a reversal voucher",
        reversedBy: "usr_c62_controller_01",
      });
    } catch (err) {
      revOfRevCaught = true;
      assert(err.code === "REVERSAL_VIOLATION", `Reversal-of-reversal rejected with REVERSAL_VIOLATION (got ${err.code})`);
    }
    assert(revOfRevCaught, "Reversal-of-reversal strictly blocked");

    // ── 20. Detail & List Retrieval ──────────────────────────────────────────
    console.log("\n--- 20. Detail & List Retrieval ---");
    const detail = await ManualJournalService.getDetail(draft1.id);
    assert(Boolean(detail), "getDetail returned result");
    assert(detail.voucher.status === "POSTED", "Voucher status is POSTED in detail");
    assert(detail.posted_lines.length === 2, "Authoritative posted_lines has 2 lines");
    assert(detail.proposed_lines.length === 2, "Workflow proposed_lines snapshot preserved in metadata");
    assert(detail.reversal_voucher?.id === reversalResult.reversal_voucher.id, "detail linked reversal_voucher populated");

    const listRes = await ManualJournalService.list({
      branch_id: testBranch.id,
      status: "POSTED",
    });
    assert(listRes.total >= 2, "list returned posted manual journals");

  } catch (err) {
    failed++;
    console.error("CRITICAL DOMAIN SERVICE TEST ERROR:", err);
  } finally {
    // ── TEARDOWN & RECOVERY ──────────────────────────────────────────────────
    console.log("\n--- Teardown: Restoring Clean PostgreSQL Baseline ---");
    if (testVoucherIds.length > 0) {
      // Unlink reversals first to satisfy FKs
      await dbQuery(
        "UPDATE public.accounting_voucher SET reversed_by_voucher_id = NULL, reversal_of_voucher_id = NULL WHERE id = ANY($1)",
        [testVoucherIds]
      );

      // Delete journal lines & entries
      await dbQuery(
        `DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (
          SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)
        )`,
        [testVoucherIds]
      );
      await dbQuery(
        "DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)",
        [testVoucherIds]
      );

      // Delete test vouchers
      const delRes = await dbQuery(
        "DELETE FROM public.accounting_voucher WHERE id = ANY($1) RETURNING id",
        [testVoucherIds]
      );
      console.log(`  Purged ${delRes.rowCount} test voucher(s).`);
    }

    if (createdTestSupplier) {
      await dbQuery("DELETE FROM public.supplier WHERE id = 'supp_c62_test_01'");
    }

    // Verify baseline clean
    const orphanVouchers = await dbQuery(
      "SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.2%'"
    );
    assert(orphanVouchers.rows.length === 0, "Zero C6.2 test vouchers remaining in database");

    // Verify Trial Balance integrity
    const tb = await AccountingJournalRepository.getTrialBalance();
    const totalDebit = tb.reduce((sum, r) => sum + Number(r.total_debit || 0), 0);
    const totalCredit = tb.reduce((sum, r) => sum + Number(r.total_credit || 0), 0);
    const imbalance = Math.abs(totalDebit - totalCredit);
    assert(imbalance < 0.001, `Trial Balance zero-sum maintained: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}, diff=${imbalance.toFixed(4)}`);

    await closeDbPool();
  }

  console.log("\n==================================================================");
  console.log(`  C6.2 DOMAIN TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
