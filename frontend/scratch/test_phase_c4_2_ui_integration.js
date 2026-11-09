/**
 * CakeToHome ERP — Phase C4.2 UI Integration & End-to-End Verification Test Suite
 *
 * Verifies all 4 C4.2 Operational UI Views, API interactions, RBAC, and SoD guards:
 * - View 1: Active Drawer (Open, In/Out Adjustments, Close Shift & Count)
 * - View 2: Verification & Settlement Queue (Supervisor Verification, Accountant Preflight & Settle)
 * - View 3: Session History (Historical audit trail, movement inspection)
 * - View 4: Teller Counter Master (Counter creation, staff assignment, active/inactive toggle)
 * - RBAC & SoD enforcement: Opener != Verifier != Settler
 * - Baseline cleanup & audit: Zero lingering DB artifacts.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
const { closeDbPool } = require('../src/lib/db');

async function runC42IntegrationTests() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C4.2 UI Integration & Security Test Suite');
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

  // Tracking fixtures for guaranteed teardown
  const createdUserIds = [];
  const createdTellerIds = [];
  const createdSessionIds = [];

  try {
    // 0. Resolve realistic branches
    const branchRes = await client.query('SELECT id, name FROM branch ORDER BY id LIMIT 2');
    if (branchRes.rows.length === 0) {
      throw new Error("No branches found in database");
    }
    const branchA = branchRes.rows[0].id;
    const branchB = branchRes.rows.length > 1 ? branchRes.rows[1].id : branchA;

    // Helper: Create temporary user
    async function createTestUser(tag) {
      const id = `usr_c42_${tag}_${Date.now().toString().slice(-6)}`;
      const email = `${id}@fixture.internal`;
      await client.query(
        `INSERT INTO "user" (id, email, first_name, last_name) VALUES ($1, $2, $3, $4)`,
        [id, email, `Test_${tag}`, 'C42']
      );
      createdUserIds.push(id);
      return id;
    }

    // Helper: Make JWT cookie token
    function makeToken(payload) {
      return signAuthToken(payload);
    }

    // Helper: NextRequest dispatcher
    async function apiRequest(method, pathSegments, body = null, token = null, queryParams = {}) {
      const urlStr = `http://localhost:3000/api/v1/${pathSegments.join('/')}${
        Object.keys(queryParams).length > 0 ? '?' + new URLSearchParams(queryParams).toString() : ''
      }`;
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('Cookie', `_cth_jwt=${token}`);
      }
      if (body) {
        headers.set('Content-Type', 'application/json');
      }

      const req = new NextRequest(urlStr, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let res;
      if (method === 'GET') {
        res = await GET(req, { params: { path: pathSegments } });
      } else if (method === 'POST') {
        res = await POST(req, { params: { path: pathSegments } });
      } else if (method === 'PATCH') {
        res = await PATCH(req, { params: { path: pathSegments } });
      } else {
        throw new Error(`Unsupported method ${method}`);
      }
      const status = res.status;
      const json = await res.json();
      return { status, json };
    }

    // Create 4 distinct actors to enforce Segregation of Duties (SoD)
    // 1. Opener (Teller Staff)
    const openerUser = await createTestUser("cashier");
    const openerToken = makeToken({
      userId: openerUser,
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE", "TELLER.MOVEMENT_CREATE"],
    });

    // 2. Supervisor (Branch Manager)
    const verifierUser = await createTestUser("supervisor");
    const verifierToken = makeToken({
      userId: verifierUser,
      role: "BRANCH_MANAGER",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_VERIFY"],
    });

    // 3. Accountant (Settler)
    const settlerUser = await createTestUser("accountant");
    const settlerToken = makeToken({
      userId: settlerUser,
      role: "ACCOUNTANT",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SETTLE"],
    });

    // 4. Admin (Station Manager)
    const adminUser = await createTestUser("admin");
    const adminToken = makeToken({
      userId: adminUser,
      role: "SUPER_ADMIN",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.MANAGE", "TELLER.SESSION_OPEN", "TELLER.SESSION_CLOSE", "TELLER.SESSION_VERIFY", "TELLER.SETTLE"],
    });

    console.log('[Phase C4.2 UI Integration - Step 1]: Teller Counter Master View');
    // 1. Create a teller counter
    const tellerCode = `TC_${Date.now().toString().slice(-4)}`;
    const createTellerRes = await apiRequest(
      "POST",
      ["admin", "tellers"],
      {
        name: "Express Front Counter",
        code: tellerCode,
        branch_id: branchA,
        user_id: openerUser,
        status: "ACTIVE",
      },
      adminToken
    );
    assert(createTellerRes.status === 201, "Teller station created with 201 Created");
    assert(createTellerRes.json.teller?.id !== undefined, "Response contains valid teller record");
    const tellerId = createTellerRes.json.teller.id;
    createdTellerIds.push(tellerId);

    // 2. List tellers with branch filter
    const listTellersRes = await apiRequest("GET", ["admin", "tellers"], null, openerToken, { branch_id: branchA });
    assert(listTellersRes.status === 200, "GET /api/v1/admin/tellers returns 200");
    const foundTeller = listTellersRes.json.tellers.find(t => t.id === tellerId);
    assert(foundTeller && foundTeller.name === "Express Front Counter", "Created teller is visible in master table");

    // 3. Toggle teller station status (PATCH)
    const patchRes = await apiRequest("PATCH", ["admin", "tellers", tellerId], { status: "INACTIVE" }, adminToken);
    assert(patchRes.status === 200, "PATCH /api/v1/admin/tellers/:id returns 200 on status update");
    assert(patchRes.json.teller?.status === "INACTIVE", "Teller status toggled to INACTIVE");
    // Re-activate for session operations
    await apiRequest("PATCH", ["admin", "tellers", tellerId], { status: "ACTIVE" }, adminToken);

    console.log('\n[Phase C4.2 UI Integration - Step 2]: Active Drawer View (Shift Open, Float, In/Out Movements, Close)');
    // 4. Check active session initially (should be null)
    const activeBeforeRes = await apiRequest("GET", ["admin", "teller", "sessions", "active"], null, openerToken, { teller_id: tellerId });
    assert(activeBeforeRes.status === 200 && activeBeforeRes.json.session === null, "Active session is null before opening");

    // 5. Open shift with float of 1500
    const openRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", "open"],
      {
        teller_id: tellerId,
        branch_id: branchA,
        opening_float: 1500,
        notes: "Morning shift float",
      },
      openerToken
    );
    assert(openRes.status === 201, "POST /api/v1/admin/teller/sessions/open returns 201 Created");
    assert(openRes.json.session?.status === "OPEN", "New session status is OPEN");
    assert(Number(openRes.json.session?.opening_float) === 1500, "Opening float is recorded as ₹1,500");
    assert(Number(openRes.json.session?.expected_cash) === 1500, "Expected cash initialized to ₹1,500");
    const sessionId = openRes.json.session.id;
    createdSessionIds.push(sessionId);

    // 6. Active session endpoint returns the newly opened shift
    const activeAfterRes = await apiRequest("GET", ["admin", "teller", "sessions", "active"], null, openerToken, { teller_id: tellerId });
    assert(activeAfterRes.status === 200 && activeAfterRes.json.session?.id === sessionId, "Active session returns newly opened shift");

    // 7. Record cash IN movement (Cash Injection / Change fund)
    const moveInRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "movements"],
      {
        direction: "IN",
        amount: 250,
        narration: "Change replenishment from vault",
      },
      openerToken
    );
    assert(moveInRes.status === 201, "Manual Cash IN movement recorded with 201 Created");
    assert(moveInRes.json.movement?.movement_type === "ADJUSTMENT", "Movement type is ADJUSTMENT");
    assert(moveInRes.json.movement?.source_type === "MANUAL", "Source type is MANUAL");

    // 8. Record cash OUT movement (Emergency petty cash drop)
    const moveOutRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "movements"],
      {
        direction: "OUT",
        amount: 100,
        narration: "Kitchen dairy petty cash purchase",
      },
      openerToken
    );
    assert(moveOutRes.status === 201, "Manual Cash OUT movement recorded with 201 Created");

    // 9. Inspect movements ledger
    const movementsRes = await apiRequest("GET", ["admin", "teller", "sessions", sessionId, "movements"], null, openerToken);
    assert(movementsRes.status === 200, "GET movements ledger returns 200");
    assert(movementsRes.json.movements.length === 2, "Ledger contains exactly 2 recorded movements");

    // 10. Close shift with physical cash count
    // Expected cash: 1500 (float) + 250 (IN) - 100 (OUT) = 1650
    // Physical count: 1600 (50 shortage)
    const closeRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "close"],
      {
        closing_count: 1600,
        notes: "Shift closed by teller. Physical count: 1600",
      },
      openerToken
    );
    assert(closeRes.status === 200, "POST /close returns 200 OK");
    assert(closeRes.json.session?.status === "CLOSING", "Session status transitioned to CLOSING");
    assert(Number(closeRes.json.session?.expected_cash) === 1650, "Expected cash is server-calculated at ₹1,650");
    assert(Number(closeRes.json.session?.closing_count) === 1600, "Physical closing count recorded as ₹1,600");
    assert(Number(closeRes.json.session?.variance) === -50, "Shortage variance is server-calculated as -₹50");

    console.log('\n[Phase C4.2 UI Integration - Step 3]: Verification & Settlement Queue View (Supervisor & Accountant)');
    // 11. List queue items with status CLOSING
    const closingQueueRes = await apiRequest("GET", ["admin", "teller", "sessions"], null, verifierToken, { status: "CLOSING", branch_id: branchA });
    assert(closingQueueRes.status === 200, "GET queue for CLOSING sessions returns 200");
    const closingItem = closingQueueRes.json.sessions.find(s => s.id === sessionId);
    assert(closingItem !== undefined, "Session appears in Supervisor Verification Queue");

    // 12a. RBAC check: Staff without TELLER.SESSION_VERIFY blocked with 403 FORBIDDEN
    const rbacVerifyRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "verify"],
      { notes: "RBAC verify attempt" },
      openerToken // lacks TELLER.SESSION_VERIFY
    );
    assert(rbacVerifyRes.status === 403, "RBAC: Verification without TELLER.SESSION_VERIFY rejected with 403");
    assert(rbacVerifyRes.json.error === "FORBIDDEN", "RBAC error code is FORBIDDEN");

    // 12b. SoD check: Opener WITH permission cannot verify own session (SOD_VIOLATION)
    const openerWithVerifyToken = makeToken({
      userId: openerUser,
      role: "BRANCH_MANAGER",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SESSION_VERIFY"],
    });
    const selfVerifyRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "verify"],
      { notes: "Self-verification attempt" },
      openerWithVerifyToken
    );
    assert(selfVerifyRes.status === 403, "SoD: Opener self-verification is blocked with 403");
    assert(selfVerifyRes.json.error === "SOD_VIOLATION", "Domain SoD error code is SOD_VIOLATION");

    // 13. Supervisor verification (Authorized)
    const supervisorVerifyRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "verify"],
      { notes: "Supervisor verified physical count of 1600. Variance -50 approved for settlement." },
      verifierToken
    );
    assert(supervisorVerifyRes.status === 200, "Supervisor verification succeeds with 200 OK");
    assert(supervisorVerifyRes.json.session?.status === "PENDING_VERIFICATION", "Status transitioned to PENDING_VERIFICATION");

    // 14. List queue items with status PENDING_VERIFICATION (Accountant Queue)
    const settlementQueueRes = await apiRequest("GET", ["admin", "teller", "sessions"], null, settlerToken, { status: "PENDING_VERIFICATION", branch_id: branchA });
    assert(settlementQueueRes.status === 200, "GET queue for PENDING_VERIFICATION returns 200");
    const settlementItem = settlementQueueRes.json.sessions.find(s => s.id === sessionId);
    assert(settlementItem !== undefined, "Session appears in Accountant Settlement Queue");

    // 15. Preflight settlement preview (GET prepare-settlement)
    const prepareRes = await apiRequest(
      "GET",
      ["admin", "teller", "sessions", sessionId, "prepare-settlement"],
      null,
      settlerToken
    );
    assert(prepareRes.status === 200, "GET /prepare-settlement returns 200 preflight");
    assert(prepareRes.json.voucher_required === true, "Shortage requires voucher (voucher_required = true)");
    assert(prepareRes.json.settlement_entry?.debit_account_code === "5296", "Preflight specifies Dr 5296 (Cash Over/Short)");
    assert(prepareRes.json.settlement_entry?.credit_account_code === "1111", "Preflight specifies Cr 1111 (Cash in Hand)");
    assert(Number(prepareRes.json.settlement_entry?.amount) === 50, "Preflight amount matches variance magnitude (50)");

    // 16a. RBAC check: Staff without TELLER.SETTLE blocked with 403 FORBIDDEN
    const rbacSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "settle"],
      { notes: "RBAC settle attempt" },
      openerToken // lacks TELLER.SETTLE
    );
    assert(rbacSettleRes.status === 403, "RBAC: Settlement without TELLER.SETTLE rejected with 403");
    assert(rbacSettleRes.json.error === "FORBIDDEN", "RBAC error code is FORBIDDEN");

    // 16b. SoD check: Opener WITH permission cannot settle own session (SOD_VIOLATION)
    const openerWithSettleToken = makeToken({
      userId: openerUser,
      role: "ACCOUNTANT",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SETTLE"],
    });
    const openerSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "settle"],
      { notes: "Opener self-settle attempt" },
      openerWithSettleToken
    );
    assert(openerSettleRes.status === 403, "SoD: Opener self-settlement is blocked with 403");
    assert(openerSettleRes.json.error === "SOD_VIOLATION", "Domain SoD error code is SOD_VIOLATION");

    // 17. SoD check: Verifier WITH permission cannot settle session they verified (SOD_VIOLATION)
    const verifierWithSettleToken = makeToken({
      userId: verifierUser,
      role: "ACCOUNTANT",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.SETTLE"],
    });
    const verifierSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "settle"],
      { notes: "Verifier settle attempt" },
      verifierWithSettleToken
    );
    assert(verifierSettleRes.status === 403, "SoD: Verifier self-settlement is blocked with 403");
    assert(verifierSettleRes.json.error === "SOD_VIOLATION", "Domain SoD error code is SOD_VIOLATION");

    // 18. Independent Accountant settles session
    const finalSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "settle"],
      { notes: "Shortage settled to GL account 5296" },
      settlerToken
    );
    assert(finalSettleRes.status === 200, "Independent Accountant settlement succeeds with 200 OK");
    assert(finalSettleRes.json.status === "SETTLED", "Session status is SETTLED");
    assert(finalSettleRes.json.settlement_voucher_id !== null, "Settlement voucher ID is populated");
    assert(finalSettleRes.json.wasAlreadySettled === false, "First settlement returns wasAlreadySettled = false");

    // 19. Idempotency check: Repeated settlement
    const idempotentSettleRes = await apiRequest(
      "POST",
      ["admin", "teller", "sessions", sessionId, "settle"],
      { notes: "Duplicate settle" },
      settlerToken
    );
    assert(idempotentSettleRes.status === 200, "Idempotent settle returns 200 OK");
    assert(idempotentSettleRes.json.wasAlreadySettled === true, "Repeated settlement returns wasAlreadySettled = true");

    console.log('\n[Phase C4.2 UI Integration - Step 4]: Session History & Audit Trail View');
    // 20. List historical sessions
    const historyRes = await apiRequest("GET", ["admin", "teller", "sessions"], null, settlerToken, { branch_id: branchA });
    assert(historyRes.status === 200, "GET /api/v1/admin/teller/sessions history returns 200");
    const histItem = historyRes.json.sessions.find(s => s.id === sessionId);
    assert(histItem && histItem.status === "SETTLED", "Settled session is visible in audit history");
    assert(histItem.settlement_voucher_id !== null, "Historical record contains linked settlement voucher");

    // 21. Movement audit check for historical session
    const histMovementsRes = await apiRequest("GET", ["admin", "teller", "sessions", sessionId, "movements"], null, settlerToken);
    assert(histMovementsRes.status === 200 && histMovementsRes.json.movements.length === 2, "All movements preserved in historical record");

    console.log('\n[Phase C4.2 UI Integration - Step 5]: Security & Foreign Branch Access');
    // 22. Unauthenticated request rejected with 401
    const unauthRes = await apiRequest("GET", ["admin", "teller", "sessions"]);
    assert(unauthRes.status === 401, "Unauthenticated request rejected with 401 Unauthorized");

    // 23. Unauthorized role (e.g. guest or missing TELLER permission) rejected with 403
    const unauthorizedToken = makeToken({
      userId: openerUser,
      role: "STAFF",
      branchId: branchA,
      permissions: ["ORDERS.VIEW"], // No TELLER permissions
    });
    const unauthPermRes = await apiRequest("GET", ["admin", "teller", "sessions"], null, unauthorizedToken);
    assert(unauthPermRes.status === 403, "Staff with missing TELLER permission rejected with 403 Forbidden");

    // 24. Foreign branch isolation: user at branch B cannot access session at branch A
    const foreignBranchToken = makeToken({
      userId: verifierUser,
      role: "BRANCH_MANAGER",
      branchId: branchB, // Different branch
      permissions: ["TELLER.VIEW", "TELLER.SESSION_VERIFY"],
    });
    const foreignRes = await apiRequest("GET", ["admin", "teller", "sessions", sessionId], null, foreignBranchToken);
    assert(foreignRes.status === 403, "Foreign branch staff cannot view session at branch A (403 Unauthorized Branch)");

    // 25. User with TELLER.VIEW only can read but cannot perform any operational mutations
    const viewOnlyToken = makeToken({
      userId: "viewer_user_" + Date.now(),
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.VIEW"],
    });
    const viewListRes = await apiRequest("GET", ["admin", "teller", "sessions"], null, viewOnlyToken);
    assert(viewListRes.status === 200, "User with TELLER.VIEW only can list sessions (200)");

    const viewOpenRes = await apiRequest("POST", ["admin", "teller", "sessions", "open"], { teller_id: "tlr_dummy", opening_float: 100 }, viewOnlyToken);
    assert(viewOpenRes.status === 403 && viewOpenRes.json.error === "FORBIDDEN", "User with TELLER.VIEW only cannot open session (403 FORBIDDEN)");

    const viewMovementRes = await apiRequest("POST", ["admin", "teller", "sessions", sessionId, "movements"], { direction: "IN", amount: 10, narration: "test" }, viewOnlyToken);
    assert(viewMovementRes.status === 403 && viewMovementRes.json.error === "FORBIDDEN", "User with TELLER.VIEW only cannot record movements (403 FORBIDDEN)");

    const viewCloseRes = await apiRequest("POST", ["admin", "teller", "sessions", sessionId, "close"], { closing_count: 100 }, viewOnlyToken);
    assert(viewCloseRes.status === 403 && viewCloseRes.json.error === "FORBIDDEN", "User with TELLER.VIEW only cannot close session (403 FORBIDDEN)");

    const viewVerifyRes = await apiRequest("POST", ["admin", "teller", "sessions", sessionId, "verify"], { notes: "verify" }, viewOnlyToken);
    assert(viewVerifyRes.status === 403 && viewVerifyRes.json.error === "FORBIDDEN", "User with TELLER.VIEW only cannot verify session (403 FORBIDDEN)");

    const viewSettleRes = await apiRequest("POST", ["admin", "teller", "sessions", sessionId, "settle"], { notes: "settle" }, viewOnlyToken);
    assert(viewSettleRes.status === 403 && viewSettleRes.json.error === "FORBIDDEN", "User with TELLER.VIEW only cannot settle session (403 FORBIDDEN)");

    const viewManageRes = await apiRequest("POST", ["admin", "tellers"], { name: "Counter X", code: "CX", user_id: "u_x" }, viewOnlyToken);
    assert(viewManageRes.status === 403 && viewManageRes.json.error === "FORBIDDEN", "User with TELLER.VIEW only cannot create teller counter (403 FORBIDDEN)");

    // 26. User with TELLER.REPORT_VIEW only can read sessions audit & movements
    const reportOnlyToken = makeToken({
      userId: "auditor_user_" + Date.now(),
      role: "STAFF",
      branchId: branchA,
      permissions: ["TELLER.REPORT_VIEW"],
    });
    const reportSessionsRes = await apiRequest("GET", ["admin", "teller", "sessions"], null, reportOnlyToken, { branch_id: branchA });
    assert(reportSessionsRes.status === 200, "User with TELLER.REPORT_VIEW only can view session audit history (200)");

    const reportMovementsRes = await apiRequest("GET", ["admin", "teller", "sessions", sessionId, "movements"], null, reportOnlyToken);
    assert(reportMovementsRes.status === 200, "User with TELLER.REPORT_VIEW only can inspect session movements (200)");

    const reportOpenRes = await apiRequest("POST", ["admin", "teller", "sessions", "open"], { teller_id: "tlr_dummy", opening_float: 100 }, reportOnlyToken);
    assert(reportOpenRes.status === 403 && reportOpenRes.json.error === "FORBIDDEN", "User with TELLER.REPORT_VIEW only cannot open sessions (403 FORBIDDEN)");

    // 27. Branch Manager: Authorized for own branch, blocked from foreign branch
    const branchMgrToken = makeToken({
      userId: "bm_user_" + Date.now(),
      role: "BRANCH_MANAGER",
      branchId: branchA,
      permissions: ["TELLER.VIEW", "TELLER.MANAGE"],
    });
    const bmListRes = await apiRequest("GET", ["admin", "tellers"], null, branchMgrToken, { branch_id: branchA });
    assert(bmListRes.status === 200, "Branch Manager can list tellers at own branch (200)");

    const bmForeignRes = await apiRequest(
      "POST",
      ["admin", "tellers"],
      { name: "Foreign Counter", code: "FC1", user_id: "u_fc", branch_id: branchB },
      branchMgrToken
    );
    assert(bmForeignRes.status === 403, "Branch Manager blocked from creating counter at foreign branch (403)");

  } finally {
    console.log('\n[Teardown]: Cleaning up all temporary test fixtures...');
    try {
      // Clean up in reverse foreign key order
      await client.query("SET session_replication_role = 'replica'");
      if (createdSessionIds.length > 0) {
        await client.query(`DELETE FROM teller_movement WHERE teller_session_id = ANY($1)`, [createdSessionIds]);
        await client.query(`
          DELETE FROM accounting_journal_line 
          WHERE journal_entry_id IN (
            SELECT id FROM accounting_journal_entry 
            WHERE voucher_id IN (
              SELECT settlement_voucher_id FROM teller_session WHERE id = ANY($1) AND settlement_voucher_id IS NOT NULL
            )
          )
        `, [createdSessionIds]);
        await client.query(`
          DELETE FROM accounting_journal_entry 
          WHERE voucher_id IN (
            SELECT settlement_voucher_id FROM teller_session WHERE id = ANY($1) AND settlement_voucher_id IS NOT NULL
          )
        `, [createdSessionIds]);
        await client.query(`
          DELETE FROM accounting_voucher 
          WHERE id IN (
            SELECT settlement_voucher_id FROM teller_session WHERE id = ANY($1) AND settlement_voucher_id IS NOT NULL
          )
        `, [createdSessionIds]);
        await client.query(`DELETE FROM teller_session WHERE id = ANY($1)`, [createdSessionIds]);
      }
      if (createdTellerIds.length > 0) {
        await client.query(`DELETE FROM teller WHERE id = ANY($1)`, [createdTellerIds]);
      }
      if (createdUserIds.length > 0) {
        await client.query(`DELETE FROM "user" WHERE id = ANY($1)`, [createdUserIds]);
      }
      await client.query("SET session_replication_role = 'origin'");
      console.log('Teardown complete.');
    } catch (cleanErr) {
      console.error('Teardown error:', cleanErr);
    } finally {
      await client.end();
      await closeDbPool();
    }
  }

  console.log('\n=============================================================================');
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=============================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runC42IntegrationTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
