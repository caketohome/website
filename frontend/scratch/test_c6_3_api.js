/**
 * CakeToHome ERP — Phase C6.3 Manual Journal API & RBAC/SoD Test Suite
 *
 * Verifies C6.3:
 * 1. API integration tests covering all endpoints:
 *    - GET /api/v1/admin/accounting/journals
 *    - GET /api/v1/admin/accounting/journals/:id
 *    - POST /api/v1/admin/accounting/journals/draft
 *    - PUT /api/v1/admin/accounting/journals/:id
 *    - POST /api/v1/admin/accounting/journals/:id/submit
 *    - POST /api/v1/admin/accounting/journals/:id/approve
 *    - POST /api/v1/admin/accounting/journals/:id/post
 *    - POST /api/v1/admin/accounting/journals/:id/cancel
 *    - POST /api/v1/admin/accounting/journals/:id/reverse
 * 2. Authentication failures (missing token, invalid token -> 401)
 * 3. Permission failures (missing ACCOUNTING.* permissions -> 403 FORBIDDEN)
 * 4. Branch isolation (cross-branch access strictly blocked -> 403 BRANCH_ACCESS_DENIED)
 * 5. Maker/checker/poster Segregation of Duties (SoD) enforcement
 * 6. Super Admin bypass prevention (Super Admin maker cannot approve/post own voucher)
 * 7. Invalid voucher / state handling (404, 400, 409, 422)
 * 8. Draft / update / list / detail behavior
 * 9. Posting and reversal through API with compensating journal & bidirectional linkage
 * 10. No client-controlled actor identity (server identity strictly enforced)
 * 11. Clean test teardown & Trial Balance zero-sum audit
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

process.env.DATABASE_URL = getConnectionString();

// Register TypeScript transpile hook
const ts = require(path.resolve(__dirname, '../node_modules/typescript'));
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

const { NextRequest } = require('next/server');
const { signAuthToken } = require('../src/lib/security/auth-session');
const { GET, POST, PUT } = require('../src/app/api/v1/[...path]/route');
const { dbQuery, closeDbPool } = require('../src/lib/db');
const { AccountingJournalRepository } = require('../src/lib/repositories/accounting-journal.repository');

// ── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const testVoucherIds = [];
const createdUserIds = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function apiRequest(method, pathParts, body = null, token = null, queryParams = "", customHeaders = {}) {
  const url = `http://localhost:3000/api/v1/${pathParts.join("/")}${queryParams ? `?${queryParams}` : ""}`;
  const headers = { "Content-Type": "application/json", ...customHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const req = new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let res;
  if (method === "GET") {
    res = await GET(req, { params: { path: pathParts } });
  } else if (method === "POST") {
    res = await POST(req, { params: { path: pathParts } });
  } else if (method === "PUT") {
    res = await PUT(req, { params: { path: pathParts } });
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }
  const status = res.status;
  const json = await res.json();
  return { status, json };
}

async function runApiTests() {
  console.log("==================================================================");
  console.log("  PHASE C6.3 MANUAL JOURNAL API & RBAC/SOD TEST SUITE");
  console.log("==================================================================\n");

  try {
    // 0. Setup and clean slate
    console.log("--- Setup: Resolving Entities & Provisioning Actors ---");
    await dbQuery("DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.3%' OR reference_id LIKE 'c63%'))");
    await dbQuery("DELETE FROM public.accounting_journal_entry WHERE voucher_id IN (SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.3%' OR reference_id LIKE 'c63%')");
    await dbQuery("DELETE FROM public.accounting_voucher WHERE narration LIKE 'C6.3%' OR reference_id LIKE 'c63%'");

    const branchesRes = await dbQuery("SELECT id, name FROM public.branch ORDER BY id ASC LIMIT 2");
    assert(branchesRes.rows.length >= 2, "At least 2 test branches exist");
    const branchA = branchesRes.rows[0];
    const branchB = branchesRes.rows[1];
    console.log(`  Branch A: ${branchA.id} (${branchA.name})`);
    console.log(`  Branch B: ${branchB.id} (${branchB.name})`);

    const accountsRes = await dbQuery(
      `SELECT id, code, name, type, subtype, is_group
       FROM public.accounting_account
       WHERE deleted_at IS NULL AND is_active = true
       ORDER BY code ASC`
    );
    const cashAccount = accountsRes.rows.find(a => a.code === '1111');
    const cogsAccount = accountsRes.rows.find(a => a.code === '5110');
    const groupAccount = accountsRes.rows.find(a => a.is_group === true);

    const periodRes = await dbQuery(
      "SELECT to_char(start_date + interval '10 days', 'YYYY-MM-DD') as safe_date, fiscal_year FROM public.accounting_fiscal_period WHERE is_locked = false ORDER BY start_date ASC LIMIT 1"
    );
    assert(periodRes.rows.length > 0, "Open fiscal period found");
    const safeDate = periodRes.rows[0].safe_date;
    console.log(`  Testing Date: ${safeDate}`);

    // Provision Actors via signAuthToken
    // Maker User (Branch A)
    const makerUid = `usr_c63_maker_${Date.now()}`;
    const makerToken = signAuthToken({
      userId: makerUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.CREATE", "ACCOUNTING.VIEW"],
    });

    // Checker User (Branch A)
    const checkerUid = `usr_c63_checker_${Date.now()}`;
    const checkerToken = signAuthToken({
      userId: checkerUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.APPROVE", "ACCOUNTING.VIEW"],
    });

    // Poster User (Branch A)
    const posterUid = `usr_c63_poster_${Date.now()}`;
    const posterToken = signAuthToken({
      userId: posterUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.POST", "ACCOUNTING.VIEW"],
    });

    // Reverser User (Branch A)
    const reverserUid = `usr_c63_reverser_${Date.now()}`;
    const reverserToken = signAuthToken({
      userId: reverserUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.REVERSE", "ACCOUNTING.VIEW"],
    });

    // Super Admin (Global scope)
    const adminUid = `admin_c63_${Date.now()}`;
    const adminToken = signAuthToken({
      userId: adminUid,
      role: "SUPER_ADMIN",
      branchId: null,
      isSuperAdmin: true,
      permissions: ["*"],
    });

    // Other Branch Maker (Branch B)
    const otherBranchMakerUid = `usr_c63_branch_b_${Date.now()}`;
    const otherBranchToken = signAuthToken({
      userId: otherBranchMakerUid,
      role: "STAFF",
      branchId: branchB.id,
      permissions: ["ACCOUNTING.CREATE", "ACCOUNTING.VIEW", "ACCOUNTING.APPROVE", "ACCOUNTING.POST"],
    });

    // Unprivileged User (No permissions)
    const unprivUid = `usr_c63_unpriv_${Date.now()}`;
    const unprivToken = signAuthToken({
      userId: unprivUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: [],
    });

    console.log("  Provisioned all test actors and tokens.");

    // ── 1. Authentication Failures ───────────────────────────────────────────
    console.log("\n--- 1. Authentication Failures ---");
    const noAuthGet = await apiRequest("GET", ["admin", "accounting", "journals"]);
    assert(noAuthGet.status === 401, "GET /journals without token rejected with 401");
    assert(noAuthGet.json.error === "UNAUTHORIZED", "Error is UNAUTHORIZED");

    const noAuthPost = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], { narration: "test" });
    assert(noAuthPost.status === 401, "POST /draft without token rejected with 401");

    const badTokenGet = await apiRequest("GET", ["admin", "accounting", "journals"], null, "invalid.jwt.token");
    assert(badTokenGet.status === 401, "GET /journals with forged token rejected with 401");

    // ── 2. Permission Failures ───────────────────────────────────────────────
    console.log("\n--- 2. Permission Failures ---");
    const unprivList = await apiRequest("GET", ["admin", "accounting", "journals"], null, unprivToken);
    assert(unprivList.status === 403, "Unprivileged GET /journals rejected with 403");
    assert(unprivList.json.error === "FORBIDDEN", "Error is FORBIDDEN");

    const unprivDraft = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "C6.3 unprivileged draft",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 500, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 500 },
      ],
    }, unprivToken);
    assert(unprivDraft.status === 403, "Unprivileged POST /draft rejected with 403");
    assert(unprivDraft.json.error === "FORBIDDEN", "Error code is FORBIDDEN");

    const unprivApprove = await apiRequest("POST", ["admin", "accounting", "journals", "vch_fake", "approve"], null, unprivToken);
    assert(unprivApprove.status === 403, "Unprivileged POST /approve rejected with 403 FORBIDDEN");
    assert(unprivApprove.json.error === "FORBIDDEN", "Approve error code is FORBIDDEN");

    const unprivPost = await apiRequest("POST", ["admin", "accounting", "journals", "vch_fake", "post"], null, unprivToken);
    assert(unprivPost.status === 403, "Unprivileged POST /post rejected with 403 FORBIDDEN");
    assert(unprivPost.json.error === "FORBIDDEN", "Post error code is FORBIDDEN");

    const unprivCancel = await apiRequest("POST", ["admin", "accounting", "journals", "vch_fake", "cancel"], { reason: "test" }, unprivToken);
    assert(unprivCancel.status === 403, "Unprivileged POST /cancel rejected with 403 FORBIDDEN");
    assert(unprivCancel.json.error === "FORBIDDEN", "Cancel error code is FORBIDDEN");

    const unprivReverse = await apiRequest("POST", ["admin", "accounting", "journals", "vch_fake", "reverse"], { reversal_reason: "test" }, unprivToken);
    assert(unprivReverse.status === 403, "Unprivileged POST /reverse rejected with 403 FORBIDDEN");
    assert(unprivReverse.json.error === "FORBIDDEN", "Reverse error code is FORBIDDEN");

    // ── 3. Branch Isolation ──────────────────────────────────────────────────
    console.log("\n--- 3. Branch Isolation ---");
    // Maker A (assigned to branchA) attempts to create draft for branchB
    const crossBranchCreate = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchB.id,
      narration: "Cross-branch draft attempt",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 500, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 500 },
      ],
    }, makerToken);
    assert(crossBranchCreate.status === 403, "Cross-branch draft creation rejected with 403");
    assert(crossBranchCreate.json.error === "BRANCH_ACCESS_DENIED", "Error code is BRANCH_ACCESS_DENIED");

    // ── 4. No Client-Controlled Actor Identity ───────────────────────────────
    console.log("\n--- 4. No Client-Controlled Actor Identity ---");
    const spoofDraft = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "C6.3 Spoof Actor Identity Test",
      created_by: "hacked_admin_identity", // Client attempt to forge created_by
      idempotency_key: `c63_spoof_${Date.now()}`,
      lines: [
        { account_id: cogsAccount.id, debit_amount: 500, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 500 },
      ],
    }, makerToken, "", { "x-user-id": "hacked_header_user", "x-user-role": "SUPER_ADMIN" });

    assert(spoofDraft.status === 201, "Draft creation succeeded (201)");
    const spoofVoucher = spoofDraft.json.data;
    testVoucherIds.push(spoofVoucher.id);
    assert(spoofVoucher.created_by === makerUid, `created_by is authoritatively makerUid (${makerUid}), not client-forged`);
    assert(spoofVoucher.created_by !== "hacked_admin_identity", "Client-supplied body created_by was completely ignored");

    // ── 5. Draft Creation / Update / List / Detail Behavior ───────────────────
    console.log("\n--- 5. Draft Creation / Update / List / Detail Behavior ---");
    // Create valid draft
    const createRes = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "C6.3 Operational Adjustment - Office Cake Supplies",
      idempotency_key: `c63_valid_1_${Date.now()}`,
      lines: [
        { account_id: cogsAccount.id, debit_amount: 600, credit_amount: 0, narration: "Debit COGS" },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 600, narration: "Credit Cash" },
      ],
    }, makerToken);

    assert(createRes.status === 201, "POST /draft returned 201 Created");
    const vch1 = createRes.json.data;
    testVoucherIds.push(vch1.id);
    assert(vch1.voucher_type === "JOURNAL", "voucher_type === 'JOURNAL'");
    assert(vch1.status === "DRAFT", "status === 'DRAFT'");
    assert(vch1.currency === "INR", "currency === 'INR'");
    assert(Number(vch1.total_amount) === 600, "total_amount is ₹600");
    assert(vch1.metadata.lines.length === 2, "metadata.lines has 2 lines");

    // Update draft via PUT /admin/accounting/journals/:id
    const updateRes = await apiRequest("PUT", ["admin", "accounting", "journals", vch1.id], {
      narration: "C6.3 Updated Narration: Office Supplies Adjustment",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 750, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 750 },
      ],
    }, makerToken);

    assert(updateRes.status === 200, "PUT /journals/:id returned 200 OK");
    const vch1Updated = updateRes.json.data;
    assert(vch1Updated.narration.includes("Updated Narration"), "Narration updated");
    assert(Number(vch1Updated.total_amount) === 750, "total_amount updated to ₹750");

    // GET /journals (List)
    const listRes = await apiRequest("GET", ["admin", "accounting", "journals"], null, makerToken, "status=DRAFT");
    assert(listRes.status === 200, "GET /journals returned 200 OK");
    assert(listRes.json.success === true, "success === true");
    const foundInList = listRes.json.journals.find(j => j.id === vch1.id);
    assert(Boolean(foundInList), "Created journal found in list");
    assert(foundInList?.line_count === 2, "line_count reflected in list");

    // GET /journals/:id (Detail)
    const detailRes = await apiRequest("GET", ["admin", "accounting", "journals", vch1.id], null, makerToken);
    assert(detailRes.status === 200, "GET /journals/:id returned 200 OK");
    const detail = detailRes.json.data;
    assert(detail.voucher.id === vch1.id, "Detail voucher ID matches");
    assert(detail.proposed_lines.length === 2, "proposed_lines has 2 lines");
    assert(detail.proposed_lines[0].account_code === cogsAccount.code, `Line 1 enriched with account code ${cogsAccount.code}`);
    assert(detail.journal_entry === null, "journal_entry is null while in DRAFT status");
    assert(detail.posted_lines.length === 0, "posted_lines is empty array while in DRAFT status");

    // Cross-branch detail access rejection
    const crossBranchDetail = await apiRequest("GET", ["admin", "accounting", "journals", vch1.id], null, otherBranchToken);
    assert(crossBranchDetail.status === 403, "Branch B staff viewing Branch A journal rejected with 403");
    assert(crossBranchDetail.json.error === "BRANCH_ACCESS_DENIED", "Error code is BRANCH_ACCESS_DENIED");

    // Cross-branch update rejection
    const crossBranchUpdate = await apiRequest("PUT", ["admin", "accounting", "journals", vch1.id], {
      narration: "Cross-branch update attempt",
    }, otherBranchToken);
    assert(crossBranchUpdate.status === 403, "Branch B staff updating Branch A journal rejected with 403");
    assert(crossBranchUpdate.json.error === "BRANCH_ACCESS_DENIED", "Error code is BRANCH_ACCESS_DENIED");

    // ── 6. Invalid Voucher / State Handling ──────────────────────────────────
    console.log("\n--- 6. Invalid Voucher / State Handling ---");
    const nonExistentDetail = await apiRequest("GET", ["admin", "accounting", "journals", "vch_fake_999999"], null, makerToken);
    assert(nonExistentDetail.status === 404, "Non-existent voucher GET returned 404");
    assert(nonExistentDetail.json.error === "VOUCHER_NOT_FOUND", "Error code is VOUCHER_NOT_FOUND");

    const unbalancedDraft = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "Unbalanced lines attempt",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 500, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 400 },
      ],
    }, makerToken);
    assert(unbalancedDraft.status === 400, "Unbalanced draft rejected with 400");
    assert(unbalancedDraft.json.error === "JOURNAL_UNBALANCED", "Error is JOURNAL_UNBALANCED");

    const groupAcctDraft = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "Group account attempt",
      lines: [
        { account_id: groupAccount.id, debit_amount: 500, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 500 },
      ],
    }, makerToken);
    assert(groupAcctDraft.status === 400, "Group account draft rejected with 400");
    assert(groupAcctDraft.json.error === "GROUP_ACCOUNT_NOT_POSTABLE", "Error is GROUP_ACCOUNT_NOT_POSTABLE");

    // Illegal state transition: Approve on DRAFT (must be SUBMITTED)
    const prematureApprove = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "approve"], null, checkerToken);
    assert(prematureApprove.status === 409, "Approving DRAFT directly rejected with 409");
    assert(prematureApprove.json.error === "INVALID_VOUCHER_STATE", "Error code is INVALID_VOUCHER_STATE");

    // ── 7. Submission & Immutability ─────────────────────────────────────────
    console.log("\n--- 7. Submission & Immutability ---");
    const submitRes = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "submit"], null, makerToken);
    assert(submitRes.status === 200, "POST /submit returned 200 OK");
    const vch1Submitted = submitRes.json.data;
    assert(vch1Submitted.status === "SUBMITTED", "status transitioned to SUBMITTED");
    assert(vch1Submitted.submitted_by === makerUid, "submitted_by recorded as maker");

    // Immutability Guard: Cannot edit SUBMITTED voucher
    const editSubmitted = await apiRequest("PUT", ["admin", "accounting", "journals", vch1.id], {
      narration: "Attempting to mutate submitted voucher",
    }, makerToken);
    assert(editSubmitted.status === 409, "Editing SUBMITTED voucher rejected with 409");
    assert(editSubmitted.json.error === "INVALID_VOUCHER_STATE", "Error is INVALID_VOUCHER_STATE");

    // ── 8. Maker/Checker/Poster SoD & Super Admin Bypass Prevention ───────────
    console.log("\n--- 8. Maker/Checker/Poster SoD & Super Admin Bypass Prevention ---");
    // Maker tries to approve own voucher (Self-Approval)
    // Maker with APPROVE permission injected to test SoD specifically
    const makerWithApproveToken = signAuthToken({
      userId: makerUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.APPROVE", "ACCOUNTING.VIEW"],
    });

    const selfApprove = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "approve"], null, makerWithApproveToken);
    assert(selfApprove.status === 409, "Maker self-approval rejected with 409");
    assert(selfApprove.json.error === "SEGREGATION_OF_DUTIES_VIOLATION", "Error is SEGREGATION_OF_DUTIES_VIOLATION");

    // Super Admin Bypass Attempt
    // Super Admin creates a draft, submits it, then attempts self-approval
    const adminDraft = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "C6.3 Super Admin SoD Bypass Test Voucher",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 300, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 300 },
      ],
    }, adminToken);
    testVoucherIds.push(adminDraft.json.data.id);
    const adminVchId = adminDraft.json.data.id;

    await apiRequest("POST", ["admin", "accounting", "journals", adminVchId, "submit"], null, adminToken);

    // Super Admin tries to approve their own voucher
    const adminSelfApprove = await apiRequest("POST", ["admin", "accounting", "journals", adminVchId, "approve"], null, adminToken);
    assert(adminSelfApprove.status === 409, "Super Admin self-approval strictly rejected with 409");
    assert(adminSelfApprove.json.error === "SEGREGATION_OF_DUTIES_VIOLATION", "Super Admin SoD bypass blocked (SEGREGATION_OF_DUTIES_VIOLATION)");

    // Valid Approval by independent Checker (with client spoof attempt)
    const validApprove = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "approve"], {
      approved_by: "spoofed_checker_uid",
    }, checkerToken);
    assert(validApprove.status === 200, "Checker approval returned 200 OK");
    const vch1Approved = validApprove.json.data;
    assert(vch1Approved.status === "APPROVED", "status transitioned to APPROVED");
    assert(vch1Approved.approved_by === checkerUid, "approved_by recorded as checker from server token");
    assert(vch1Approved.approved_by !== "spoofed_checker_uid", "Client spoofed approved_by was completely ignored");

    // Maker tries to post own voucher (Self-Posting)
    const makerWithPostToken = signAuthToken({
      userId: makerUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.POST", "ACCOUNTING.VIEW"],
    });
    const selfPost = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "post"], null, makerWithPostToken);
    assert(selfPost.status === 409, "Maker self-posting rejected with 409");
    assert(selfPost.json.error === "SEGREGATION_OF_DUTIES_VIOLATION", "Error is SEGREGATION_OF_DUTIES_VIOLATION");

    // ── 9. Posting to General Ledger via API ──────────────────────────────────
    console.log("\n--- 9. Posting to General Ledger via API ---");
    const postRes = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "post"], {
      posted_by: "spoofed_poster_uid",
    }, posterToken);
    assert(postRes.status === 200, "POST /post returned 200 OK");
    const postData = postRes.json.data;
    assert(postData.voucher.status === "POSTED", "Voucher status is POSTED");
    assert(postData.voucher.posted_by === posterUid, "posted_by recorded as poster from server token");
    assert(postData.voucher.posted_by !== "spoofed_poster_uid", "Client spoofed posted_by was completely ignored");
    assert(postData.journal_entry !== null, "journal_entry returned");
    assert(postData.journal_entry.lines.length === 2, "2 authoritative journal lines created");

    // PostgreSQL verification
    const dbLines = await dbQuery(
      `SELECT jl.debit_amount, jl.credit_amount, a.code
       FROM public.accounting_journal_line jl
       JOIN public.accounting_account a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = $1`,
      [postData.journal_entry.id]
    );
    assert(dbLines.rows.length === 2, "PostgreSQL has exactly 2 lines in accounting_journal_line");
    const drLine = dbLines.rows.find(l => Number(l.debit_amount) > 0);
    const crLine = dbLines.rows.find(l => Number(l.credit_amount) > 0);
    assert(Number(drLine.debit_amount) === 750, "Authoritative debit is ₹750");
    assert(Number(crLine.credit_amount) === 750, "Authoritative credit is ₹750");

    // Verify metadata proposed lines snapshot remains intact after posting
    const postDetailRes = await apiRequest("GET", ["admin", "accounting", "journals", vch1.id], null, makerToken);
    assert(postDetailRes.status === 200, "GET /journals/:id after posting returned 200 OK");
    const postDetail = postDetailRes.json.data;
    assert(postDetail.proposed_lines.length === 2, "metadata proposed lines remain an audit snapshot");
    assert(postDetail.posted_lines.length === 2, "authoritative posted_lines populated in detail");

    // Duplicate post protection
    const dupPost = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "post"], null, posterToken);
    assert(dupPost.status === 409, "Duplicate posting rejected with 409");
    assert(dupPost.json.error === "VOUCHER_ALREADY_POSTED", "Error is VOUCHER_ALREADY_POSTED");

    // ── 10. Cancellation Lifecycle via API ───────────────────────────────────
    console.log("\n--- 10. Cancellation Lifecycle via API ---");
    // Create draft to cancel
    const cancelDraftRes = await apiRequest("POST", ["admin", "accounting", "journals", "draft"], {
      voucher_date: safeDate,
      branch_id: branchA.id,
      narration: "C6.3 Draft to be cancelled",
      lines: [
        { account_id: cogsAccount.id, debit_amount: 200, credit_amount: 0 },
        { account_id: cashAccount.id, debit_amount: 0, credit_amount: 200 },
      ],
    }, makerToken);
    const cancelVch = cancelDraftRes.json.data;
    testVoucherIds.push(cancelVch.id);

    const cancelRes = await apiRequest("POST", ["admin", "accounting", "journals", cancelVch.id, "cancel"], {
      reason: "User cancelled due to error",
      cancelled_by: "spoofed_canceller_uid",
    }, makerToken);
    assert(cancelRes.status === 200, "POST /cancel returned 200 OK");
    assert(cancelRes.json.data.status === "CANCELLED", "Voucher status is CANCELLED");
    assert(cancelRes.json.data.cancelled_by === makerUid, "cancelled_by recorded as maker from server token");
    assert(cancelRes.json.data.cancelled_by !== "spoofed_canceller_uid", "Client spoofed cancelled_by was completely ignored");

    // Prohibit cancelling POSTED voucher
    const cancelPosted = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "cancel"], {
      reason: "Illegal attempt to cancel posted voucher",
    }, makerToken);
    assert(cancelPosted.status === 409, "Cancelling POSTED voucher rejected with 409");
    assert(cancelPosted.json.error === "INVALID_VOUCHER_STATE", "Error is INVALID_VOUCHER_STATE");

    // ── 11. Reversal Orchestration via API ───────────────────────────────────
    console.log("\n--- 11. Reversal Orchestration via API ---");
    // Missing reason rejection
    const noReasonRev = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "reverse"], {}, reverserToken);
    assert(noReasonRev.status === 400, "Reversal without reason rejected with 400");
    assert(noReasonRev.json.error === "VALIDATION_FAILED", "Error is VALIDATION_FAILED");

    // Maker self-reversal rejection (SoD)
    const makerWithRevToken = signAuthToken({
      userId: makerUid,
      role: "STAFF",
      branchId: branchA.id,
      permissions: ["ACCOUNTING.REVERSE", "ACCOUNTING.VIEW"],
    });
    const makerSelfRev = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "reverse"], {
      reversal_reason: "Maker attempting to reverse own voucher",
    }, makerWithRevToken);
    assert(makerSelfRev.status === 409, "Maker self-reversal rejected with 409");
    assert(makerSelfRev.json.error === "SEGREGATION_OF_DUTIES_VIOLATION", "Error is SEGREGATION_OF_DUTIES_VIOLATION");

    // Independent Reverser execution
    const validRev = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "reverse"], {
      reversal_reason: "Month-end correction of office expense adjustment",
      reversed_by: "spoofed_reverser_uid",
      created_by: "spoofed_reverser_uid",
    }, reverserToken);
    assert(validRev.status === 200, "POST /reverse returned 200 OK");
    const revData = validRev.json.data;
    testVoucherIds.push(revData.reversal_voucher.id);

    assert(revData.reversal_voucher.status === "POSTED", "Reversal voucher is POSTED");
    assert(revData.reversal_voucher.reversal_of_voucher_id === vch1.id, "reversal_of_voucher_id links to original");
    assert(revData.reversal_voucher.approved_by === reverserUid, "reversal approved_by recorded as reverser from server token");
    assert(revData.reversal_voucher.posted_by === reverserUid, "reversal posted_by recorded as reverser from server token");
    assert(revData.reversal_voucher.created_by === "system_reversal_engine", "reversal created_by is system_reversal_engine per SoD architecture");
    assert(revData.reversal_voucher.approved_by !== "spoofed_reverser_uid", "Client spoofed reversed_by was completely ignored");
    assert(revData.original_voucher.status === "POSTED", "Original voucher remains POSTED");
    assert(revData.original_voucher.reversed_by_voucher_id === revData.reversal_voucher.id, "reversed_by_voucher_id links to reversal");

    // Verify original journal entry in DB has is_reversed = true
    const origJeDb = await dbQuery("SELECT is_reversed FROM public.accounting_journal_entry WHERE voucher_id = $1", [vch1.id]);
    assert(origJeDb.rows[0].is_reversed === true, "Original journal entry is_reversed is set to true in database");

    // Verify compensating lines are inverted
    const revLines = revData.journal_entry.lines;
    assert(revLines.length === 2, "Compensating journal entry has 2 lines");
    const origDrCompCr = revLines.find(l => l.account_id === cogsAccount.id);
    assert(Number(origDrCompCr.credit_amount) === 750, "Original Dr COGS is inverted to Cr ₹750");

    // Verify double-reversal blocked
    const doubleRev = await apiRequest("POST", ["admin", "accounting", "journals", vch1.id, "reverse"], {
      reversal_reason: "Duplicate reversal attempt",
    }, reverserToken);
    assert(doubleRev.status === 409, "Double reversal rejected with 409");
    assert(doubleRev.json.error === "REVERSAL_VIOLATION", "Error is REVERSAL_VIOLATION");

    // Verify reversal-of-reversal blocked
    const revOfRev = await apiRequest("POST", ["admin", "accounting", "journals", revData.reversal_voucher.id, "reverse"], {
      reversal_reason: "Reversing a reversal voucher",
    }, reverserToken);
    assert(revOfRev.status === 409, "Reversal-of-reversal rejected with 409");
    assert(revOfRev.json.error === "REVERSAL_VIOLATION", "Error is REVERSAL_VIOLATION");

    // ── Teardown ─────────────────────────────────────────────────────────────
    console.log("\n--- Teardown: Restoring Clean PostgreSQL Baseline ---");
    if (testVoucherIds.length > 0) {
      await dbQuery(
        "DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1))",
        [testVoucherIds]
      );
      await dbQuery(
        "DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)",
        [testVoucherIds]
      );
      const delRes = await dbQuery(
        "DELETE FROM public.accounting_voucher WHERE id = ANY($1) RETURNING id",
        [testVoucherIds]
      );
      console.log(`  Purged ${delRes.rowCount} test voucher(s).`);
    }

    // Verify clean baseline
    const lingering = await dbQuery("SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.3%' OR reference_id LIKE 'c63%'");
    assert(lingering.rows.length === 0, "Zero C6.3 test vouchers remaining in database");

    const tb = await AccountingJournalRepository.getTrialBalance();
    const totalDebit = tb.reduce((sum, r) => sum + Number(r.total_debit || 0), 0);
    const totalCredit = tb.reduce((sum, r) => sum + Number(r.total_credit || 0), 0);
    const imbalance = Math.abs(totalDebit - totalCredit);
    assert(imbalance < 0.001, `Trial Balance zero-sum maintained: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}, diff=${imbalance.toFixed(4)}`);

    await closeDbPool();
  } catch (err) {
    console.error("FATAL ERROR IN C6.3 API TEST RUNNER:", err);
    process.exit(1);
  }

  console.log("\n==================================================================");
  console.log(`  C6.3 API TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runApiTests();
