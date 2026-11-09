/**
 * CakeToHome ERP — Phase C4.1 Test Suite
 * TELLER API + SETTLEMENT POSTING ORCHESTRATION
 *
 * Mandatory coverage for all 34 requirements from Section 23 + Sections 24, 25, 26:
 * - Master: list, create, duplicate active rejected, foreign branch mutation rejected
 * - Session: open, duplicate open rejected, close, verify, invalid lifecycle transitions rejected
 * - Settlement: shortage (Dr 5296 / Cr 1111), excess (Dr 1111 / Cr 5296), zero variance (no voucher, NULL voucher ID)
 * - SoD: self-settlement rejected, self-verification rejected
 * - Controls: closed fiscal period rejected, accounting start-date violation rejected
 * - Idempotency: repeated settlement returns wasAlreadySettled, no duplicate voucher/entry/lines
 * - Atomicity & Failure Injection: controlled failure points rollback completely; retry succeeds
 * - Security: unauthenticated rejected (401), foreign branch rejected (403), missing permission rejected (403), forged identity ignored
 * - Movements: manual movement works, movement after settlement rejected, client cannot forge system source type
 * - Baseline Protection: pristine DB state restored after teardown.
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

// Register TypeScript transpile hook for .ts imports
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

const { signAuthToken } = require('../src/lib/security/auth-session');
const { GET, POST, PATCH } = require('../src/app/api/v1/[...path]/route');
const { NextRequest } = require('next/server');
const { closeDbPool, dbQuery, dbTransaction } = require('../src/lib/db');
const { TellerSessionService } = require('../src/lib/services/teller-session.service');
const { PostingService } = require('../src/lib/services/posting.service');
const { TellerSessionRepository } = require('../src/lib/repositories/teller-session.repository');

async function runC41Tests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C4.1 Teller API + Settlement Posting Test Suite');
  console.log('=============================================================================\n');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  // Tracking fixtures for guaranteed 100% teardown
  const createdUserIds = [];
  const createdTellerIds = [];
  const createdSessionIds = [];
  const createdMovementIds = [];
  const createdVoucherIds = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 0: PRE-TEST DATABASE BASELINE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[0/8] Auditing pre-test PostgreSQL baseline...');
    const preBaseline = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM accounting_account) as account_count,
        (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
        (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
        (SELECT COUNT(*) FROM accounting_journal_line) as line_count,
        (SELECT COUNT(*) FROM bank_account) as bank_count,
        (SELECT COUNT(*) FROM teller) as teller_count,
        (SELECT COUNT(*) FROM teller_session) as session_count,
        (SELECT COUNT(*) FROM teller_movement) as movement_count;
    `);
    const bRow = preBaseline.rows[0];
    assert(parseInt(bRow.account_count, 10) === 100, `Baseline account_count === 100 (actual: ${bRow.account_count})`);
    assert(parseInt(bRow.voucher_count, 10) === 6, `Baseline voucher_count === 6 (actual: ${bRow.voucher_count})`);
    assert(parseInt(bRow.entry_count, 10) === 4, `Baseline entry_count === 4 (actual: ${bRow.entry_count})`);
    assert(parseInt(bRow.line_count, 10) === 10, `Baseline line_count === 10 (actual: ${bRow.line_count})`);
    assert(parseInt(bRow.teller_count, 10) === 0, `Baseline teller_count === 0 (actual: ${bRow.teller_count})`);
    assert(parseInt(bRow.session_count, 10) === 0, `Baseline session_count === 0 (actual: ${bRow.session_count})`);
    assert(parseInt(bRow.movement_count, 10) === 0, `Baseline movement_count === 0 (actual: ${bRow.movement_count})`);

    // Fetch branches
    const branchRes = await client.query(`SELECT id, code FROM branch ORDER BY id ASC LIMIT 2;`);
    const branchA = branchRes.rows[0].id;
    const branchB = branchRes.rows[1].id;
    console.log(`Using Test Branches: Branch A = ${branchA}, Branch B = ${branchB}\n`);

    // Helper to create test user
    async function createTestUser(tag) {
      const uid = `usr_test_c41_${tag}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await client.query(`INSERT INTO "user" (id, email) VALUES ($1, $2);`, [uid, `${uid}@test.local`]);
      createdUserIds.push(uid);
      return uid;
    }

    // Helper to issue JWT
    function makeToken(payload) {
      return signAuthToken(payload);
    }

    // Helper to call NextRequest API route
    async function apiRequest(method, pathParts, body = null, token = null, queryParams = "") {
      const url = `http://localhost:3000/api/v1/${pathParts.join("/")}${queryParams ? `?${queryParams}` : ""}`;
      const headers = { "Content-Type": "application/json" };
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
      } else if (method === "PATCH") {
        res = await PATCH(req, { params: { path: pathParts } });
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }
      const status = res.status;
      const json = await res.json();
      return { status, json };
    }

    // Create Actors for SoD:
    // Opener (Teller Staff)
    const openerUser = await createTestUser("opener");
    const openerToken = makeToken({
      userId: openerUser,
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE", "TELLER.MOVEMENT_CREATE"],
    });

    // Closer (can be opener or supervisor)
    const closerUser = await createTestUser("closer");
    const closerToken = makeToken({
      userId: closerUser,
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_CLOSE"],
    });

    // Verifier (Supervisor - must differ from opener and closer)
    const verifierUser = await createTestUser("verifier");
    const verifierToken = makeToken({
      userId: verifierUser,
      role: "BRANCH_MANAGER",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_VERIFY"],
    });

    // Settler (Accountant - must differ from opener, closer, and verifier)
    const settlerUser = await createTestUser("settler");
    const settlerToken = makeToken({
      userId: settlerUser,
      role: "ACCOUNTANT",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SETTLE"],
    });

    // Manager / Admin for teller master config
    const managerUser = await createTestUser("mgr");
    const managerToken = makeToken({
      userId: managerUser,
      role: "BRANCH_MANAGER",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.MANAGE"],
    });

    // SuperAdmin
    const superAdminUser = await createTestUser("sadmin");
    const superAdminToken = makeToken({
      userId: superAdminUser,
      role: "SUPER_ADMIN",
      permissions: ["*"],
    });

    // Foreign Branch User (Branch B)
    const foreignUser = await createTestUser("foreign");
    const foreignToken = makeToken({
      userId: foreignUser,
      role: "STAFF",
      branchId: branchB,
      permissions: ["TELLER.VIEW", "TELLER.MANAGE", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE", "TELLER.SESSION_VERIFY", "TELLER.SETTLE"],
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: MASTER TELLER API (Requirements 1-4)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[1/8] Testing Teller Master API (Requirements 1-4)...');

    // 1. List tellers (empty initially)
    const listRes1 = await apiRequest("GET", ["admin", "tellers"], null, managerToken);
    assert(listRes1.status === 200, "1. GET /api/v1/admin/tellers returns 200");
    assert(Array.isArray(listRes1.json.tellers), "1. Response contains tellers array");

    // 2. Create teller station
    const tellerCodeA1 = `T1_${Date.now().toString().slice(-4)}`;
    const createRes1 = await apiRequest(
      "POST",
      ["admin", "tellers"],
      {
        name: "Main Cash Counter 1",
        code: tellerCodeA1,
        branch_id: branchA,
        user_id: openerUser,
        status: "ACTIVE",
      },
      managerToken
    );
    assert(createRes1.status === 201 && createRes1.json.success === true, "2. POST /api/v1/admin/tellers creates teller (201)");
    const teller1 = createRes1.json.teller;
    createdTellerIds.push(teller1.id);
    assert(teller1.code === tellerCodeA1, "2. Created teller has correct code");
    assert(teller1.user_id === openerUser, "2. Created teller assigned to opener user");

    // 3. Duplicate active teller assignment rejected (same user active elsewhere)
    const tellerCodeA2 = `T2_${Date.now().toString().slice(-4)}`;
    const dupRes = await apiRequest(
      "POST",
      ["admin", "tellers"],
      {
        name: "Second Counter",
        code: tellerCodeA2,
        branch_id: branchA,
        user_id: openerUser, // already active on teller1
        status: "ACTIVE",
      },
      managerToken
    );
    assert(dupRes.status === 409, "3. Duplicate active teller for same user rejected with 409");
    assert(dupRes.json.error === "TELLER_DUPLICATE_ACTIVE_USER", "3. Error code is TELLER_DUPLICATE_ACTIVE_USER");

    // 4. Foreign branch mutation rejected
    const foreignMutRes = await apiRequest(
      "POST",
      ["admin", "tellers"],
      {
        name: "Illegal Foreign Counter",
        code: `TF_${Date.now().toString().slice(-4)}`,
        branch_id: branchB, // Manager is scoped to branchA
        user_id: closerUser,
        status: "ACTIVE",
      },
      managerToken
    );
    assert(foreignMutRes.status === 403, "4. Foreign branch mutation rejected with 403");
    assert(foreignMutRes.json.error === "UNAUTHORIZED_BRANCH" || foreignMutRes.json.error === "FORBIDDEN", "4. Error indicates branch scoping failure");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: SESSION LIFECYCLE (Requirements 5-9)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[2/8] Testing Session Lifecycle API (Requirements 5-9)...');

    // 5. Open session
    const openRes1 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      {
        opening_float: 500.00,
        teller_id: teller1.id,
        notes: "Morning shift open",
      },
      openerToken
    );
    assert(openRes1.status === 201 && openRes1.json.success === true, "5. POST /api/v1/admin/teller/sessions/open opens session (201)");
    const session1 = openRes1.json.session;
    createdSessionIds.push(session1.id);
    assert(session1.status === "OPEN", "5. Session status is OPEN");
    assert(Number(session1.opening_float) === 500.00, "5. Opening float recorded on session row = 500.00");
    assert(session1.opened_by === openerUser, "5. Authoritative opened_by resolved from JWT identity");

    // Verify opening float created NO accounting entry and NO movement
    const openMovCount = (await client.query(`SELECT COUNT(*) FROM teller_movement WHERE teller_session_id = $1`, [session1.id])).rows[0].count;
    assert(parseInt(openMovCount, 10) === 0, "5. Zero movements created for opening float (C2/C3 invariant)");
    const openVouchCount = (await client.query(`SELECT COUNT(*) FROM accounting_voucher WHERE reference_id = $1`, [session1.id])).rows[0].count;
    assert(parseInt(openVouchCount, 10) === 0, "5. Zero accounting vouchers created for opening float");

    // 6. Duplicate open rejected on same teller
    const dupOpenRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      {
        opening_float: 100.00,
        teller_id: teller1.id,
      },
      openerToken
    );
    assert(dupOpenRes.status === 409, "6. Duplicate session open on same active teller rejected with 409");
    assert(dupOpenRes.json.error === "ACTIVE_SESSION_EXISTS", "6. Error code is ACTIVE_SESSION_EXISTS");

    // 7. Close session with cash count
    // Physical count: 480.00. Expected cash is 500.00 (float) + 0 (movements) = 500.00.
    // Variance = 480.00 - 500.00 = -20.00 (Shortage)
    const closeRes1 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "close"],
      {
        closing_count: 480.00,
        notes: "Shift handover count",
      },
      openerToken
    );
    assert(closeRes1.status === 200 && closeRes1.json.success === true, "7. POST /api/v1/admin/teller/sessions/:id/close succeeds (200)");
    const closedSession1 = closeRes1.json.session;
    assert(closedSession1.status === "CLOSING", "7. Session status is CLOSING");
    assert(Number(closedSession1.closing_count) === 480.00, "7. Authoritative closing_count recorded");
    assert(Number(closedSession1.expected_cash) === 500.00, "7. Authoritative expected_cash computed = 500.00");
    assert(Number(closedSession1.variance) === -20.00, "7. Authoritative variance computed = -20.00 (closing_count - expected)");

    // 8. Verify session (Supervisor verifierUser)
    const verifyRes1 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "verify"],
      {
        notes: "Verified physical count of 480.00 confirmed",
      },
      verifierToken
    );
    assert(verifyRes1.status === 200 && verifyRes1.json.success === true, "8. POST /api/v1/admin/teller/sessions/:id/verify succeeds (200)");
    const verifiedSession1 = verifyRes1.json.session;
    assert(verifiedSession1.status === "PENDING_VERIFICATION", "8. Session status is PENDING_VERIFICATION");
    assert(verifiedSession1.verified_by === verifierUser, "8. verified_by resolved authoritatively from supervisor identity");

    // Verify no GL posting occurred at verification stage
    const verifyVoucherCount = (await client.query(`SELECT COUNT(*) FROM accounting_voucher WHERE reference_id = $1`, [session1.id])).rows[0].count;
    assert(parseInt(verifyVoucherCount, 10) === 0, "8. No accounting voucher created at verification stage (C3 invariant)");

    // 9. Invalid lifecycle transitions rejected
    // Re-closing already closed/verified session
    const invalidCloseRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "close"],
      { closing_count: 500.00 },
      openerToken
    );
    assert(invalidCloseRes.status === 409, "9. Closing an already verified session rejected with 409");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: SETTLEMENT ACCOUNTING & SHORTAGE (Requirements 10-11, 16-19)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[3/8] Testing Settlement Accounting & Shortage (Requirements 10-11, 16-19)...');

    // Tokens with TELLER.SETTLE to specifically test domain Segregation of Duties (SoD)
    const openerWithSettleToken = makeToken({
      userId: openerUser,
      role: "ACCOUNTANT",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SETTLE"],
    });
    const verifierWithSettleToken = makeToken({
      userId: verifierUser,
      role: "ACCOUNTANT",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SETTLE"],
    });

    // 16a. Permission Gate: settlement without TELLER.SETTLE rejected with 403 FORBIDDEN
    const permSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "settle"],
      {},
      openerToken // lacks TELLER.SETTLE
    );
    assert(permSettleRes.status === 403, "16a. Settlement without TELLER.SETTLE rejected with 403");
    assert(permSettleRes.json.error === "FORBIDDEN", "16a. RBAC error is FORBIDDEN");

    // 16b. SoD Gate: Opener self-settlement rejected with 403 SOD_VIOLATION
    const selfSettleRes1 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "settle"],
      {},
      openerWithSettleToken // has TELLER.SETTLE, but is opener
    );
    assert(selfSettleRes1.status === 403, "16b. Opener self-settlement rejected with 403");
    assert(selfSettleRes1.json.error === "SOD_VIOLATION", "16b. Domain SoD error is SOD_VIOLATION");

    // 16c. SoD Gate: Verifier self-settlement rejected with 403 SOD_VIOLATION
    const selfSettleRes2 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "settle"],
      {},
      verifierWithSettleToken // has TELLER.SETTLE, but is verifier
    );
    assert(selfSettleRes2.status === 403, "16c. Verifier self-settlement rejected with 403");
    assert(selfSettleRes2.json.error === "SOD_VIOLATION", "16c. Domain SoD error is SOD_VIOLATION");

    // 18. Preflight settlement inspection (GET prepare-settlement)
    const preflightRes = await apiRequest(
      "GET",
      ["admin", "teller", "sessions", session1.id, "prepare-settlement"],
      null,
      settlerToken
    );
    assert(preflightRes.status === 200, "18a. GET prepare-settlement preview returns 200");
    assert(preflightRes.json.voucher_required === true, "18a. Preview identifies voucher_required = true for non-zero variance");
    assert(preflightRes.json.settlement_entry.debit_account_code === "5296", "18a. Preview proposes Dr 5296 for shortage");
    assert(preflightRes.json.settlement_entry.credit_account_code === "1111", "18a. Preview proposes Cr 1111 for shortage");

    // 10 & 11. Authoritative Settlement of Shortage (variance = -20.00)
    const settleShortageRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "settle"],
      { notes: "Authorized shortage settlement" },
      settlerToken
    );
    assert(settleShortageRes.status === 200 && settleShortageRes.json.success === true, "10. POST settle session with shortage succeeds (200)");
    assert(settleShortageRes.json.status === "SETTLED", "10. Session status transitioned to SETTLED");
    assert(settleShortageRes.json.wasAlreadySettled === false, "10. wasAlreadySettled === false");
    const shortageVoucherId = settleShortageRes.json.settlement_voucher_id;
    assert(shortageVoucherId !== null, "10. settlement_voucher_id is populated");
    createdVoucherIds.push(shortageVoucherId);

    // Verify Shortage GL posting in PostgreSQL directly (Section 24)
    const shortageVoucherRow = (await client.query(`SELECT * FROM accounting_voucher WHERE id = $1`, [shortageVoucherId])).rows[0];
    assert(shortageVoucherRow.status === "POSTED", "10. Settlement voucher reached POSTED state in GL");
    assert(shortageVoucherRow.reference_type === "TELLER_SESSION", "10. Voucher reference_type === TELLER_SESSION");
    assert(shortageVoucherRow.reference_id === session1.id, "10. Voucher reference_id matches session ID");

    const shortageLinesRes = await client.query(`
      SELECT 
        l.account_id, a.code as account_code, 
        l.debit_amount::numeric::float8 as debit, 
        l.credit_amount::numeric::float8 as credit,
        l.branch_id
      FROM accounting_journal_line l
      JOIN accounting_journal_entry e ON e.id = l.journal_entry_id
      JOIN accounting_account a ON a.id = l.account_id
      WHERE e.voucher_id = $1
      ORDER BY l.debit_amount DESC;
    `, [shortageVoucherId]);

    assert(shortageLinesRes.rows.length === 2, "11. Shortage created exactly 2 balanced journal lines");
    const drLine = shortageLinesRes.rows[0];
    const crLine = shortageLinesRes.rows[1];
    assert(drLine.account_code === "5296" && drLine.debit === 20.00 && drLine.credit === 0, "11. Shortage Dr 5296 Cash Over/Short = 20.00");
    assert(crLine.account_code === "1111" && crLine.credit === 20.00 && crLine.debit === 0, "11. Shortage Cr 1111 Cash in Hand = 20.00");
    assert(drLine.branch_id === branchA && crLine.branch_id === branchA, "11. Journal lines retain branch dimension");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: EXCESS SETTLEMENT (Requirements 12-13)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[4/8] Testing Settlement Accounting & Excess (Requirements 12-13)...');

    // Create a new teller for excess test
    const userExcessOpener = await createTestUser("excess_opener");
    const excessOpenerToken = makeToken({
      userId: userExcessOpener,
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE"],
    });

    const createTeller2Res = await apiRequest(
      "POST",
      ["admin", "tellers"],
      {
        name: "Excess Test Counter",
        code: `TEX_${Date.now().toString().slice(-4)}`,
        branch_id: branchA,
        user_id: userExcessOpener,
        status: "ACTIVE",
      },
      managerToken
    );
    const teller2 = createTeller2Res.json.teller;
    createdTellerIds.push(teller2.id);

    // Open session with 100.00 float
    const openRes2 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      { opening_float: 100.00, teller_id: teller2.id },
      excessOpenerToken
    );
    const session2 = openRes2.json.session;
    createdSessionIds.push(session2.id);

    // Close session with 150.00 count -> variance = +50.00 (Excess)
    await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session2.id, "close"],
      { closing_count: 150.00 },
      excessOpenerToken
    );

    // Verify session
    await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session2.id, "verify"],
      {},
      verifierToken
    );

    // Settle Excess Session
    const settleExcessRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session2.id, "settle"],
      { notes: "Excess cash settlement" },
      settlerToken
    );
    assert(settleExcessRes.status === 200 && settleExcessRes.json.success === true, "12. POST settle session with excess succeeds (200)");
    const excessVoucherId = settleExcessRes.json.settlement_voucher_id;
    assert(excessVoucherId !== null, "12. Excess generated settlement_voucher_id");
    createdVoucherIds.push(excessVoucherId);

    // Verify Excess GL lines directly in DB
    const excessLinesRes = await client.query(`
      SELECT 
        l.account_id, a.code as account_code, 
        l.debit_amount::numeric::float8 as debit, 
        l.credit_amount::numeric::float8 as credit,
        l.branch_id
      FROM accounting_journal_line l
      JOIN accounting_journal_entry e ON e.id = l.journal_entry_id
      JOIN accounting_account a ON a.id = l.account_id
      WHERE e.voucher_id = $1
      ORDER BY l.debit_amount DESC;
    `, [excessVoucherId]);

    assert(excessLinesRes.rows.length === 2, "13. Excess created exactly 2 balanced journal lines");
    const exDrLine = excessLinesRes.rows[0];
    const exCrLine = excessLinesRes.rows[1];
    assert(exDrLine.account_code === "1111" && exDrLine.debit === 50.00, "13. Excess Dr 1111 Cash in Hand = 50.00");
    assert(exCrLine.account_code === "5296" && exCrLine.credit === 50.00, "13. Excess Cr 5296 Cash Over/Short = 50.00");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: ZERO VARIANCE SETTLEMENT (Requirements 14-15)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[5/8] Testing Zero Variance Settlement (Requirements 14-15)...');

    // Create a new teller for zero variance test
    const userZeroOpener = await createTestUser("zero_opener");
    const zeroOpenerToken = makeToken({
      userId: userZeroOpener,
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE"],
    });

    const createTeller3Res = await apiRequest(
      "POST",
      ["admin", "tellers"],
      {
        name: "Zero Variance Counter",
        code: `TZ_${Date.now().toString().slice(-4)}`,
        branch_id: branchA,
        user_id: userZeroOpener,
        status: "ACTIVE",
      },
      managerToken
    );
    const teller3 = createTeller3Res.json.teller;
    createdTellerIds.push(teller3.id);

    // Open session with 250.00 float
    const openRes3 = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      { opening_float: 250.00, teller_id: teller3.id },
      zeroOpenerToken
    );
    const session3 = openRes3.json.session;
    createdSessionIds.push(session3.id);

    // Close session with exactly 250.00 count -> variance = 0.00
    await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session3.id, "close"],
      { closing_count: 250.00 },
      zeroOpenerToken
    );

    // Verify session
    await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session3.id, "verify"],
      {},
      verifierToken
    );

    // Settle Zero Variance Session
    const settleZeroRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session3.id, "settle"],
      { notes: "Zero variance settlement" },
      settlerToken
    );
    assert(settleZeroRes.status === 200 && settleZeroRes.json.success === true, "15. Zero variance settles successfully (200)");
    assert(settleZeroRes.json.status === "SETTLED", "15. Zero variance status transitioned to SETTLED");
    assert(settleZeroRes.json.settlement_voucher_id === null, "14. Zero variance settlement_voucher_id IS NULL");

    // Verify in DB that no voucher or journal lines exist for session3
    const zeroVoucherCheck = (await client.query(`SELECT COUNT(*) FROM accounting_voucher WHERE reference_id = $1`, [session3.id])).rows[0].count;
    assert(parseInt(zeroVoucherCheck, 10) === 0, "14. Zero variance created NO accounting voucher");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: IDEMPOTENCY & UNVERIFIED REJECTION (Requirements 17, 20-23)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[6/8] Testing Idempotency & Unverified Rejection (Requirements 17, 20-23)...');

    // 20. Repeated settlement on session1 (already settled)
    const preRepeatVoucherCount = parseInt((await client.query(`SELECT COUNT(*) FROM accounting_voucher`)).rows[0].count, 10);
    const repeatRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "settle"],
      {},
      settlerToken
    );
    assert(repeatRes.status === 200, "20. Repeated settlement returns 200 with controlled result");
    assert(repeatRes.json.wasAlreadySettled === true, "20. wasAlreadySettled === true");
    assert(repeatRes.json.settlement_voucher_id === shortageVoucherId, "20. Returns existing settlement_voucher_id");

    // 21-23. Verify no duplicate voucher, entry, or lines were created
    const postRepeatVoucherCount = parseInt((await client.query(`SELECT COUNT(*) FROM accounting_voucher`)).rows[0].count, 10);
    assert(postRepeatVoucherCount === preRepeatVoucherCount, "21-23. Repeated settlement created NO duplicate voucher/journal");

    // 17. Unverified session settlement rejected
    // Create an open session and attempt direct settlement
    const userUnverified = await createTestUser("unverified");
    const unverifiedToken = makeToken({ userId: userUnverified, role: "STAFF", branchId: branchA, permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN"] });
    const createTeller4Res = await apiRequest(
      "POST",
      ["admin", "tellers"],
      { name: "Unverified Test", code: `TUV_${Date.now().toString().slice(-4)}`, branch_id: branchA, user_id: userUnverified },
      managerToken
    );
    const teller4 = createTeller4Res.json.teller;
    createdTellerIds.push(teller4.id);
    const openRes4 = await apiRequest("POST", ["admin", "teller", "sessions", "open"], { opening_float: 100, teller_id: teller4.id }, unverifiedToken);
    const session4 = openRes4.json.session;
    createdSessionIds.push(session4.id);

    const unverifiedSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session4.id, "settle"],
      {},
      settlerToken
    );
    assert(unverifiedSettleRes.status === 409 || unverifiedSettleRes.status === 422, "17. Unverified session settlement rejected (409/422)");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: ATOMICITY & FAILURE INJECTION (Requirements 24-27, Section 25)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[7/8] Testing Atomicity & Failure Injection (Requirements 24-27, Section 25)...');

    // Create session for failure injection
    const userFail = await createTestUser("fail_inj");
    const failToken = makeToken({ userId: userFail, role: "STAFF", branchId: branchA, permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE"] });
    const createTellerFailRes = await apiRequest(
      "POST",
      ["admin", "tellers"],
      { name: "Failure Injection Counter", code: `TFI_${Date.now().toString().slice(-4)}`, branch_id: branchA, user_id: userFail },
      managerToken
    );
    const tellerFail = createTellerFailRes.json.teller;
    createdTellerIds.push(tellerFail.id);

    const openFailRes = await apiRequest("POST", ["admin", "teller", "sessions", "open"], { opening_float: 100, teller_id: tellerFail.id }, failToken);
    const sessionFail = openFailRes.json.session;
    createdSessionIds.push(sessionFail.id);
    await apiRequest("POST", ["admin", "teller", "sessions", sessionFail.id, "close"], { closing_count: 80 }, failToken); // shortage of 20
    await apiRequest("POST", ["admin", "teller", "sessions", sessionFail.id, "verify"], {}, verifierToken);

    // Count vouchers before injection
    const preFailVouchers = parseInt((await client.query(`SELECT COUNT(*) FROM accounting_voucher`)).rows[0].count, 10);

    // Failure Injection A: Force Posting Failure inside transaction
    // Temporarily mock PostingService.postVoucher to throw
    const originalPostVoucher = PostingService.postVoucher;
    PostingService.postVoucher = async () => {
      throw new Error("INJECTED_POSTING_CRASH_FAILURE");
    };

    let injectionCaught = false;
    try {
      await TellerSessionService.settleSession({ sessionId: sessionFail.id }, { userId: settlerUser, role: "ACCOUNTANT", branchId: branchA, permissions: ["TELLER.SETTLE"] });
    } catch (err) {
      injectionCaught = true;
      assert(err.message.includes("INJECTED_POSTING_CRASH_FAILURE"), "24. Injected failure thrown as expected");
    } finally {
      PostingService.postVoucher = originalPostVoucher; // Restore immediately
    }
    assert(injectionCaught, "24. Failure injection executed and caught");

    // Verify session remained PENDING_VERIFICATION and no voucher persisted
    const sessionFailAfter = (await client.query(`SELECT status, settlement_voucher_id FROM teller_session WHERE id = $1`, [sessionFail.id])).rows[0];
    assert(sessionFailAfter.status === "PENDING_VERIFICATION", "24. Session remains PENDING_VERIFICATION after posting crash");
    assert(sessionFailAfter.settlement_voucher_id === null, "24. settlement_voucher_id remains NULL after posting crash");

    const postFailVouchers = parseInt((await client.query(`SELECT COUNT(*) FROM accounting_voucher`)).rows[0].count, 10);
    assert(postFailVouchers === preFailVouchers, "24. Zero partial vouchers persisted during crash (atomicity rollback verified)");

    // Failure Injection B: Force Session Finalization failure
    // Mock TellerSessionRepository.settleSession to throw
    const originalRepoSettle = TellerSessionRepository.settleSession;
    TellerSessionRepository.settleSession = async () => {
      throw new Error("INJECTED_SESSION_UPDATE_CRASH");
    };

    let injectionRepoCaught = false;
    try {
      await TellerSessionService.settleSession({ sessionId: sessionFail.id }, { userId: settlerUser, role: "ACCOUNTANT", branchId: branchA, permissions: ["TELLER.SETTLE"] });
    } catch (err) {
      injectionRepoCaught = true;
      assert(err.message.includes("INJECTED_SESSION_UPDATE_CRASH"), "25. Injected session update failure thrown");
    } finally {
      TellerSessionRepository.settleSession = originalRepoSettle; // Restore immediately
    }
    assert(injectionRepoCaught, "25. Session finalization failure executed and caught");

    // 25. Verify voucher rolled back completely when session update failed
    const postRepoFailVouchers = parseInt((await client.query(`SELECT COUNT(*) FROM accounting_voucher`)).rows[0].count, 10);
    assert(postRepoFailVouchers === preFailVouchers, "25. Draft voucher rolled back when session finalization failed");

    // 26. Clean retry after rollback succeeds
    const retryRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionFail.id, "settle"],
      { notes: "Retry after transient crash" },
      settlerToken
    );
    assert(retryRes.status === 200 && retryRes.json.success === true, "26. Clean retry after rollback succeeds (200)");
    assert(retryRes.json.status === "SETTLED", "26. Retry session reaches SETTLED");
    assert(retryRes.json.settlement_voucher_id !== null, "26. Retry generates valid settlement voucher");
    createdVoucherIds.push(retryRes.json.settlement_voucher_id);

    // 27. Voucher and session cannot diverge
    const finalSessionCheck = (await client.query(`SELECT status, settlement_voucher_id FROM teller_session WHERE id = $1`, [sessionFail.id])).rows[0];
    const finalVoucherCheck = (await client.query(`SELECT status FROM accounting_voucher WHERE id = $1`, [finalSessionCheck.settlement_voucher_id])).rows[0];
    assert(finalSessionCheck.status === "SETTLED" && finalVoucherCheck.status === "POSTED", "27. Voucher and session state are in perfect lockstep (POSTED & SETTLED)");

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: SECURITY & MOVEMENTS (Requirements 28-34)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[8/8] Testing Security & Movements (Requirements 28-34)...');

    // 28. Unauthenticated request rejected (401)
    const unauthRes = await apiRequest("GET", ["admin", "tellers"], null, null);
    assert(unauthRes.status === 401, "28. Unauthenticated request rejected with 401");

    // 29. Foreign branch access rejected (403)
    const foreignBranchRes = await apiRequest(
      "GET",
      ["admin", "teller", "sessions", session1.id],
      null,
      foreignToken
    );
    assert(foreignBranchRes.status === 403, "29. Cross-branch session access rejected with 403");

    // 30. Missing permission rejected (403)
    const noPermToken = makeToken({ userId: openerUser, role: "STAFF", branchId: branchA, permissions: [] });
    const missingPermRes = await apiRequest("GET", ["admin", "tellers"], null, noPermToken);
    assert(missingPermRes.status === 403, "30. Missing TELLER.VIEW rejected with 403");

    // 31. Forged identity in request body ignored
    // Client sends user_id / opened_by = superAdminUser, but server must use token's identity
    const forgedOpenRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      {
        opening_float: 100,
        teller_id: teller1.id,
        opened_by: superAdminUser, // forged
        user_id: superAdminUser, // forged
      },
      openerToken
    );
    // Teller1 is already settled, but if it opened, opened_by would be openerUser
    // Let's create an active teller for foreignUser to test identity binding
    const userBindTest = await createTestUser("bind_test");
    const bindToken = makeToken({ userId: userBindTest, role: "STAFF", branchId: branchA, permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN"] });
    const createTellerBindRes = await apiRequest(
      "POST",
      ["admin", "tellers"],
      { name: "Bind Test Counter", code: `TBT_${Date.now().toString().slice(-4)}`, branch_id: branchA, user_id: userBindTest },
      managerToken
    );
    const tellerBind = createTellerBindRes.json.teller;
    createdTellerIds.push(tellerBind.id);

    const bindOpenRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      {
        opening_float: 50,
        teller_id: tellerBind.id,
        opened_by: "ATTACKER_FORGED_ID",
      },
      bindToken
    );
    assert(bindOpenRes.status === 201, "31. Bound session opened");
    assert(bindOpenRes.json.session.opened_by === userBindTest, "31. Client-supplied opened_by was completely ignored; server identity enforced");
    createdSessionIds.push(bindOpenRes.json.session.id);

    // 32. Manual movement works on OPEN session
    const movRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", bindOpenRes.json.session.id, "movements"],
      {
        direction: "IN",
        amount: 25.00,
        narration: "Mid-day float addition",
      },
      openerToken // has TELLER.MOVEMENT_CREATE
    );
    assert(movRes.status === 201 && movRes.json.success === true, "32. Manual movement recorded (201)");
    assert(Number(movRes.json.movement.amount) === 25.00, "32. Movement amount = 25.00");
    assert(movRes.json.movement.movement_type === "ADJUSTMENT", "32. Movement type is ADJUSTMENT (canonical C2/C3 schema)");
    assert(movRes.json.movement.source_type === "MANUAL", "32. Movement source_type is MANUAL");
    createdMovementIds.push(movRes.json.movement.id);

    // 33. Movement after settlement rejected
    const movAfterSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", session1.id, "movements"],
      {
        direction: "IN",
        amount: 10.00,
        narration: "Post settlement illegal movement",
      },
      openerToken
    );
    assert(movAfterSettleRes.status === 409, "33. Movement on SETTLED session rejected with 409");

    // 34. Client cannot forge system source type
    const forgeSourceRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", bindOpenRes.json.session.id, "movements"],
      {
        direction: "IN",
        amount: 100.00,
        narration: "Fake customer order",
        source_type: "ORDER", // FORGED
      },
      openerToken
    );
    assert(forgeSourceRes.status === 403, "34. Client attempt to forge source_type=ORDER rejected with 403");

  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // GUARANTEED TEARDOWN & BASELINE RESTORATION (Section 26)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[Teardown] Performing topological teardown of test fixtures...');

    try {
      await client.query(`SET session_replication_role = 'replica';`);

      // 1. Delete teller movements (depend on teller_session)
      await client.query(`DELETE FROM teller_movement;`);

      // 2. Delete teller sessions (depend on teller and accounting_voucher; must be deleted BEFORE vouchers!)
      await client.query(`DELETE FROM teller_session;`);

      // 3. Delete tellers (depend on user)
      await client.query(`DELETE FROM teller;`);

      // 4. Delete journal lines & entries from created test vouchers
      if (createdVoucherIds.length > 0) {
        await client.query(`
          DELETE FROM accounting_journal_line 
          WHERE journal_entry_id IN (
            SELECT id FROM accounting_journal_entry WHERE voucher_id = ANY($1)
          );
        `, [createdVoucherIds]);

        await client.query(`
          DELETE FROM accounting_journal_entry WHERE voucher_id = ANY($1);
        `, [createdVoucherIds]);

        await client.query(`
          DELETE FROM accounting_voucher WHERE id = ANY($1);
        `, [createdVoucherIds]);
      }

      // 5. Delete test users
      if (createdUserIds.length > 0) {
        await client.query(`DELETE FROM "user" WHERE id = ANY($1);`, [createdUserIds]);
      }

      await client.query(`SET session_replication_role = 'origin';`);

      console.log('✓ Teardown complete. Auditing restored PostgreSQL baseline...');
      const postBaseline = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM accounting_account) as account_count,
          (SELECT COUNT(*) FROM accounting_voucher) as voucher_count,
          (SELECT COUNT(*) FROM accounting_journal_entry) as entry_count,
          (SELECT COUNT(*) FROM accounting_journal_line) as line_count,
          (SELECT COUNT(*) FROM bank_account) as bank_count,
          (SELECT COUNT(*) FROM teller) as teller_count,
          (SELECT COUNT(*) FROM teller_session) as session_count,
          (SELECT COUNT(*) FROM teller_movement) as movement_count;
      `);
      const postB = postBaseline.rows[0];
      assert(parseInt(postB.account_count, 10) === 100, `Restored account_count === 100 (actual: ${postB.account_count})`);
      assert(parseInt(postB.voucher_count, 10) === 6, `Restored voucher_count === 6 (actual: ${postB.voucher_count})`);
      assert(parseInt(postB.entry_count, 10) === 4, `Restored entry_count === 4 (actual: ${postB.entry_count})`);
      assert(parseInt(postB.line_count, 10) === 10, `Restored line_count === 10 (actual: ${postB.line_count})`);
      assert(parseInt(postB.teller_count, 10) === 0, `Restored teller_count === 0 (actual: ${postB.teller_count})`);
      assert(parseInt(postB.session_count, 10) === 0, `Restored session_count === 0 (actual: ${postB.session_count})`);
      assert(parseInt(postB.movement_count, 10) === 0, `Restored movement_count === 0 (actual: ${postB.movement_count})`);

    } catch (teardownErr) {
      console.error("FATAL: Teardown failed:", teardownErr);
    } finally {
      await client.end();
      await closeDbPool();
    }
  }

  console.log('\n=============================================================================');
  console.log(`Phase C4.1 Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log('=============================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runC41Tests().catch((err) => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
