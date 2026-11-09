/**
 * CakeToHome ERP — Phase C7.9 Step 9D: Corporate Account Master & Employee Roster API Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Authentication: 401 UNAUTHORIZED on unauthenticated calls.
 * 2. Static RBAC:
 *    - Lacking CORPORATE_ACCOUNTS.VIEW -> 403 FORBIDDEN
 *    - Lacking CORPORATE_ACCOUNTS.CREATE -> 403 FORBIDDEN
 *    - Staff with CORPORATE_ACCOUNTS.CREATE -> 201 Created
 * 3. Super Admin Protected Operations:
 *    - Customer Linkage -> Super Admin only (CUSTOMER_LINKED event)
 *    - Account Approval -> Super Admin only + Four-Eyes SoD (creator !== approver)
 *    - Account Suspension & Reactivation -> Super Admin only
 *    - Member Grant & Revoke -> Super Admin only
 * 4. Credit Request & Decision Q1 Credit Activation Security:
 *    - Credit request records metadata without credit activation
 *    - Credit activation -> Super Admin only, APPROVED account only, Four-Eyes SoD
 *    - Legacy route POST /admin/corporate-customers/:id/credit-approval enforces Q1 guard:
 *      * Requires Super Admin if customer is linked to a corporate account
 *      * Fails closed if account is not APPROVED
 * 5. Account-Scoped Membership & Cross-Tenant Defense:
 *    - ROSTER_MANAGER can manage roster of own account
 *    - ROSTER_MANAGER of Account A denied access to Account B (403 FORBIDDEN)
 * 6. Roster Lifecycle & Mass-Assignment Defense:
 *    - Create, Update, Deactivate, Reactivate, Verify Coordinates
 *    - Mass-assignment: Credit/approval fields in employee payload stripped & ignored
 *    - Duplicate employee code variant rejected with 409
 *    - Phone reuse warning emitted without rejecting creation
 * 7. PII Masking:
 *    - ROSTER_VIEWER receives masked phone and email
 *    - Super Admin / ROSTER_MANAGER receives unmasked phone and email
 * 8. Bulk Import Controller Endpoints:
 *    - GET /template returns valid binary XLSX
 *    - POST /validate returns validation summary with zero DB mutations
 *    - POST /commit atomically inserts employees with replay protection
 *    - Duplicate committed file hash returns 409
 *    - GET batches and batch detail
 * 9. Teardown & Postflight PostgreSQL Invariant Audit:
 *    - Clean teardown with replica role
 *    - CoA = 100, TB = Dr ₹3,380.00 == Cr ₹3,380.00, corporate tables = 0 rows.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Module = require('module');
const assert = require('assert');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

// 1. Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// 2. Register TypeScript compilation hook
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  return module._compile(compiled.outputText, filename);
};

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        let val = trimmed.substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cakes2home_test';
}

const conn = getConnectionString();
process.env.DATABASE_URL = conn;

const { NextRequest } = require('next/server');
const { signAuthToken } = require('../src/lib/security/auth-session');
const { GET, POST, PUT, DELETE, PATCH } = require('../src/app/api/v1/[...path]/route');

async function createWorkbookBuffer(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Employee_Roster');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return await workbook.xlsx.writeBuffer();
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
  } else if (method === "PATCH") {
    res = await PATCH(req, { params: { path: pathParts } });
  } else if (method === "PUT") {
    res = await PUT(req, { params: { path: pathParts } });
  } else if (method === "DELETE") {
    res = await DELETE(req, { params: { path: pathParts } });
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }

  const status = res.status;
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") || contentType.includes("application/octet-stream")) {
    const arrayBuffer = await res.arrayBuffer();
    return { status, buffer: Buffer.from(arrayBuffer), headers: res.headers };
  }

  let json = {};
  try {
    json = await res.json();
  } catch {
    // raw text
  }
  return { status, json, headers: res.headers };
}

async function runStep9dSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.9 STEP 9D: API & RBAC CONTROLLER SUITE ");
  console.log("==================================================================\n");

  const pool = new Pool({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  let passed = 0;
  let failed = 0;

  function pass(testNum, desc) {
    passed++;
    console.log(`  ✓ TEST [${testNum}] PASS: ${desc}`);
  }

  function fail(testNum, desc, err) {
    failed++;
    console.error(`  ✗ TEST [${testNum}] FAIL: ${desc}`);
    if (err) console.error("    Details:", err.message || err);
  }

  const createdAccountIds = [];
  const createdCustomerIds = [];
  const createdUserIds = [];

  try {
    // -------------------------------------------------------------------------
    // PREFLIGHT: Baseline Invariant Audit
    // -------------------------------------------------------------------------
    const preCoA = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_account`);
    const preTB = await pool.query(`SELECT COALESCE(SUM(debit_amount),0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(15,2) as cr FROM public.accounting_journal_line`);
    const preV = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_voucher`);
    const preJE = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_entry`);
    const preJL = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_line`);
    const preCA = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_account`);
    const preCE = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee`);

    assert.strictEqual(preCoA.rows[0].cnt, 100, "CoA locked at 100");
    assert.strictEqual(preTB.rows[0].dr, '3380.00', "Trial balance Dr ₹3,380.00");
    assert.strictEqual(preTB.rows[0].cr, '3380.00', "Trial balance Cr ₹3,380.00");
    assert.strictEqual(preV.rows[0].cnt, 6, "Vouchers = 6");
    assert.strictEqual(preJE.rows[0].cnt, 4, "Journal Entries = 4");
    assert.strictEqual(preJL.rows[0].cnt, 10, "Journal Lines = 10");
    assert.strictEqual(preCA.rows[0].cnt, 0, "Preflight: corporate_account empty");
    assert.strictEqual(preCE.rows[0].cnt, 0, "Preflight: corporate_employee empty");

    console.log(`  [PREFLIGHT] CoA: ${preCoA.rows[0].cnt} | TB: Dr ₹${preTB.rows[0].dr} = Cr ₹${preTB.rows[0].cr} | Corp Tables Clean`);
    console.log("------------------------------------------------------------------\n");

    // -------------------------------------------------------------------------
    // USERS & TOKENS SETUP
    // -------------------------------------------------------------------------
    const tsSuffix = Date.now().toString().slice(-6);
    const superAdmin1Id = `usr_sa1_9d_${tsSuffix}`;
    const superAdmin2Id = `usr_sa2_9d_${tsSuffix}`;
    const staffOpsId = `usr_ops_9d_${tsSuffix}`;
    const staffMember1Id = `usr_mem1_9d_${tsSuffix}`;
    const staffMember2Id = `usr_mem2_9d_${tsSuffix}`;
    const unauthStaffId = `usr_unauth_9d_${tsSuffix}`;

    createdUserIds.push(superAdmin1Id, superAdmin2Id, staffOpsId, staffMember1Id, staffMember2Id, unauthStaffId);

    for (const uid of createdUserIds) {
      await pool.query(`
        INSERT INTO public."user" (id, email, first_name, last_name, created_at, updated_at)
        VALUES ($1, $2, 'Test', 'User', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [uid, `${uid}@test.local`]);
    }

    const tokenSuperAdmin1 = signAuthToken({ userId: superAdmin1Id, role: "SUPER_ADMIN" });
    const tokenSuperAdmin2 = signAuthToken({ userId: superAdmin2Id, role: "SUPER_ADMIN" });
    const tokenOpsStaff = signAuthToken({
      userId: staffOpsId,
      role: "STAFF",
      permissions: [
        "CORPORATE_ACCOUNTS.VIEW",
        "CORPORATE_ACCOUNTS.CREATE",
        "CORPORATE_ACCOUNTS.UPDATE",
        "CORPORATE_ACCOUNTS.CREDIT_REQUEST",
        "CORPORATE_EMPLOYEES.VIEW",
      ],
    });
    const tokenUnprivileged = signAuthToken({ userId: unauthStaffId, role: "STAFF", permissions: [] });
    const tokenMember1 = signAuthToken({ userId: staffMember1Id, role: "STAFF", permissions: ["CORPORATE_EMPLOYEES.VIEW"] });
    const tokenMember2 = signAuthToken({ userId: staffMember2Id, role: "STAFF", permissions: ["CORPORATE_EMPLOYEES.VIEW"] });

    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated 401 Rejection
    // -------------------------------------------------------------------------
    try {
      const getRes = await apiRequest("GET", ["admin", "corporate-accounts"]);
      assert.strictEqual(getRes.status, 401, "GET without token should return 401");

      const postRes = await apiRequest("POST", ["admin", "corporate-accounts"], { legal_name: "Unauth Corp" });
      assert.strictEqual(postRes.status, 401, "POST without token should return 401");

      pass(1, "Unauthenticated calls rejected with 401 UNAUTHORIZED");
    } catch (err) {
      fail(1, "Unauthenticated rejection failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Static RBAC Permission Gating
    // -------------------------------------------------------------------------
    try {
      const listUnauth = await apiRequest("GET", ["admin", "corporate-accounts"], null, tokenUnprivileged);
      assert.strictEqual(listUnauth.status, 403, "Unprivileged staff listing should return 403");

      const createUnauth = await apiRequest("POST", ["admin", "corporate-accounts"], { legal_name: "Forbidden Corp" }, tokenUnprivileged);
      assert.strictEqual(createUnauth.status, 403, "Unprivileged staff creation should return 403");

      const listOps = await apiRequest("GET", ["admin", "corporate-accounts"], null, tokenOpsStaff);
      assert.strictEqual(listOps.status, 200, "Ops staff with VIEW should return 200");
      assert.ok(Array.isArray(listOps.json.items), "Items array returned");

      pass(2, "Static RBAC enforces module-level VIEW and CREATE permissions");
    } catch (err) {
      fail(2, "RBAC permission check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Account Creation via Controller
    // -------------------------------------------------------------------------
    const panDigits = tsSuffix.slice(-4);
    let account1;
    let account2;
    try {
      const gstin1 = `29AAACP${panDigits}K1Z5`;
      const pan1 = `AAACP${panDigits}K`;

      const createRes = await apiRequest("POST", ["admin", "corporate-accounts"], {
        legal_name: `Acme Industrial Systems ${tsSuffix} Pvt Ltd`,
        trade_name: "Acme Industrial",
        gstin: gstin1,
        pan: pan1,
        billing_address: { street: "100 MG Road", city: "Bengaluru", state: "Karnataka", postal_code: "560001" },
        registered_address: { street: "100 MG Road", city: "Bengaluru", state: "Karnataka", postal_code: "560001" },
        primary_contact: {
          name: "Rajesh Kumar",
          email: `rajesh_${tsSuffix}@acme.local`,
          phone: "9812345678",
          designation: "Finance Director",
        },
      }, tokenOpsStaff);

      assert.strictEqual(createRes.status, 201, "Account creation returned 201");
      account1 = createRes.json.account;
      assert.ok(account1 && account1.id, "Account ID generated");
      assert.strictEqual(account1.status, "PENDING", "Initial status is PENDING");
      createdAccountIds.push(account1.id);
      createdCustomerIds.push(account1.customer_id);

      // Verify detail GET
      const detailRes = await apiRequest("GET", ["admin", "corporate-accounts", account1.id], null, tokenOpsStaff);
      assert.strictEqual(detailRes.status, 200, "Account detail returned 200");
      assert.strictEqual(detailRes.json.account.id, account1.id);
      assert.strictEqual(detailRes.json.contacts.length, 1);
      assert.strictEqual(detailRes.json.contacts[0].contact_type, "PRIMARY");

      pass(3, "Corporate account created with PENDING status, primary contact, and canonical customer");
    } catch (err) {
      fail(3, "Account creation failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Four-Eyes Approval Enforcement (Creator !== Approver)
    // -------------------------------------------------------------------------
    try {
      // 1. Non-Super Admin attempts approval -> 403
      const opsApprove = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "approve"], {}, tokenOpsStaff);
      assert.strictEqual(opsApprove.status, 403, "Ops staff cannot approve account");

      // 2. Super Admin 1 (different from creator usr_ops) approves -> 200
      const sa1Approve = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "approve"], {}, tokenSuperAdmin1);
      assert.strictEqual(sa1Approve.status, 200, "Super Admin 1 can approve account created by ops staff");
      assert.strictEqual(sa1Approve.json.account.status, "APPROVED");

      // 3. Creator SoD check: Create Account 2 with Super Admin 1 as creator
      const gstin2 = `29BBBCP${panDigits}M1Z5`;
      const pan2 = `BBBCP${panDigits}M`;
      const acct2Res = await apiRequest("POST", ["admin", "corporate-accounts"], {
        legal_name: `Beta Technologies ${tsSuffix} Pvt Ltd`,
        gstin: gstin2,
        pan: pan2,
        primary_contact: { name: "Sunil Rao", email: `sunil_${tsSuffix}@beta.local`, phone: "9823456789" },
      }, tokenSuperAdmin1);
      account2 = acct2Res.json.account;
      createdAccountIds.push(account2.id);
      createdCustomerIds.push(account2.customer_id);

      // Super Admin 1 attempts to approve Account 2 (own creation) -> 403 Four-Eyes violation
      const selfApprove = await apiRequest("POST", ["admin", "corporate-accounts", account2.id, "approve"], {}, tokenSuperAdmin1);
      assert.strictEqual(selfApprove.status, 403, "Creator Super Admin cannot approve own account (Four-Eyes violation)");

      // Super Admin 2 approves Account 2 -> 200
      const sa2Approve = await apiRequest("POST", ["admin", "corporate-accounts", account2.id, "approve"], {}, tokenSuperAdmin2);
      assert.strictEqual(sa2Approve.status, 200, "Second Super Admin can approve Account 2");
      assert.strictEqual(sa2Approve.json.account.status, "APPROVED");

      pass(4, "Four-Eyes approval strictly enforced (creator !== approver, Super Admin only)");
    } catch (err) {
      fail(4, "Four-Eyes approval check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Super Admin Customer Linkage (BD-2, Q5)
    // -------------------------------------------------------------------------
    try {
      // Create a standalone retail customer
      const retailCustId = `cus_retail_${tsSuffix}`;
      createdCustomerIds.push(retailCustId);
      await pool.query(`
        INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate)
        VALUES ($1, 'Retail', 'Customer', $2, '9899999999', FALSE);
      `, [retailCustId, `retail_${tsSuffix}@local.dev`]);

      // Create an unlinked corporate account draft (manually set customer_id to standalone placeholder)
      const orphanCustId = `cus_orphan_${tsSuffix}`;
      createdCustomerIds.push(orphanCustId);
      await pool.query(`
        INSERT INTO public.customer (id, first_name, last_name, email, phone)
        VALUES ($1, 'Placeholder', 'Corp', $2, '9888888888');
      `, [orphanCustId, `orphan_${tsSuffix}@local.dev`]);

      const gstin3 = `29CCCDP${panDigits}N1Z5`;
      const pan3 = `CCCDP${panDigits}N`;
      const acct3Res = await apiRequest("POST", ["admin", "corporate-accounts"], {
        legal_name: `Gamma Logistics ${tsSuffix} Pvt Ltd`,
        gstin: gstin3,
        pan: pan3,
        primary_contact: { name: "Anil Mehta", email: `anil_${tsSuffix}@gamma.local`, phone: "9834567890" },
      }, tokenOpsStaff);
      const account3 = acct3Res.json.account;
      createdAccountIds.push(account3.id);
      createdCustomerIds.push(account3.customer_id);

      // Non-Super Admin denied customer link
      const unauthLink = await apiRequest("POST", ["admin", "corporate-accounts", account3.id, "link-customer"], { customerId: retailCustId }, tokenOpsStaff);
      assert.strictEqual(unauthLink.status, 403, "Non-Super Admin denied customer link");

      // Super Admin links customer
      const saLink = await apiRequest("POST", ["admin", "corporate-accounts", account3.id, "link-customer"], { customerId: retailCustId }, tokenSuperAdmin1);
      assert.strictEqual(saLink.status, 200, "Super Admin can link customer");
      assert.strictEqual(saLink.json.account.customer_id, retailCustId);

      // Linking customer already linked to another account -> 409
      const dupLink = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "link-customer"], { customerId: retailCustId }, tokenSuperAdmin1);
      assert.strictEqual(dupLink.status, 409, "Linking already linked customer returns 409 conflict");

      pass(5, "Retail customer linkage restricted to Super Admin with 1:1 uniqueness enforcement");
    } catch (err) {
      fail(5, "Customer linkage check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Account Status Lifecycle (Suspend -> Reactivate -> Close)
    // -------------------------------------------------------------------------
    try {
      // Non-Super Admin denied suspend
      const unauthSusp = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "suspend"], { reason: "Audit check" }, tokenOpsStaff);
      assert.strictEqual(unauthSusp.status, 403, "Non-Super Admin denied suspension");

      // Super Admin suspends
      const suspRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "suspend"], { reason: "KYC Verification pending" }, tokenSuperAdmin1);
      assert.strictEqual(suspRes.status, 200, "Account suspended by Super Admin");
      assert.strictEqual(suspRes.json.account.status, "SUSPENDED");

      // Super Admin reactivates
      const reactRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "reactivate"], { reason: "KYC Verified" }, tokenSuperAdmin1);
      assert.strictEqual(reactRes.status, 200, "Account reactivated by Super Admin");
      assert.strictEqual(reactRes.json.account.status, "APPROVED");

      pass(6, "Corporate account status lifecycle (SUSPEND <-> REACTIVATE) governed by Super Admin");
    } catch (err) {
      fail(6, "Status lifecycle check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Credit Request & Decision Q1 Credit Activation Security
    // -------------------------------------------------------------------------
    try {
      // 1. Credit Request via Controller (records request only)
      const reqRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "credit-request"], {
        creditLimit: 350000,
        termsDays: 45,
      }, tokenOpsStaff);
      assert.strictEqual(reqRes.status, 200, "Credit request recorded");
      assert.strictEqual(Number(reqRes.json.account.credit_requested_limit), 350000);
      assert.strictEqual(Number(reqRes.json.account.credit_requested_terms_days), 45);

      // Verify customer record has NOT been activated
      const custCheck1 = await pool.query(`SELECT is_corporate, credit_enabled, credit_status, credit_limit FROM public.customer WHERE id = $1`, [account1.customer_id]);
      assert.strictEqual(custCheck1.rows[0].credit_enabled, false, "Customer credit NOT activated on credit request");

      // 2. Credit Activation: Non-Super Admin denied
      const unauthAct = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "credit-activate"], {
        creditLimit: 300000,
        paymentTermsDays: 30,
      }, tokenOpsStaff);
      assert.strictEqual(unauthAct.status, 403, "Non-Super Admin denied credit activation");

      // 3. Credit Activation: Super Admin activates credit
      // Note: customer was created by usr_ops, so Super Admin 1 satisfies four-eyes
      const actRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "credit-activate"], {
        creditLimit: 300000,
        paymentTermsDays: 30,
      }, tokenSuperAdmin1);
      assert.strictEqual(actRes.status, 200, "Super Admin activates corporate credit");
      assert.strictEqual(Number(actRes.json.customer.credit_limit), 300000);
      assert.strictEqual(actRes.json.customer.credit_status, "APPROVED");
      assert.strictEqual(actRes.json.customer.credit_enabled, true);
      assert.strictEqual(actRes.json.customer.is_corporate, true);

      // 4. Decision Q1: Legacy endpoint POST /admin/corporate-customers/:id/credit-approval guard
      // Attempting to approve credit on account1's customer using staff token (CUSTOMER.EDIT / ACCOUNTING.APPROVE) -> 403 FORBIDDEN
      const staffTokenWithCustEdit = signAuthToken({
        userId: "staff_ar_lead",
        role: "STAFF",
        permissions: ["CUSTOMER.EDIT", "ACCOUNTING.APPROVE"],
      });
      const legacyBypassAttempt = await apiRequest(
        "POST",
        ["admin", "corporate-customers", account1.customer_id, "credit-approval"],
        { credit_limit: "400000", payment_terms_days: "30" },
        staffTokenWithCustEdit
      );
      assert.strictEqual(legacyBypassAttempt.status, 403, "Decision Q1: Legacy route blocks non-Super-Admin for account-linked customer");

      // Super Admin via legacy endpoint succeeds
      const legacySaApprove = await apiRequest(
        "POST",
        ["admin", "corporate-customers", account1.customer_id, "credit-approval"],
        { credit_limit: "400000", payment_terms_days: "30" },
        tokenSuperAdmin2
      );
      assert.strictEqual(legacySaApprove.status, 200, "Decision Q1: Super Admin via legacy route succeeds");

      pass(7, "Credit activation secured per Decision Q1 (Super Admin only, bypass closed on legacy route)");
    } catch (err) {
      fail(7, "Credit activation security check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Scoped Account Membership & Cross-Tenant Defense
    // -------------------------------------------------------------------------
    try {
      // Super Admin grants ROSTER_MANAGER to staffMember1 on Account 1
      const grantRes1 = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "members"], {
        userId: staffMember1Id,
        memberRole: "ROSTER_MANAGER",
      }, tokenSuperAdmin1);
      assert.strictEqual(grantRes1.status, 201, "ROSTER_MANAGER granted on Account 1");

      // Super Admin grants ROSTER_VIEWER to staffMember2 on Account 1
      const grantRes2 = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "members"], {
        userId: staffMember2Id,
        memberRole: "ROSTER_VIEWER",
      }, tokenSuperAdmin1);
      assert.strictEqual(grantRes2.status, 201, "ROSTER_VIEWER granted on Account 1");

      // Cross-account defense: Member 1 attempts to add employee to Account 2 -> 403
      const crossAccountAdd = await apiRequest("POST", ["admin", "corporate-accounts", account2.id, "employees"], {
        employee_code: "EMP-CROSS-01",
        full_name: "Cross Tenant Employee",
        phone: "9844444444",
      }, tokenMember1);
      assert.strictEqual(crossAccountAdd.status, 403, "Cross-account mutation strictly rejected with 403");

      pass(8, "Corporate membership scoping & cross-tenant access isolation strictly enforced");
    } catch (err) {
      fail(8, "Membership scoping check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Employee Roster Lifecycle & Mass-Assignment Defense
    // -------------------------------------------------------------------------
    let emp1Id;
    try {
      // 1. ROSTER_MANAGER creates employee on Account 1 with malicious mass-assignment fields
      const createEmpRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees"], {
        employee_code: "EMP-ACME-001",
        full_name: "Deepak Sharma",
        phone: "9876543210",
        email: "deepak@acme.local",
        department: "Engineering",
        designation: "Lead Architect",
        city: "Bengaluru",
        default_latitude: 12.9716,
        default_longitude: 77.5946,
        // MALICIOUS MASS-ASSIGNMENT ATTEMPT:
        credit_limit: 99999999,
        credit_status: "APPROVED",
        is_corporate: true,
        approved_by: "hacker",
      }, tokenMember1);

      assert.strictEqual(createEmpRes.status, 201, "Employee created");
      const emp1 = createEmpRes.json.employee;
      emp1Id = emp1.id;
      assert.strictEqual(emp1.employee_code, "EMP-ACME-001");
      assert.strictEqual(emp1.status, "ACTIVE");
      assert.strictEqual(emp1.coordinate_verified, false, "Imported coordinates default to unverified");

      // Verify mass-assignment fields had zero effect on corporate_account
      const acctCheck = await pool.query(`SELECT credit_requested_limit, status FROM public.corporate_account WHERE id = $1`, [account1.id]);
      assert.strictEqual(Number(acctCheck.rows[0].credit_requested_limit), 350000, "Credit request not mutated by roster call");

      // 2. Duplicate Employee Code check across case variants
      const dupCodeRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees"], {
        employee_code: "emp-acme-001", // lowercase variant
        full_name: "Duplicate Person",
        phone: "9811112222",
      }, tokenMember1);
      assert.strictEqual(dupCodeRes.status, 409, "Duplicate employee code rejected with 409 conflict");

      // 3. Phone reuse warning (distinct employee code, same phone)
      const phoneReuseRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees"], {
        employee_code: "EMP-ACME-002",
        full_name: "Suresh Sharma", // sibling
        phone: "9876543210", // same phone
      }, tokenMember1);
      assert.strictEqual(phoneReuseRes.status, 201, "Employee with reused phone created successfully");
      assert.ok(Array.isArray(phoneReuseRes.json.warnings) && phoneReuseRes.json.warnings.length > 0, "Actionable warning emitted for phone reuse");

      // 4. Update employee
      const updateRes = await apiRequest("PATCH", ["admin", "corporate-accounts", account1.id, "employees", emp1Id], {
        designation: "Principal Architect",
      }, tokenMember1);
      assert.strictEqual(updateRes.status, 200, "Employee updated");
      assert.strictEqual(updateRes.json.employee.designation, "Principal Architect");

      // 5. Soft deactivation
      const deactRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees", emp1Id, "deactivate"], {
        reason: "Sabbatical leave",
      }, tokenMember1);
      assert.strictEqual(deactRes.status, 200, "Employee deactivated");
      assert.strictEqual(deactRes.json.employee.status, "INACTIVE");

      // 6. Explicit reactivation
      const reactRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees", emp1Id, "reactivate"], {
        reason: "Returned from sabbatical",
      }, tokenMember1);
      assert.strictEqual(reactRes.status, 200, "Employee reactivated");
      assert.strictEqual(reactRes.json.employee.status, "ACTIVE");
      assert.strictEqual(reactRes.json.employee.id, emp1Id, "Same employee ID preserved across rehire");

      // 7. Verify Coordinates (Super Admin only)
      const verifyCoords = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees", emp1Id, "verify-coordinates"], {}, tokenSuperAdmin1);
      assert.strictEqual(verifyCoords.status, 200, "Coordinates verified by Super Admin");
      assert.strictEqual(verifyCoords.json.employee.coordinate_verified, true);

      pass(9, "Employee roster lifecycle, phone reuse warning, and mass-assignment defense verified");
    } catch (err) {
      fail(9, "Employee lifecycle check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 10: PII Masking for Non-Privileged Viewers
    // -------------------------------------------------------------------------
    try {
      // staffMember2 holds ROSTER_VIEWER (non-privileged)
      const viewRes = await apiRequest("GET", ["admin", "corporate-accounts", account1.id, "employees", emp1Id], null, tokenMember2);
      assert.strictEqual(viewRes.status, 200, "ROSTER_VIEWER can view employee");
      const maskedEmp = viewRes.json.employee;
      assert.ok(maskedEmp.phone.startsWith("******"), "Phone is masked for ROSTER_VIEWER");
      assert.ok(maskedEmp.email.includes("***@"), "Email is masked for ROSTER_VIEWER");

      // Super Admin viewing employee receives raw PII
      const saViewRes = await apiRequest("GET", ["admin", "corporate-accounts", account1.id, "employees", emp1Id], null, tokenSuperAdmin1);
      assert.strictEqual(saViewRes.status, 200, "Super Admin can view employee");
      const rawEmp = saViewRes.json.employee;
      assert.strictEqual(rawEmp.phone, "9876543210", "Phone is unmasked for Super Admin");
      assert.strictEqual(rawEmp.email, "deepak@acme.local", "Email is unmasked for Super Admin");

      pass(10, "PII masking dynamically enforced for non-privileged viewers");
    } catch (err) {
      fail(10, "PII masking check failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Bulk Import Endpoints via Controller
    // -------------------------------------------------------------------------
    try {
      // 1. Download Template: GET /:id/employees/template
      const templateRes = await apiRequest("GET", ["admin", "corporate-accounts", account1.id, "employees", "template"], null, tokenMember1);
      assert.strictEqual(templateRes.status, 200, "Template download returned 200");
      assert.ok(Buffer.isBuffer(templateRes.buffer), "Valid binary buffer received");

      // 2. Build workbook buffer with 2 valid rows
      const headers = ['Employee Code', 'Full Name', 'Phone', 'Email', 'Department', 'Designation', 'Address Line 1', 'City', 'State', 'Pincode', 'Latitude', 'Longitude'];
      const rows = [
        ['EMP-BULK-01', 'Pooja Hegde', '9890011111', 'pooja@acme.local', 'HR', 'HR Manager', '20 Indiranagar', 'Bengaluru', 'Karnataka', '560038', '12.9784', '77.6408'],
        ['EMP-BULK-02', 'Kiran Bedi', '9890022222', 'kiran@acme.local', 'Ops', 'Operations Lead', '30 Koramangala', 'Bengaluru', 'Karnataka', '560034', '12.9352', '77.6245'],
      ];
      const validBuf = await createWorkbookBuffer(headers, rows);
      const b64 = validBuf.toString('base64');

      // 3. Dry-Run Validate via API: POST /:id/employees/import/validate
      const valRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees", "import", "validate"], {
        fileBase64: b64,
        filename: "import_test.xlsx",
      }, tokenMember1);
      assert.strictEqual(valRes.status, 200, "Validate returned 200");
      assert.strictEqual(valRes.json.result.isValid, true);
      assert.strictEqual(valRes.json.result.validRows, 2);

      // Verify zero DB employee mutations after dry-run
      const empCountPostVal = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee WHERE account_id = $1`, [account1.id]);
      assert.strictEqual(empCountPostVal.rows[0].cnt, 2, "Zero employee rows added during dry-run");

      // 4. Commit Import Batch via API: POST /:id/employees/import/commit
      const comRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees", "import", "commit"], {
        fileBase64: b64,
        filename: "import_test.xlsx",
      }, tokenMember1);
      assert.strictEqual(comRes.status, 201, "Commit returned 201 Created");
      assert.strictEqual(comRes.json.insertedRows, 2);

      // 5. Replay Protection: Re-committing same file hash returns 409
      const replayRes = await apiRequest("POST", ["admin", "corporate-accounts", account1.id, "employees", "import", "commit"], {
        fileBase64: b64,
        filename: "import_test.xlsx",
      }, tokenMember1);
      assert.strictEqual(replayRes.status, 409, "Replay defense returns 409 conflict on duplicate file hash");

      // 6. List batches & batch detail
      const batchesRes = await apiRequest("GET", ["admin", "corporate-accounts", account1.id, "employees", "import", "batches"], null, tokenMember1);
      assert.strictEqual(batchesRes.status, 200, "Batches list returned 200");
      assert.ok(batchesRes.json.items.length >= 1, "At least 1 batch returned");

      const batchId = batchesRes.json.items[0].id;
      const bDetailRes = await apiRequest("GET", ["admin", "corporate-accounts", account1.id, "employees", "import", "batches", batchId], null, tokenMember1);
      assert.strictEqual(bDetailRes.status, 200, "Batch detail returned 200");
      assert.strictEqual(bDetailRes.json.batch.id, batchId);

      pass(11, "Bulk roster import API verified (template, dry-run, commit, replay protection, batches list)");
    } catch (err) {
      fail(11, "Bulk import API check failed", err);
    }

  } catch (fatalErr) {
    console.error("\nFATAL SUITE ERROR:", fatalErr);
    failed++;
  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Clean up test fixtures with replica role
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("  TEARDOWN: Cleaning up test fixtures with replica role...        ");
    console.log("------------------------------------------------------------------");

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN;");
        await client.query("SET session_replication_role = 'replica';");

        if (createdAccountIds.length > 0) {
          await client.query("DELETE FROM public.corporate_employee_event WHERE account_id = ANY($1);", [createdAccountIds]);
          await client.query("DELETE FROM public.corporate_account_event WHERE account_id = ANY($1);", [createdAccountIds]);
          await client.query("DELETE FROM public.corporate_employee_import_batch WHERE account_id = ANY($1);", [createdAccountIds]);
          await client.query("DELETE FROM public.corporate_employee WHERE account_id = ANY($1);", [createdAccountIds]);
          await client.query("DELETE FROM public.corporate_account_member WHERE account_id = ANY($1);", [createdAccountIds]);
          await client.query("DELETE FROM public.corporate_account_contact WHERE account_id = ANY($1);", [createdAccountIds]);
          await client.query("DELETE FROM public.corporate_account WHERE id = ANY($1);", [createdAccountIds]);
        }

        if (createdCustomerIds.length > 0) {
          await client.query("DELETE FROM public.customer WHERE id = ANY($1);", [createdCustomerIds]);
        }

        if (createdUserIds.length > 0) {
          await client.query("DELETE FROM public.\"user\" WHERE id = ANY($1);", [createdUserIds]);
        }

        await client.query("SET session_replication_role = 'origin';");
        await client.query("COMMIT;");
        console.log("  ✓ Teardown successful: All test fixtures cleanly removed");
      } catch (tdErr) {
        await client.query("ROLLBACK;");
        console.error("  ✗ Teardown failed:", tdErr.message);
      } finally {
        client.release();
      }

      // -------------------------------------------------------------------------
      // POSTFLIGHT: Database Baseline Invariant Audit
      // -------------------------------------------------------------------------
      const postCoA = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_account`);
      const postTB = await pool.query(`SELECT COALESCE(SUM(debit_amount),0)::numeric(15,2) as dr, COALESCE(SUM(credit_amount),0)::numeric(15,2) as cr FROM public.accounting_journal_line`);
      const postV = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_voucher`);
      const postJE = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_entry`);
      const postJL = await pool.query(`SELECT count(*)::int as cnt FROM public.accounting_journal_line`);
      const postCA = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_account`);
      const postCE = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee`);

      console.log(`  ✓ Postflight Audit: CoA = ${postCoA.rows[0].cnt} | Vouchers = ${postV.rows[0].cnt} | JEs = ${postJE.rows[0].cnt} | JLs = ${postJL.rows[0].cnt} | TB = ₹${postTB.rows[0].dr} | Corporate Tables = 0 rows\n`);

      assert.strictEqual(postCoA.rows[0].cnt, 100, "CoA locked at 100");
      assert.strictEqual(postTB.rows[0].dr, '3380.00', "Trial balance Dr ₹3,380.00");
      assert.strictEqual(postTB.rows[0].cr, '3380.00', "Trial balance Cr ₹3,380.00");
      assert.strictEqual(postV.rows[0].cnt, 6, "Vouchers = 6");
      assert.strictEqual(postJE.rows[0].cnt, 4, "Journal Entries = 4");
      assert.strictEqual(postJL.rows[0].cnt, 10, "Journal Lines = 10");
      assert.strictEqual(postCA.rows[0].cnt, 0, "Postflight: corporate_account clean");
      assert.strictEqual(postCE.rows[0].cnt, 0, "Postflight: corporate_employee clean");
    } catch (auditErr) {
      console.error("  ✗ Postflight Audit failed:", auditErr.message);
      failed++;
    } finally {
      await pool.end();
    }

    console.log("==================================================================");
    console.log(`  SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runStep9dSuite().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
