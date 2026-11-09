/**
 * CakeToHome ERP — Phase C5 Comprehensive Integration & Accounting Audit Suite
 *
 * Covers all 6 Steps and 9 Locked Architecture Rules:
 * 1. CoA inspection & Category GL account mapping (authoritative 100 accounts).
 * 2. Settlement Types: DIRECT_PAYMENT vs CREDIT_ACCRUAL (AP 2111 with supplier dimension).
 * 3. Bank & UPI settlement to configured bank GL account (1112 / bank_account.gl_account_id).
 * 4. Cash settlement: Teller drawer custody movement (C4 integration) vs Petty Cash (1114/1111).
 * 5. GST Rules: ITC Eligible vs Ineligible (capitalization per Sec 17(5)) & RCM liability (2121-2129).
 * 6. GL Reversal Engine: Inverted double-entry, reversal linkage, teller redeposit.
 * 7. Strict Segregation of Duties: Creator != Approver != Poster != Reverser (Zero Super Admin bypass).
 * 8. Canonical Voucher Lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED -> REVERSED.
 * 9. Idempotency, Double-Posting, Trial Balance integrity, and clean teardown.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

// Register TypeScript hook
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
const { ExpenseService } = require('../src/lib/services/expense.service');
const { ExpensePostingService } = require('../src/lib/services/expense-posting.service');
const { ExpenseReversalService } = require('../src/lib/services/expense-reversal.service');
const { TellerSessionService } = require('../src/lib/services/teller-session.service');

// ── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const testRecords = {
  expenses: [],
  tellerSessions: [],
  tellers: [],
  users: [],
  suppliers: [],
  bankAccounts: [],
  companies: [],
};

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
  console.log("  PHASE C5 EXPENSE ACCOUNTING & GL INTEGRATION TEST SUITE");
  console.log("==================================================================\n");

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Pre-cleanup any leftover test tellers from earlier partial runs
    const oldTellers = await client.query("SELECT id FROM public.teller WHERE code LIKE 'T-C5%' OR code LIKE 'TC5%'");
    for (const t of oldTellers.rows) {
      await client.query("DELETE FROM public.teller_movement WHERE teller_session_id IN (SELECT id FROM public.teller_session WHERE teller_id = $1)", [t.id]);
      await client.query("DELETE FROM public.teller_session WHERE teller_id = $1", [t.id]);
      await client.query("DELETE FROM public.teller WHERE id = $1", [t.id]);
    }

    // 0. Verify Baseline & Accounts
    console.log("📍 [SUITE 0] Verifying CoA & Active Fiscal Period...");
    const coaRes = await client.query("SELECT COUNT(*) FROM public.accounting_account WHERE deleted_at IS NULL");
    const accountCount = parseInt(coaRes.rows[0].count, 10);
    assert(accountCount === 100, `Live Chart of Accounts count is exactly 100 (got ${accountCount})`);

    const branchRes = await client.query("SELECT id FROM public.branch LIMIT 1");
    const branchId = branchRes.rows[0]?.id || "branch_main";

    const periodRes = await client.query(
      `SELECT * FROM public.accounting_fiscal_period 
       WHERE is_locked = false 
       ORDER BY start_date ASC LIMIT 1`
    );
    assert(periodRes.rows.length > 0, `Active fiscal period exists: ${periodRes.rows[0]?.period_name || 'N/A'}`);
    const p = periodRes.rows[0];
    const start = new Date(p.start_date);
    const end = new Date(p.end_date);
    const midDate = new Date((start.getTime() + end.getTime()) / 2);
    const y = midDate.getUTCFullYear();
    const m = String(midDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(midDate.getUTCDate()).padStart(2, '0');
    const activeDate = `${y}-${m}-${d}`;
    console.log(`  -> Selected safe testing date: ${activeDate} (Fiscal Period: ${p.period_name})`);

    // 1. Verify Category GL mappings
    console.log("\n📍 [SUITE 1] Category GL Mappings & Auto-Resolution...");
    const catRes = await client.query(
      "SELECT id, name, gl_account_code, gl_account_id FROM public.expense_category WHERE deleted_at IS NULL"
    );
    assert(catRes.rows.length >= 11, `All default categories present (${catRes.rows.length} found)`);
    const allHaveGl = catRes.rows.every(r => r.gl_account_code && r.gl_account_id);
    assert(allHaveGl, "All operational expense categories mapped to authoritative GL accounts (5xxx)");
    const suppliesCat = catRes.rows.find(r => r.gl_account_code === '5230') || catRes.rows[0];

    // 2. Direct Cash Expense with Teller Session Integration (C4 + C5)
    console.log("\n📍 [SUITE 2] Direct Cash Expense + C4 Teller Drawer Movement...");
    
    // Create & open dedicated teller session for testing
    const tellerUserId = `usr_c5_${Date.now()}`;
    await client.query(`INSERT INTO "user" (id, email) VALUES ($1, $2)`, [tellerUserId, `${tellerUserId}@test.local`]);
    testRecords.users.push(tellerUserId);

    const tellerCode = `TC5${Date.now().toString().slice(-5)}`;
    const insT = await client.query(
      `INSERT INTO public.teller (branch_id, user_id, code, name, status) VALUES ($1, $2, $3, 'C5 Teller', 'ACTIVE') RETURNING id`,
      [branchId, tellerUserId, tellerCode]
    );
    const tellerId = insT.rows[0].id;
    testRecords.tellers.push(tellerId);

    const tellerActor = {
      userId: tellerUserId,
      role: "STAFF",
      branchId: branchId,
      permissions: ["TELLER.SESSION_OPEN", "TELLER.VIEW"],
    };

    const session = await TellerSessionService.openSession({
      teller_id: tellerId,
      branch_id: branchId,
      opening_float: 5000,
    }, tellerActor);
    const sessionId = session.id;
    testRecords.tellerSessions.push(sessionId);
    assert(session.status === "OPEN", "Teller session opened with ₹5,000 cash");

    // Create Cash expense of ₹1180 (Taxable ₹1000, CGST ₹90, SGST ₹90)
    const exp1 = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      description: "Store Packaging Supplies - Cash Expense",
      expense_date: activeDate,
      subtotal: 1000,
      discount: 0,
      taxable_value: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      total: 1180,
      payment_method: "CASH",
      settlement_type: "DIRECT_PAYMENT",
      teller_session_id: sessionId,
      itc_eligibility: "ITC_ELIGIBLE",
      rcm_applicable: false,
    }, branchId, "c5_maker_user");

    assert(exp1.success && exp1.data, "Cash Expense created in DRAFT");
    const exp1Id = exp1.data.id;
    testRecords.expenses.push(exp1Id);

    // Submit
    const sub1 = await ExpenseService.transitionStatus(exp1Id, "SUBMITTED", "c5_maker_user", false, branchId);
    if (!sub1.success) console.error("    -> sub1 error:", sub1.error);
    assert(sub1.success, "Expense transitioned to SUBMITTED");

    // Approve with checker (SoD: checker !== maker)
    const app1 = await ExpenseService.transitionStatus(exp1Id, "APPROVED", "c5_checker_user", false, branchId);
    if (!app1.success) console.error("    -> app1 error:", app1.error);
    assert(app1.success, "Expense approved by checker user");

    // Post with poster (SoD: poster !== maker)
    const post1 = await ExpenseService.transitionStatus(exp1Id, "POSTED", "c5_poster_user", false, branchId);
    if (!post1.success) console.error("    -> post1 error:", post1.error);
    assert(post1.success, "Expense posted to General Ledger");

    // Inspect Journal Entry & Teller Movement
    const exp1Acct = await ExpenseService.getExpenseAccounting(exp1Id, branchId);
    assert(exp1Acct.success && exp1Acct.data?.voucher, "Accounting voucher generated and linked");
    assert(exp1Acct.data.voucher.status === "POSTED", "Accounting voucher status is POSTED");
    
    const lines1 = exp1Acct.data.journal_lines || [];
    console.log("    -> lines1:", lines1.map(l => ({ code: l.account_code, name: l.account_name, dr: l.debit, cr: l.credit })));
    const totalDr1 = lines1.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCr1 = lines1.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    assert(totalDr1 === 1180 && totalCr1 === 1180, `Balanced double-entry journal lines (Dr ${totalDr1} === Cr ${totalCr1})`);

    const cashCreditLine = lines1.find(l => l.account_code === '1111' && Number(l.credit) === 1180);
    assert(!!cashCreditLine, "Credit line posted to 1111 Cash in Hand for ₹1,180");

    const expenseDebitLine = lines1.find(l => l.account_code === suppliesCat.gl_account_code && Number(l.debit) === 1000);
    assert(!!expenseDebitLine, `Debit line posted to ${suppliesCat.gl_account_code} for taxable value ₹1,000`);

    const inputCgstLine = lines1.find(l => (l.account_code === '1143' || l.account_code === '1141') && Number(l.debit) === 90);
    const inputSgstLine = lines1.find(l => (l.account_code === '1144' || l.account_code === '1142') && Number(l.debit) === 90);
    assert(!!inputCgstLine && !!inputSgstLine, `Debit lines posted to Input CGST (${inputCgstLine?.account_code}) and Input SGST (${inputSgstLine?.account_code}) for ₹90 each`);

    // Check Teller Movement was created atomically
    const moveRes = await client.query(
      "SELECT * FROM public.teller_movement WHERE teller_session_id = $1 AND movement_type = 'EXPENSE_PAYMENT'",
      [sessionId]
    );
    assert(moveRes.rows.length === 1, "Atomic C4 Teller movement recorded for expense payment");
    assert(moveRes.rows[0].direction === "OUT" && Number(moveRes.rows[0].amount) === 1180, "Teller movement direction is OUT for ₹1,180");

    // 3. Direct Cash Expense with Petty Cash (No Teller Session)
    console.log("\n📍 [SUITE 3] Direct Cash Expense with Petty Cash (No Teller Session)...");
    const exp2 = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      description: "Petty Cash Office Tea & Refreshments",
      expense_date: activeDate,
      subtotal: 200,
      discount: 0,
      taxable_value: 200,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 200,
      payment_method: "CASH",
      settlement_type: "DIRECT_PAYMENT",
      teller_session_id: null, // Explicitly no teller session
    }, branchId, "c5_maker_user");

    const exp2Id = exp2.data.id;
    testRecords.expenses.push(exp2Id);
    await ExpenseService.transitionStatus(exp2Id, "SUBMITTED", "c5_maker_user", false, branchId);
    await ExpenseService.transitionStatus(exp2Id, "APPROVED", "c5_checker_user", false, branchId);
    await ExpenseService.transitionStatus(exp2Id, "POSTED", "c5_poster_user", false, branchId);

    const exp2Acct = await ExpenseService.getExpenseAccounting(exp2Id, branchId);
    const lines2 = exp2Acct.data?.journal_lines || [];
    const pettyCreditLine = lines2.find(l => (l.account_code === '1114' || l.account_code === '1111') && Number(l.credit) === 200);
    assert(!!pettyCreditLine, "Petty cash credit posted to 1114 Petty Cash (or 1111) without manufacturing teller session");

    // 4. Bank Transfer / UPI Expense with Configured Bank Account
    console.log("\n📍 [SUITE 4] Bank Transfer / UPI Expense with Configured Bank Account...");
    let bankRes = await client.query("SELECT ba.*, aa.code as gl_account_code FROM public.bank_account ba JOIN public.accounting_account aa ON ba.gl_account_id = aa.id WHERE ba.status = 'ACTIVE' LIMIT 1");
    let bankAcc = bankRes.rows[0];
    if (!bankAcc) {
      const bankGlRes = await client.query("SELECT id FROM public.accounting_account WHERE code = '1112' LIMIT 1");
      const bankGlId = bankGlRes.rows[0]?.id;
      const compRes = await client.query("SELECT id FROM public.company LIMIT 1");
      let compId = compRes.rows[0]?.id;
      if (!compId) {
        compId = `comp_c5_${Date.now()}`;
        await client.query(`
          INSERT INTO public.company (
            id, legal_name, trade_name, registered_address, city, state_code, pin_code,
            pan, currency, fy_start_month, invoice_prefix, phone, email, is_active, created_by, created_at, updated_at
          ) VALUES (
            $1, 'Cakes2Home Retail Pvt Ltd', 'Cakes2Home', '123 Baker St', 'Kochi', '32', '682001',
            'AAACC1234K', 'INR', 4, 'C2H', '9876543210', 'info@cakes2home.com', true, 'system', NOW(), NOW()
          )
        `, [compId]);
        testRecords.companies.push(compId);
      }
      const insBa = await client.query(
        `INSERT INTO public.bank_account (id, company_id, account_name, bank_name, account_number, account_number_masked, ifsc_code, account_type, gl_account_id, status)
         VALUES ($1, $2, 'Primary Operating Account', 'HDFC Bank', '50200012345678', 'XXXX5678', 'HDFC0001234', 'CURRENT', $3, 'ACTIVE')
         RETURNING *`,
        [`ba_c5_${Date.now()}`, compId, bankGlId]
      );
      bankAcc = insBa.rows[0];
      testRecords.bankAccounts.push(bankAcc.id);
    }
    assert(!!bankAcc, "Active bank account available for testing");

    const exp3 = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      description: "Store Internet & Broadband Bill",
      expense_date: activeDate,
      subtotal: 1000,
      discount: 0,
      taxable_value: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      total: 1180,
      payment_method: "BANK_TRANSFER",
      settlement_type: "DIRECT_PAYMENT",
      bank_account_id: bankAcc.id,
    }, branchId, "c5_maker_user");

    const exp3Id = exp3.data.id;
    testRecords.expenses.push(exp3Id);
    await ExpenseService.transitionStatus(exp3Id, "SUBMITTED", "c5_maker_user", false, branchId);
    await ExpenseService.transitionStatus(exp3Id, "APPROVED", "c5_checker_user", false, branchId);
    await ExpenseService.transitionStatus(exp3Id, "POSTED", "c5_poster_user", false, branchId);

    const exp3Acct = await ExpenseService.getExpenseAccounting(exp3Id, branchId);
    const lines3 = exp3Acct.data?.journal_lines || [];
    const bankCreditLine = lines3.find(l => (l.account_id === bankAcc.gl_account_id || l.account_code === '1112') && Number(l.credit) === 1180);
    assert(!!bankCreditLine, "Bank expense credited configured bank GL account for ₹1,180");

    // 5. Credit Expense / Supplier AP (`CREDIT_ACCRUAL`)
    console.log("\n📍 [SUITE 5] Credit Expense / Supplier AP (Party Dimension)...");
    let suppRes = await client.query("SELECT id, name FROM public.supplier WHERE deleted_at IS NULL LIMIT 1");
    let supplierId = suppRes.rows[0]?.id;
    if (!supplierId) {
      const sId = `supp_c5_${Date.now()}`;
      const insS = await client.query(
        "INSERT INTO public.supplier (id, name, phone) VALUES ($1, 'C5 Test Supplier', '9988776655') RETURNING id",
        [sId]
      );
      supplierId = insS.rows[0].id;
      testRecords.suppliers.push(supplierId);
    }

    const exp4 = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      supplier_id: supplierId,
      description: "Bulk Flour & Raw Ingredients on Credit",
      expense_date: activeDate,
      subtotal: 5000,
      discount: 0,
      taxable_value: 5000,
      cgst: 250,
      sgst: 250,
      igst: 0,
      total: 5500,
      payment_method: "OTHER",
      settlement_type: "CREDIT_ACCRUAL",
    }, branchId, "c5_maker_user");

    const exp4Id = exp4.data.id;
    testRecords.expenses.push(exp4Id);
    await ExpenseService.transitionStatus(exp4Id, "SUBMITTED", "c5_maker_user", false, branchId);
    await ExpenseService.transitionStatus(exp4Id, "APPROVED", "c5_checker_user", false, branchId);
    await ExpenseService.transitionStatus(exp4Id, "POSTED", "c5_poster_user", false, branchId);

    const exp4Acct = await ExpenseService.getExpenseAccounting(exp4Id, branchId);
    const lines4 = exp4Acct.data?.journal_lines || [];
    const apLine = lines4.find(l => l.account_code === '2111' && Number(l.credit) === 5500);
    assert(!!apLine, "Credit expense credited 2111 Accounts Payable for ₹5,500");
    assert(apLine?.supplier_id === supplierId, `AP credit line carries party dimension: supplier_id = ${supplierId}`);

    // 6. GST - Ineligible Input Tax (Capitalization per Sec 17(5))
    console.log("\n📍 [SUITE 6] GST Ineligible Input Tax (Capitalization per Sec 17(5))...");
    const exp5 = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      description: "Staff Lunch / Catering (Ineligible ITC per Sec 17(5))",
      expense_date: activeDate,
      subtotal: 1000,
      discount: 0,
      taxable_value: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      total: 1180,
      payment_method: "BANK_TRANSFER",
      settlement_type: "DIRECT_PAYMENT",
      bank_account_id: bankAcc.id,
      itc_eligibility: "ITC_INELIGIBLE", // CAPITALIZED
    }, branchId, "c5_maker_user");

    const exp5Id = exp5.data.id;
    testRecords.expenses.push(exp5Id);
    await ExpenseService.transitionStatus(exp5Id, "SUBMITTED", "c5_maker_user", false, branchId);
    await ExpenseService.transitionStatus(exp5Id, "APPROVED", "c5_checker_user", false, branchId);
    await ExpenseService.transitionStatus(exp5Id, "POSTED", "c5_poster_user", false, branchId);

    const exp5Acct = await ExpenseService.getExpenseAccounting(exp5Id, branchId);
    const lines5 = exp5Acct.data?.journal_lines || [];
    const expDebitLine5 = lines5.find(l => l.account_code === suppliesCat.gl_account_code && Number(l.debit) === 1180);
    const hasTaxDebits = lines5.some(l => l.account_code === '1141' || l.account_code === '1142');
    assert(!!expDebitLine5, `Expense account debited for full gross amount ₹1,180 (taxes capitalized)`);
    assert(!hasTaxDebits, "Zero debits to Input Tax accounts (1141/1142) when ITC_INELIGIBLE");

    // 7. GST - Reverse Charge Mechanism (RCM)
    console.log("\n📍 [SUITE 7] GST Reverse Charge Mechanism (RCM Liability)...");
    const exp6 = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      description: "Legal & Professional Services (GTA / Advocate RCM)",
      expense_date: activeDate,
      subtotal: 2000,
      discount: 0,
      taxable_value: 2000,
      cgst: 180,
      sgst: 180,
      igst: 0,
      total: 2360,
      payment_method: "BANK_TRANSFER",
      settlement_type: "DIRECT_PAYMENT",
      bank_account_id: bankAcc.id,
      itc_eligibility: "ITC_ELIGIBLE",
      rcm_applicable: true, // RCM Active
    }, branchId, "c5_maker_user");

    const exp6Id = exp6.data.id;
    testRecords.expenses.push(exp6Id);
    await ExpenseService.transitionStatus(exp6Id, "SUBMITTED", "c5_maker_user", false, branchId);
    await ExpenseService.transitionStatus(exp6Id, "APPROVED", "c5_checker_user", false, branchId);
    await ExpenseService.transitionStatus(exp6Id, "POSTED", "c5_poster_user", false, branchId);

    const exp6Acct = await ExpenseService.getExpenseAccounting(exp6Id, branchId);
    const lines6 = exp6Acct.data?.journal_lines || [];
    const bankPayLine6 = lines6.find(l => (l.account_id === bankAcc.gl_account_id || l.account_code === '1112') && Number(l.credit) === 2000);
    const rcmCgstLine = lines6.find(l => (l.account_code === '2123' || l.account_code === '2121') && Number(l.credit) === 180);
    const rcmSgstLine = lines6.find(l => (l.account_code === '2124' || l.account_code === '2122') && Number(l.credit) === 180);
    const inputCgst6 = lines6.find(l => (l.account_code === '1143' || l.account_code === '1141') && Number(l.debit) === 180);
    const inputSgst6 = lines6.find(l => (l.account_code === '1144' || l.account_code === '1142') && Number(l.debit) === 180);

    assert(!!bankPayLine6, "Vendor paid net taxable ₹2,000 (taxes withheld under RCM)");
    assert(!!rcmCgstLine && !!rcmSgstLine, `Output Tax RCM liability credited: ${rcmCgstLine?.account_code} (₹180) & ${rcmSgstLine?.account_code} (₹180)`);
    assert(!!inputCgst6 && !!inputSgst6, `Input Tax credited/debited concurrently under RCM: ${inputCgst6?.account_code} (₹180) & ${inputSgst6?.account_code} (₹180)`);

    // 8. Reversal Engine & Teller Redeposit
    console.log("\n📍 [SUITE 8] GL Reversal Engine & Teller Cash Redeposit...");
    // Reverse exp1 (Cash expense paid from teller session)
    const revRes = await ExpenseService.reverseExpense(
      exp1Id,
      "c5_reverser_user",
      "Auditor error correction - full reversal",
      branchId,
      sessionId,
      "TELLER_DRAWER"
    );
    if (!revRes.success) console.error("    -> revRes error:", revRes.error);
    assert(revRes.success, "Expense successfully reversed via ExpenseReversalService");

    const exp1Reversed = await ExpenseService.getExpenseAccounting(exp1Id, branchId);
    assert(exp1Reversed.data?.expense?.status === "REVERSED", "Operational expense status updated to REVERSED");
    assert(exp1Reversed.data?.reversal_voucher !== null, "Reversal voucher created and linked");
    assert(exp1Reversed.data?.reversal_voucher?.status === "POSTED", "Reversal voucher posted to GL");

    const revLines = exp1Reversed.data?.reversal_journal_lines || [];
    const revCashDebit = revLines.find(l => l.account_code === '1111' && Number(l.debit) === 1180);
    const revExpCredit = revLines.find(l => l.account_code === suppliesCat.gl_account_code && Number(l.credit) === 1000);
    assert(!!revCashDebit && !!revExpCredit, "Reversal journal lines exactly inverted (Dr Cash 1111 ₹1,180 / Cr Expense ₹1,000)");

    // Check Teller Redeposit Movement
    const redepositMove = await client.query(
      "SELECT * FROM public.teller_movement WHERE teller_session_id = $1 AND movement_type = 'ADJUSTMENT' ORDER BY created_at DESC LIMIT 1",
      [sessionId]
    );
    assert(redepositMove.rows.length === 1 && redepositMove.rows[0].direction === "IN" && Number(redepositMove.rows[0].amount) === 1180,
      "Teller cash redeposit movement recorded with direction = IN for ₹1,180"
    );

    // 9. Segregation of Duties (SoD) Invariants
    console.log("\n📍 [SUITE 9] Segregation of Duties (Maker != Checker != Poster != Reverser)...");
    
    // Maker attempts to approve own expense
    const sodExp = await ExpenseService.createExpense({
      category_id: suppliesCat.id,
      description: "SoD Test Expense",
      expense_date: activeDate,
      subtotal: 100,
      taxable_value: 100,
      total: 100,
      payment_method: "CASH",
    }, branchId, "sod_maker");
    const sodExpId = sodExp.data.id;
    testRecords.expenses.push(sodExpId);
    await ExpenseService.transitionStatus(sodExpId, "SUBMITTED", "sod_maker", false, branchId);

    const selfApprove = await ExpenseService.transitionStatus(sodExpId, "APPROVED", "sod_maker", false, branchId);
    assert(!selfApprove.success && selfApprove.error?.includes("Segregation of Duties"), "Maker self-approval blocked by SoD guard");

    // Super Admin cannot bypass Maker SoD
    const superSelfApprove = await ExpenseService.transitionStatus(sodExpId, "APPROVED", "sod_maker", true, branchId);
    assert(!superSelfApprove.success && superSelfApprove.error?.includes("Segregation of Duties"), "Super Admin cannot bypass Maker SoD");

    // Approve with checker, then maker attempts to post
    await ExpenseService.transitionStatus(sodExpId, "APPROVED", "sod_checker", false, branchId);
    const selfPost = await ExpenseService.transitionStatus(sodExpId, "POSTED", "sod_maker", false, branchId);
    assert(!selfPost.success && selfPost.error?.includes("Segregation of Duties"), "Maker self-posting blocked by SoD guard");

    // Post with poster
    await ExpenseService.transitionStatus(sodExpId, "POSTED", "sod_poster", false, branchId);

    // Creator attempts to reverse
    const makerRev = await ExpenseService.reverseExpense(sodExpId, "sod_maker", "Unauthorized self-reversal", branchId);
    assert(!makerRev.success && makerRev.error?.includes("Segregation of Duties"), "Creator cannot reverse own expense");

    // Approver attempts to reverse
    const approverRev = await ExpenseService.reverseExpense(sodExpId, "sod_checker", "Unauthorized approver reversal", branchId);
    assert(!approverRev.success && approverRev.error?.includes("Segregation of Duties"), "Approver cannot reverse approved expense");

    // 10. Idempotency & Lifecycle Guards
    console.log("\n📍 [SUITE 10] Idempotency & Lifecycle Guards...");
    const dupPost = await ExpenseService.transitionStatus(sodExpId, "POSTED", "sod_poster_2", false, branchId);
    assert(!dupPost.success && dupPost.error?.includes("already posted"), "Posting an already posted expense fails closed");

    // 11. Trial Balance Integrity
    console.log("\n📍 [SUITE 11] Trial Balance Double-Entry Zero-Sum Verification...");
    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(jl.debit_amount), 0) AS total_debit,
        COALESCE(SUM(jl.credit_amount), 0) AS total_credit
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
    `);
    const totalTbDr = Number(tbRes.rows[0].total_debit);
    const totalTbCr = Number(tbRes.rows[0].total_credit);
    assert(Math.abs(totalTbDr - totalTbCr) < 0.001, `Trial Balance zero-sum balance hold: Dr ${totalTbDr.toFixed(2)} === Cr ${totalTbCr.toFixed(2)}`);

  } catch (err) {
    console.error("UNEXPECTED RUNTIME EXCEPTION:", err);
    failed++;
  } finally {
    // 12. Cleanup & Teardown
    console.log("\n📍 [TEARDOWN] Cleaning up test fixtures & restoring pristine DB baseline...");
    try {
      for (const expId of testRecords.expenses) {
        // Query linked vouchers
        const vRes = await client.query("SELECT voucher_id, reversal_voucher_id FROM public.expense WHERE id = $1", [expId]);
        const vId = vRes.rows[0]?.voucher_id;
        const revVId = vRes.rows[0]?.reversal_voucher_id;

        // Delete expense
        await client.query("DELETE FROM public.expense WHERE id = $1", [expId]);

        // Delete vouchers & entries
        const vIds = [vId, revVId].filter(Boolean);
        for (const vid of vIds) {
          const jeRes = await client.query("SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1", [vid]);
          for (const je of jeRes.rows) {
            await client.query("DELETE FROM public.accounting_journal_line WHERE journal_entry_id = $1", [je.id]);
            await client.query("DELETE FROM public.accounting_journal_entry WHERE id = $1", [je.id]);
          }
          await client.query("DELETE FROM public.accounting_voucher WHERE id = $1", [vid]);
        }
      }

      for (const sessId of testRecords.tellerSessions) {
        await client.query("DELETE FROM public.teller_movement WHERE teller_session_id = $1", [sessId]);
        await client.query("DELETE FROM public.teller_session WHERE id = $1", [sessId]);
      }

      for (const suppId of testRecords.suppliers) {
        await client.query("DELETE FROM public.supplier WHERE id = $1", [suppId]);
      }

      for (const baId of testRecords.bankAccounts) {
        await client.query("DELETE FROM public.bank_account WHERE id = $1", [baId]);
      }

      for (const compId of testRecords.companies) {
        await client.query("DELETE FROM public.company WHERE id = $1", [compId]);
      }

      for (const tid of testRecords.tellers) {
        await client.query("DELETE FROM public.teller WHERE id = $1", [tid]);
      }

      for (const uid of testRecords.users) {
        await client.query("DELETE FROM \"user\" WHERE id = $1", [uid]);
      }

      console.log("  ✓ Teardown complete. All test records and vouchers purged.");
    } catch (cleanErr) {
      console.error("  Warning during cleanup:", cleanErr.message);
    }

    await client.end();
    await closeDbPool();
  }

  console.log("\n==================================================================");
  console.log(`  FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
