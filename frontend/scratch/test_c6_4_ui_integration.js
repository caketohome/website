/**
 * CakeToHome ERP — Phase C6.4 Manual Journal UI Integration Test Suite
 *
 * Verifies all C6.4 UI contracts, API bindings, state transitions,
 * Segregation of Duties (SoD), and double-entry invariants:
 * 1. Postable leaf account listing (`include_groups=false`)
 * 2. Dynamic multi-line draft creation (`POST /draft`)
 * 3. Draft update in DRAFT status (`PUT /:id`)
 * 4. Submission workflow (`POST /:id/submit`)
 * 5. Four-eyes SoD approval (`POST /:id/approve`) with maker self-approval blocked
 * 6. Four-eyes SoD posting (`POST /:id/post`) with maker self-posting blocked
 * 7. Compensating reversal workflow (`POST /:id/reverse`) with maker self-reversal blocked
 * 8. Cancellation workflow (`POST /:id/cancel`)
 * 9. Server authoritative validation (No client-side accounting authority)
 * 10. Clean database teardown & Trial Balance zero-sum audit.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

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
const pool = new Pool({ connectionString: connStr });

// TypeScript transpile hook
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

// Map @frontend module alias
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolve.call(this, mapped, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const { signAuthToken } = require('../src/lib/security/auth-session');
const { GET, POST, PUT } = require('../src/app/api/v1/[...path]/route');
const { NextRequest } = require('next/server');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function testSuite() {
  console.log('==================================================================');
  console.log('  PHASE C6.4 MANUAL JOURNAL UI INTEGRATION TEST SUITE');
  console.log('==================================================================');

  const testVoucherIds = [];
  const client = await pool.connect();

  try {
    // ── Setup: Resolve Entities ───────────────────────────────────────────────
    console.log('\n--- Setup: Resolving System Entities ---');
    const branchRes = await client.query('SELECT id, name FROM public.branch LIMIT 2');
    const branchA = branchRes.rows[0].id;
    const branchB = branchRes.rows.length > 1 ? branchRes.rows[1].id : branchA;

    const accRes = await client.query('SELECT id, code, name, is_group, type FROM public.accounting_account');
    const cashAcc = accRes.rows.find(a => a.code === '1111');
    const cogsAcc = accRes.rows.find(a => a.code === '5110');
    const arAcc = accRes.rows.find(a => a.code === '1121');
    const apAcc = accRes.rows.find(a => a.code === '2111');
    const groupAcc = accRes.rows.find(a => a.is_group === true);

    const custRes = await client.query('SELECT id, first_name FROM public.customer LIMIT 1');
    const testCustomer = custRes.rows[0];

    const suppRes = await client.query('SELECT id, name FROM public.supplier LIMIT 1');
    const testSupplier = suppRes.rows[0];

    assert(Boolean(cashAcc), 'Cash account (1111) resolved');
    assert(Boolean(cogsAcc), 'COGS account (5110) resolved');
    assert(Boolean(arAcc), 'AR account (1121) resolved');
    assert(Boolean(apAcc), 'AP account (2111) resolved');
    assert(Boolean(groupAcc), 'Group account resolved for validation');

    // Create Authenticated Tokens for UI Actors
    const makerUid = `usr_c64_maker_${Date.now()}`;
    const checkerUid = `usr_c64_checker_${Date.now()}`;
    const posterUid = `usr_c64_poster_${Date.now()}`;
    const reverserUid = `usr_c64_reverser_${Date.now()}`;

    const makerToken = signAuthToken({
      userId: makerUid,
      role: 'BRANCH_MANAGER',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.CREATE'],
    });

    const checkerToken = signAuthToken({
      userId: checkerUid,
      role: 'BRANCH_MANAGER',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.APPROVE'],
    });

    const posterToken = signAuthToken({
      userId: posterUid,
      role: 'SUPER_ADMIN',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.POST'],
    });

    const reverserToken = signAuthToken({
      userId: reverserUid,
      role: 'SUPER_ADMIN',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.REVERSE'],
    });

    // Helper for calling Next.js Route handlers
    const apiCall = async (method, pathSegments, body = null, token = makerToken, searchParams = {}) => {
      const url = new URL(`http://localhost:3000/api/v1/${pathSegments.join('/')}`);
      for (const [k, v] of Object.entries(searchParams)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (body) headers.set('Content-Type', 'application/json');

      const req = new NextRequest(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let res;
      if (method === 'GET') res = await GET(req, { params: { path: pathSegments } });
      else if (method === 'POST') res = await POST(req, { params: { path: pathSegments } });
      else if (method === 'PUT') res = await PUT(req, { params: { path: pathSegments } });
      else throw new Error(`Unsupported method ${method}`);

      const json = await res.json();
      return { status: res.status, json };
    };

    // ── 1. Master Data Endpoints for UI ───────────────────────────────────────
    console.log('\n--- 1. Master Data Endpoints for UI ---');
    const accListRes = await apiCall('GET', ['admin', 'accounting', 'accounts'], null, makerToken, { include_groups: 'false' });
    assert(accListRes.status === 200, 'GET /admin/accounting/accounts?include_groups=false returned 200');
    assert(Array.isArray(accListRes.json.accounts), 'accounts array returned');
    const anyGroupInList = accListRes.json.accounts.some(a => a.is_group === true);
    assert(!anyGroupInList, 'Account selector restricted to postable leaf accounts only (zero groups)');

    // ── 2. New Journal Creation (Draft) via UI ─────────────────────────────────
    console.log('\n--- 2. Dynamic Entry Grid Draft Creation ---');
    const draftPayload = {
      branch_id: branchA,
      voucher_date: new Date().toISOString().split('T')[0],
      narration: 'C6.4 UI Test: Month-end accrual adjustment',
      lines: [
        {
          line_no: 1,
          account_id: cogsAcc.id,
          debit_amount: 1200,
          credit_amount: 0,
          narration: 'Line 1: Debit COGS',
        },
        {
          line_no: 2,
          account_id: cashAcc.id,
          debit_amount: 0,
          credit_amount: 1200,
          narration: 'Line 2: Credit Cash',
        },
      ],
    };

    const draftRes = await apiCall('POST', ['admin', 'accounting', 'journals', 'draft'], draftPayload, makerToken);
    assert(draftRes.status === 201, 'POST /draft returned 201 Created');
    const voucher1 = draftRes.json.data?.voucher || draftRes.json.data;
    testVoucherIds.push(voucher1.id);

    assert(voucher1.voucher_type === 'JOURNAL', "voucher_type === 'JOURNAL'");
    assert(voucher1.status === 'DRAFT', "status === 'DRAFT'");
    assert(voucher1.currency === 'INR', "currency === 'INR'");
    assert(Number(voucher1.total_amount) === 1200, 'total_amount is ₹1,200.00');
    assert(voucher1.created_by === makerUid, 'created_by recorded as authenticated maker');

    // ── 3. Draft Edit in DRAFT Status ──────────────────────────────────────────
    console.log('\n--- 3. Draft Update Workflow ---');
    const updatePayload = {
      branch_id: branchA,
      voucher_date: voucher1.voucher_date.split('T')[0],
      narration: 'C6.4 UI Test: Updated narration with revised ₹1,500 total',
      lines: [
        {
          line_no: 1,
          account_id: cogsAcc.id,
          debit_amount: 1500,
          credit_amount: 0,
          narration: 'Line 1 revised',
        },
        {
          line_no: 2,
          account_id: cashAcc.id,
          debit_amount: 0,
          credit_amount: 1500,
          narration: 'Line 2 revised',
        },
      ],
    };

    const updateRes = await apiCall('PUT', ['admin', 'accounting', 'journals', voucher1.id], updatePayload, makerToken);
    assert(updateRes.status === 200, 'PUT /journals/:id returned 200 OK');
    const updatedVch = updateRes.json.data?.voucher || updateRes.json.data;
    assert(Number(updatedVch.total_amount) === 1500, 'total_amount updated to ₹1,500.00');

    // ── 4. Journal List & Detail Retrieval ────────────────────────────────────
    console.log('\n--- 4. List & Detail Retrieval ---');
    const listRes = await apiCall('GET', ['admin', 'accounting', 'journals'], null, makerToken, { status: 'DRAFT' });
    assert(listRes.status === 200, 'GET /journals returned 200 OK');
    const journalsList = listRes.json.journals || listRes.json.data?.journals || [];
    const foundInList = journalsList.find(j => j.id === voucher1.id);
    assert(Boolean(foundInList), 'Voucher found in list with DRAFT filter');
    assert(foundInList.line_count === 2, 'line_count reflected in list table');

    const detailRes = await apiCall('GET', ['admin', 'accounting', 'journals', voucher1.id], null, makerToken);
    assert(detailRes.status === 200, 'GET /journals/:id returned 200 OK');
    assert(detailRes.json.data.proposed_lines.length === 2, 'Detail proposed_lines has 2 lines');
    assert(detailRes.json.data.journal_entry === null, 'journal_entry is null while in DRAFT status');
    assert(detailRes.json.data.posted_lines.length === 0, 'posted_lines is empty array while in DRAFT status');

    // ── 5. Client Cannot Assume Accounting Authority ─────────────────────────
    console.log('\n--- 5. Server Authoritative Validation (No Client Accounting Authority) ---');
    // Group account rejection
    const groupAttempt = await apiCall('POST', ['admin', 'accounting', 'journals', 'draft'], {
      branch_id: branchA,
      voucher_date: voucher1.voucher_date.split('T')[0],
      narration: 'Attempting to post group account',
      lines: [
        { line_no: 1, account_id: groupAcc.id, debit_amount: 100, credit_amount: 0 },
        { line_no: 2, account_id: cashAcc.id, debit_amount: 0, credit_amount: 100 },
      ],
    }, makerToken);
    assert(groupAttempt.status === 400, 'Server rejected group account with 400');
    assert(groupAttempt.json.error === 'GROUP_ACCOUNT_NOT_POSTABLE', 'Error code is GROUP_ACCOUNT_NOT_POSTABLE');

    // Unbalanced rejection
    const unbalancedAttempt = await apiCall('POST', ['admin', 'accounting', 'journals', 'draft'], {
      branch_id: branchA,
      voucher_date: voucher1.voucher_date.split('T')[0],
      narration: 'Attempting unbalanced journal',
      lines: [
        { line_no: 1, account_id: cogsAcc.id, debit_amount: 500, credit_amount: 0 },
        { line_no: 2, account_id: cashAcc.id, debit_amount: 0, credit_amount: 400 },
      ],
    }, makerToken);
    assert(unbalancedAttempt.status === 400, 'Server rejected unbalanced journal with 400');
    assert(unbalancedAttempt.json.error === 'JOURNAL_UNBALANCED', 'Error code is JOURNAL_UNBALANCED');

    // ── 6. Submission Workflow ────────────────────────────────────────────────
    console.log('\n--- 6. Submission Workflow ---');
    const submitRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'submit'], null, makerToken);
    assert(submitRes.status === 200, 'POST /submit returned 200 OK');
    const submittedVch = submitRes.json.data?.voucher || submitRes.json.data;
    assert(submittedVch.status === 'SUBMITTED', 'Voucher transitioned to SUBMITTED');
    assert(submittedVch.submitted_by === makerUid, 'submitted_by recorded as maker');

    // Editing submitted voucher is strictly blocked
    const editSubmittedRes = await apiCall('PUT', ['admin', 'accounting', 'journals', voucher1.id], updatePayload, makerToken);
    assert(editSubmittedRes.status === 409, 'Editing submitted voucher rejected with 409 INVALID_VOUCHER_STATE');

    // ── 7. Maker / Checker / Poster Segregation of Duties (SoD) ────────────────
    console.log('\n--- 7. Segregation of Duties (SoD) & Visual Gating Enforcement ---');
    // Maker with APPROVE permission injected to specifically test domain SoD check
    const makerWithApproveToken = signAuthToken({
      userId: makerUid,
      role: 'BRANCH_MANAGER',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.CREATE', 'ACCOUNTING.APPROVE'],
    });

    // Maker self-approval blocked
    const makerApproveRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'approve'], null, makerWithApproveToken);
    assert(makerApproveRes.status === 409, 'Maker self-approval blocked with 409');
    assert(makerApproveRes.json.error === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error is SEGREGATION_OF_DUTIES_VIOLATION');

    // Independent checker approves
    const checkerApproveRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'approve'], null, checkerToken);
    assert(checkerApproveRes.status === 200, 'Checker approval returned 200 OK');
    const approvedVch = checkerApproveRes.json.data?.voucher || checkerApproveRes.json.data;
    assert(approvedVch.status === 'APPROVED', 'Voucher transitioned to APPROVED');
    assert(approvedVch.approved_by === checkerUid, 'approved_by recorded as checker');

    // Maker with POST permission injected to specifically test domain SoD check
    const makerWithPostToken = signAuthToken({
      userId: makerUid,
      role: 'BRANCH_MANAGER',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.CREATE', 'ACCOUNTING.POST'],
    });

    // Maker self-post blocked
    const makerPostRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'post'], null, makerWithPostToken);
    assert(makerPostRes.status === 409, 'Maker self-post blocked with 409');
    assert(makerPostRes.json.error === 'SEGREGATION_OF_DUTIES_VIOLATION', 'Error is SEGREGATION_OF_DUTIES_VIOLATION');

    // Independent poster posts to General Ledger
    const posterPostRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'post'], null, posterToken);
    assert(posterPostRes.status === 200, 'Poster posted voucher to GL with 200 OK');
    const postedVch = posterPostRes.json.data?.voucher || posterPostRes.json.data;
    assert(postedVch.status === 'POSTED', 'Voucher status is POSTED');
    assert(postedVch.posted_by === posterUid, 'posted_by recorded as poster');
    assert(posterPostRes.json.data.journal_entry.lines.length === 2, '2 authoritative journal lines committed to GL');

    // Detail check after posting
    const postDetailRes = await apiCall('GET', ['admin', 'accounting', 'journals', voucher1.id], null, makerToken);
    assert(postDetailRes.status === 200, 'Detail after posting returned 200');
    assert(postDetailRes.json.data.posted_lines.length === 2, 'Authoritative posted_lines populated in detail view');
    assert(postDetailRes.json.data.proposed_lines.length === 2, 'Proposed lines snapshot preserved in metadata');

    // ── 8. Reversal Workflow & Four-Eyes Control ───────────────────────────────
    console.log('\n--- 8. Reversal Workflow & Four-Eyes Control ---');
    // Missing reason rejection
    const noReasonRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'reverse'], { reason: '' }, reverserToken);
    assert(noReasonRes.status === 400, 'Reversal without reason rejected with 400 VALIDATION_FAILED');

    // Maker with REVERSE permission injected to specifically test domain SoD check
    const makerWithReverseToken = signAuthToken({
      userId: makerUid,
      role: 'BRANCH_MANAGER',
      branchId: branchA,
      permissions: ['ACCOUNTING.VIEW', 'ACCOUNTING.CREATE', 'ACCOUNTING.REVERSE'],
    });

    // Maker self-reversal blocked
    const makerReverseRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'reverse'], { reason: 'Creator reversal' }, makerWithReverseToken);
    assert(makerReverseRes.status === 409, 'Maker self-reversal rejected with 409 SEGREGATION_OF_DUTIES_VIOLATION');

    // Independent financial controller reverses
    const reverserRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'reverse'], {
      reason: 'Audit correction: reclassifying equipment accrual',
    }, reverserToken);

    assert(reverserRes.status === 200, 'Reversal returned 200 OK');
    const reversalVoucher = reverserRes.json.data.reversal_voucher;
    testVoucherIds.push(reversalVoucher.id);

    assert(reversalVoucher.status === 'POSTED', 'Reversal voucher is POSTED');
    assert(reversalVoucher.reversal_of_voucher_id === voucher1.id, 'reversal_of_voucher_id links to original voucher');
    assert(reverserRes.json.data.original_voucher.reversed_by_voucher_id === reversalVoucher.id, 'original reversed_by_voucher_id links to reversal');
    assert(reverserRes.json.data.journal_entry.lines.length === 2, 'Compensating reversal journal entry has 2 lines');

    // Double reversal blocked
    const doubleRevRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'reverse'], {
      reason: 'Attempting second reversal',
    }, reverserToken);
    assert(doubleRevRes.status === 409, 'Double reversal rejected with 409 REVERSAL_VIOLATION');

    // ── 9. Cancellation Workflow ──────────────────────────────────────────────
    console.log('\n--- 9. Cancellation Workflow ---');
    // Create draft to cancel
    const cancelDraftRes = await apiCall('POST', ['admin', 'accounting', 'journals', 'draft'], draftPayload, makerToken);
    const voucherToCancel = cancelDraftRes.json.data?.voucher || cancelDraftRes.json.data;
    testVoucherIds.push(voucherToCancel.id);

    const cancelRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucherToCancel.id, 'cancel'], null, makerToken);
    assert(cancelRes.status === 200, 'POST /cancel returned 200 OK');
    const cancelledVch = cancelRes.json.data?.voucher || cancelRes.json.data;
    assert(cancelledVch.status === 'CANCELLED', 'Voucher status transitioned to CANCELLED');

    // Cancelling POSTED voucher blocked
    const cancelPostedRes = await apiCall('POST', ['admin', 'accounting', 'journals', voucher1.id, 'cancel'], null, makerToken);
    assert(cancelPostedRes.status === 409, 'Cancelling POSTED voucher rejected with 409 INVALID_VOUCHER_STATE');

  } catch (err) {
    console.error('UNEXPECTED TEST EXCEPTION:', err);
    failed++;
  } finally {
    console.log('\n--- Teardown: Restoring Clean Database Baseline ---');
    await client.query(
      "UPDATE public.accounting_voucher SET reversed_by_voucher_id = NULL, reversal_of_voucher_id = NULL WHERE id = ANY($1) OR narration LIKE 'C6.4%' OR reference_id LIKE 'c64%' OR created_by LIKE '%c64%'",
      [testVoucherIds]
    );
    await client.query(
      `DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (
        SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1) OR voucher_id IN (
          SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.4%' OR reference_id LIKE 'c64%' OR created_by LIKE '%c64%'
        )
      )`,
      [testVoucherIds]
    );
    await client.query(
      `DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1) OR voucher_id IN (
        SELECT id FROM public.accounting_voucher WHERE narration LIKE 'C6.4%' OR reference_id LIKE 'c64%' OR created_by LIKE '%c64%'
      )`,
      [testVoucherIds]
    );
    const del = await client.query(
      "DELETE FROM public.accounting_voucher WHERE id = ANY($1) OR narration LIKE 'C6.4%' OR reference_id LIKE 'c64%' OR created_by LIKE '%c64%' RETURNING id",
      [testVoucherIds]
    );
    console.log(`  Purged ${del.rowCount} C6.4 test voucher(s).`);

    // Verify baseline clean
    const lingering = await client.query("SELECT count(*)::int as count FROM public.accounting_voucher WHERE narration LIKE 'C6.4%' OR reference_id LIKE 'c64%' OR created_by LIKE '%c64%'");
    assert(lingering.rows[0].count === 0, 'Zero C6.4 test vouchers remaining in database');

    const tb = await client.query('SELECT COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr FROM public.accounting_journal_line');
    const diff = Math.abs(parseFloat(tb.rows[0].dr) - parseFloat(tb.rows[0].cr));
    assert(diff === 0, `Trial Balance zero-sum maintained: Dr=${tb.rows[0].dr}, Cr=${tb.rows[0].cr}, Diff=${diff.toFixed(4)}`);

    client.release();
    await pool.end();
  }

  console.log('\n==================================================================');
  console.log(`  C6.4 UI INTEGRATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================');

  if (failed > 0) process.exit(1);
}

testSuite();
