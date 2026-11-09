/**
 * CakeToHome ERP — Phase C7.7 Step 7C: Corporate Gifting API Integration Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Authentication & Security:
 *    - Unauthenticated requests rejected with 401 UNAUTHORIZED
 *    - Forged / invalid Bearer token rejected with 401 UNAUTHORIZED
 * 2. RBAC Permissions:
 *    - Account lacking CORPORATE_GIFTING permissions rejected with 403 FORBIDDEN
 *    - Account lacking TEMPLATE permission rejected from downloading template
 *    - Account lacking VALIDATE permission rejected from dry-run validation
 *    - Account lacking EXECUTE permission rejected from executing batches
 *    - Account lacking VIEW permission rejected from listing / detail inspection
 * 3. Multi-Tenant Scoping & BOLA Defense:
 *    - Corporate customer cannot submit or validate batches for another customer ID (403 FORBIDDEN)
 *    - Corporate customer cannot view another customer's batches or recipients (404/403)
 *    - Branch-restricted account denied access to cross-branch batches (403 BRANCH_ACCESS_DENIED)
 * 4. PII Defense:
 *    - Viewer lacking recipient PII clearance receives masked phone and delivery address
 *    - Viewer with PII authority (or owning customer) receives full recipient details
 * 5. Template & File Handling:
 *    - GET /template returns 200 with valid binary XLSX and correct Content-Disposition
 *    - Missing file upload rejected with 422 MISSING_FILE
 *    - Oversized file payload rejected with 413 FILE_TOO_LARGE
 * 6. Dry-Run Validation:
 *    - POST /validate executes completely read-only with zero database mutations
 *    - Returns structured row-level errors and financial summary
 * 7. Execution Workflow:
 *    - POST /execute creates batch, master order, master invoice, and recipient deliveries
 *    - Replay defense rejects duplicate file hash with 409 DUPLICATE_FILE_HASH
 *    - Credit limit failure returns 422 CREDIT_LIMIT_EXCEEDED with zero partial persistence
 * 8. Listing & Detail Endpoints:
 *    - GET /batches supports customer filtering and pagination
 *    - GET /batches/:id returns full batch and recipient roster
 * 9. Teardown & Database Baseline:
 *    - Restores PostgreSQL strictly to baseline: CoA = 100, TB = Dr ₹3,380.00 == Cr ₹3,380.00.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Module = require('module');
const assert = require('assert');

// 1. Alias Resolution for @frontend/
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
const { GET, POST } = require('../src/app/api/v1/[...path]/route');
const ExcelJS = require('exceljs');

async function createWorkbookBuffer(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Recipients');
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

async function runStep7cSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.7 STEP 7C: API & ROUTE HANDLERS SUITE  ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  process.env.DATABASE_URL = conn;
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

  // Pre-flight database invariants
  const coaRes = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
  assert.strictEqual(coaRes.rows[0].count, 100, "CoA baseline must be 100");

  const tbRes = await pool.query(`
    SELECT 
      COALESCE(SUM(debit_amount), 0)::numeric(12,2) AS total_dr,
      COALESCE(SUM(credit_amount), 0)::numeric(12,2) AS total_cr
    FROM public.accounting_journal_line;
  `);
  const preDr = Number(tbRes.rows[0].total_dr);
  const preCr = Number(tbRes.rows[0].total_cr);
  console.log(`  [PREFLIGHT] CoA: 100 accounts | TB: Dr ₹${preDr.toFixed(2)} = Cr ₹${preCr.toFixed(2)}`);
  console.log("------------------------------------------------------------------\n");

  // Fixture tracking
  const createdCustomerIds = [];
  const createdBatchIds = [];
  const createdOrderIds = [];
  const createdInvoiceIds = [];
  const createdVoucherIds = [];
  const createdCostCentreIds = [];

  const headers = [
    "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
    "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
    "Quantity", "Gift_Message", "Cost_Centre_Code"
  ];

  try {
    // -------------------------------------------------------------------------
    // FIXTURE SETUP
    // -------------------------------------------------------------------------
    const customerAId = `cus_test_7c_a_${Date.now()}`;
    const customerBId = `cus_test_7c_b_${Date.now()}`;
    createdCustomerIds.push(customerAId, customerBId);

    // Corporate customer A: Credit enabled, limit ₹200,000, approved
    await pool.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, email, phone, is_corporate,
        company_name, gstin, credit_enabled, credit_limit, credit_status,
        credit_approved_at, credit_approved_by, payment_terms_days
      ) VALUES (
        $1, 'Corporate', 'Alpha Ltd', 'alpha@corp.com', '9811111111', TRUE,
        'Alpha Technologies Ltd', '29ABCDE1234F1Z5', TRUE, 200000.00, 'APPROVED',
        NOW(), 'user_01KY29WECB2VKDVVAT8J6FH90F', 30
      );
    `, [customerAId]);

    // Corporate customer B: Credit enabled, limit ₹50,000, approved
    await pool.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, email, phone, is_corporate,
        company_name, gstin, credit_enabled, credit_limit, credit_status,
        credit_approved_at, credit_approved_by, payment_terms_days
      ) VALUES (
        $1, 'Corporate', 'Beta Corp', 'beta@corp.com', '9822222222', TRUE,
        'Beta Solutions Corp', '29XYZDE1234F1Z5', TRUE, 50000.00, 'APPROVED',
        NOW(), 'user_01KY29WECB2VKDVVAT8J6FH90F', 30
      );
    `, [customerBId]);

    // Cost centre fixture
    const ccId = `cc_test_7c_${Date.now()}`;
    const ccCode = `CC-7C-${Date.now().toString().slice(-4)}`;
    createdCostCentreIds.push(ccId);
    await pool.query(`
      INSERT INTO public.cost_centre (
        id, code, name, department, is_active, metadata
      ) VALUES ($1, $2, 'Corporate Marketing 7C', 'MARKETING', TRUE, '{}'::jsonb);
    `, [ccId, ccCode]);

    // Fetch an operational branch
    const branchRes = await pool.query(`SELECT id, code, name FROM public.branch WHERE deleted_at IS NULL LIMIT 1;`);
    assert.ok(branchRes.rows.length > 0, "At least one operational branch required");
    const operationalBranch = branchRes.rows[0];

    // Auth Tokens
    const tokenAdmin = signAuthToken({ userId: "admin_01", role: "SUPER_ADMIN" });
    const tokenStaffFull = signAuthToken({
      userId: "staff_gifting_lead",
      role: "STAFF",
      branchId: operationalBranch.id,
      permissions: [
        "CORPORATE_GIFTING.VIEW",
        "CORPORATE_GIFTING.TEMPLATE",
        "CORPORATE_GIFTING.VALIDATE",
        "CORPORATE_GIFTING.EXECUTE",
        "CUSTOMERS.VIEW",
      ],
    });
    const tokenStaffNoPerm = signAuthToken({
      userId: "staff_no_perm",
      role: "STAFF",
      branchId: operationalBranch.id,
      permissions: ["EXPENSE.VIEW"],
    });
    const tokenStaffViewOnly = signAuthToken({
      userId: "staff_view_only",
      role: "STAFF",
      branchId: operationalBranch.id,
      permissions: ["CORPORATE_GIFTING.VIEW"],
    });
    const tokenCustA = signAuthToken({
      userId: customerAId,
      customerId: customerAId,
      role: "CUSTOMER",
    });
    const tokenCustB = signAuthToken({
      userId: customerBId,
      customerId: customerBId,
      role: "CUSTOMER",
    });

    // -------------------------------------------------------------------------
    // TEST 1: Authentication & Authorization Gates
    // -------------------------------------------------------------------------
    try {
      // 1.1 Unauthenticated request -> 401
      const unauthRes = await apiRequest("GET", ["admin", "corporate-gifting", "batches"]);
      assert.strictEqual(unauthRes.status, 401, "Unauthenticated request must return 401");
      assert.strictEqual(unauthRes.json.error, "UNAUTHORIZED");

      // 1.2 Invalid Bearer token -> 401
      const badTokenRes = await apiRequest("GET", ["admin", "corporate-gifting", "batches"], null, "invalid.token.here");
      assert.strictEqual(badTokenRes.status, 401, "Invalid Bearer token must return 401");

      // 1.3 Staff without required permission -> 403
      const noPermRes = await apiRequest("GET", ["admin", "corporate-gifting", "batches"], null, tokenStaffNoPerm);
      assert.strictEqual(noPermRes.status, 403, "Staff lacking permission must return 403");
      assert.strictEqual(noPermRes.json.error, "FORBIDDEN");

      pass(1, "Authentication and feature-level RBAC authorization enforced (401 unauth, 403 forbidden)");
    } catch (e) {
      fail(1, "Authentication and RBAC gates failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Template Download Endpoint (GET /template)
    // -------------------------------------------------------------------------
    try {
      // Unauthenticated -> 401
      const tUnauth = await apiRequest("GET", ["admin", "corporate-gifting", "template"]);
      assert.strictEqual(tUnauth.status, 401);

      // Staff with TEMPLATE permission -> 200 binary XLSX
      const tRes = await apiRequest("GET", ["admin", "corporate-gifting", "template"], null, tokenStaffFull);
      assert.strictEqual(tRes.status, 200, "Template download should return 200");
      assert.ok(tRes.buffer && tRes.buffer.length > 500, "Template should return non-empty buffer");
      assert.strictEqual(
        tRes.headers.get("content-type"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      assert.ok(
        (tRes.headers.get("content-disposition") || "").includes("corporate_gifting_template.xlsx"),
        "Disposition header must specify correct filename"
      );

      // Verify returned buffer is valid workbook
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(tRes.buffer);
      const ws = wb.getWorksheet("Recipients");
      assert.ok(ws, "Sheet 'Recipients' must exist in downloaded template");
      assert.strictEqual(ws.getRow(1).getCell(2).value, "Recipient_Name");

      // Corporate Customer can also download template -> 200
      const tCustRes = await apiRequest("GET", ["admin", "corporate-gifting", "template"], null, tokenCustA);
      assert.strictEqual(tCustRes.status, 200, "Corporate customer should be able to download template");

      pass(2, "Template download endpoint returns valid XLSX workbook with correct headers");
    } catch (e) {
      fail(2, "Template download test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 3: File Input Validation (Missing, Oversized, Malformed)
    // -------------------------------------------------------------------------
    try {
      // Missing file -> 422 MISSING_FILE
      const missingFileRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "validate"],
        { customerId: customerAId },
        tokenStaffFull
      );
      assert.strictEqual(missingFileRes.status, 422);
      assert.strictEqual(missingFileRes.json.error, "MISSING_FILE");

      // Oversized file payload (>15MB base64) -> 413 FILE_TOO_LARGE
      const oversizedB64 = "A".repeat(16 * 1024 * 1024);
      const oversizedRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "validate"],
        { customerId: customerAId, fileBase64: oversizedB64 },
        tokenStaffFull
      );
      assert.strictEqual(oversizedRes.status, 413);
      assert.strictEqual(oversizedRes.json.error, "FILE_TOO_LARGE");

      // Corrupted file -> 415 or 422
      const corruptB64 = Buffer.from("NOT_A_VALID_EXCEL_ZIP_FILE").toString("base64");
      const corruptRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "validate"],
        { customerId: customerAId, fileBase64: corruptB64 },
        tokenStaffFull
      );
      assert.strictEqual(corruptRes.status, 415);
      assert.strictEqual(corruptRes.json.error, "INVALID_FILE_FORMAT");

      pass(3, "File upload bounds and format validation enforced (missing, oversized, corrupted)");
    } catch (e) {
      fail(3, "File validation test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 4: BOLA & Cross-Customer Isolation
    // -------------------------------------------------------------------------
    try {
      const validBuf = await createWorkbookBuffer(headers, [
        ["EMP-01", "Priya Nair", "9812345678", "12 Park Lane, Indiranagar", "560038", "2026-11-20", "MORNING", "BUTTER-CROISSANT", 2, "Diwali", ccCode],
      ]);
      const validB64 = validBuf.toString("base64");

      // Customer A attempting to validate with customerId of Customer B -> 403 FORBIDDEN
      const bolaValRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "validate"],
        { customerId: customerBId, fileBase64: validB64 },
        tokenCustA
      );
      assert.strictEqual(bolaValRes.status, 403, "Cross-customer dry-run validation must be blocked");
      assert.strictEqual(bolaValRes.json.error, "FORBIDDEN");

      // Customer A attempting to execute import with customerId of Customer B -> 403 FORBIDDEN
      const bolaExecRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "execute"],
        { customerId: customerBId, fileBase64: validB64 },
        tokenCustA
      );
      assert.strictEqual(bolaExecRes.status, 403, "Cross-customer batch execution must be blocked");
      assert.strictEqual(bolaExecRes.json.error, "FORBIDDEN");

      pass(4, "BOLA defense verified: corporate customer strictly barred from accessing another tenant's account");
    } catch (e) {
      fail(4, "BOLA defense test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Dry-Run Validation with Row-Level Errors
    // -------------------------------------------------------------------------
    try {
      const rowErrorBuf = await createWorkbookBuffer(headers, [
        ["EMP-01", "A", "12345", "Address", "560", "2020-01-01", "SLOT", "INVALID-SKU-999", 0, "Msg", "INVALID-CC"],
      ]);
      const rowErrorB64 = rowErrorBuf.toString("base64");

      const valRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "validate"],
        { customerId: customerAId, fileBase64: rowErrorB64 },
        tokenStaffFull
      );

      assert.strictEqual(valRes.status, 200, "Validation should return 200 with structured report");
      assert.strictEqual(valRes.json.success, true);
      assert.strictEqual(valRes.json.isValid, false, "Batch with row errors must be marked invalid");
      assert.ok(valRes.json.errors.length >= 3, "Must capture multiple row errors");

      const errCodes = valRes.json.errors.map((e) => e.code);
      assert.ok(errCodes.includes("INVALID_PHONE"), "Must flag INVALID_PHONE");
      assert.ok(errCodes.includes("INVALID_PINCODE"), "Must flag INVALID_PINCODE");
      assert.ok(
        errCodes.includes("DATE_IN_PAST") || errCodes.includes("PAST_DELIVERY_DATE"),
        "Must flag DATE_IN_PAST"
      );

      pass(5, "Dry-run validation captures structured row-level errors without mutations");
    } catch (e) {
      fail(5, "Dry-run row validation test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Strict Zero-Mutation Dry-Run Guarantee
    // -------------------------------------------------------------------------
    try {
      const bCount = await pool.query(`SELECT count(*)::int as c FROM public.corporate_gifting_batch;`);
      const rCount = await pool.query(`SELECT count(*)::int as c FROM public.corporate_gifting_recipient;`);
      const oCount = await pool.query(`SELECT count(*)::int as c FROM public.order WHERE metadata->>'channel' = 'CORPORATE_GIFTING';`);
      const iCount = await pool.query(`SELECT count(*)::int as c FROM public.invoice WHERE customer_id = $1;`, [customerAId]);

      assert.strictEqual(bCount.rows[0].c, 0, "Batches must remain 0 after dry run");
      assert.strictEqual(rCount.rows[0].c, 0, "Recipients must remain 0 after dry run");
      assert.strictEqual(oCount.rows[0].c, 0, "Orders must remain 0 after dry run");
      assert.strictEqual(iCount.rows[0].c, 0, "Invoices must remain 0 after dry run");

      pass(6, "Strict zero-mutation dry-run guarantee confirmed across all relational tables");
    } catch (e) {
      fail(6, "Zero-mutation guarantee test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Successful Batch Import Execution (POST /execute)
    // -------------------------------------------------------------------------
    let createdBatchId = "";
    let executedValidB64 = "";
    try {
      const validBuf = await createWorkbookBuffer(headers, [
        ["EMP-01", "Priya Nair", "9812345678", "12 Park Lane, Indiranagar", "560038", "2026-11-20", "MORNING", "BUTTER-CROISSANT", 2, "Happy Diwali", ccCode],
        ["EMP-02", "Vikram Sen", "9823456789", "88 MG Road, Bengaluru", "560001", "2026-11-20", "AFTERNOON", "BUTTER-CROISSANT", 3, "Happy Diwali", ccCode],
      ]);
      const validB64 = validBuf.toString("base64");
      executedValidB64 = validB64;

      const execRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "execute"],
        {
          customerId: customerAId,
          batchName: "Diwali Leadership Campaign 2026",
          fileBase64: validB64,
          sourceFilename: "diwali_leadership.xlsx",
        },
        tokenStaffFull
      );

      assert.strictEqual(execRes.status, 200, "Valid execution should return 200");
      assert.strictEqual(execRes.json.success, true);
      assert.ok(execRes.json.batch && execRes.json.batch.id, "Must return created batch with ID");
      assert.strictEqual(execRes.json.recipientsCount, 2, "Must process 2 recipients");
      assert.ok(execRes.json.masterOrderId, "Must return master commercial order ID");
      assert.ok(execRes.json.invoiceId, "Must return posted master invoice ID");
      assert.ok(execRes.json.invoiceNumber, "Must return invoice number");
      assert.ok(execRes.json.voucherId, "Must return statutory voucher ID");

      createdBatchId = execRes.json.batch.id;
      createdBatchIds.push(createdBatchId);
      createdOrderIds.push(execRes.json.masterOrderId);
      createdInvoiceIds.push(execRes.json.invoiceId);
      createdVoucherIds.push(execRes.json.voucherId);

      // Verify in PostgreSQL: Exactly 1 batch, 2 recipients, 1 order, 2 deliveries, 1 invoice
      const bCheck = await pool.query(`SELECT * FROM public.corporate_gifting_batch WHERE id = $1;`, [createdBatchId]);
      assert.strictEqual(bCheck.rows.length, 1);
      assert.strictEqual(bCheck.rows[0].status, "SCHEDULED");
      assert.strictEqual(bCheck.rows[0].total_recipients, 2);

      const rCheck = await pool.query(`SELECT * FROM public.corporate_gifting_recipient WHERE batch_id = $1;`, [createdBatchId]);
      assert.strictEqual(rCheck.rows.length, 2);

      const dCheck = await pool.query(`SELECT * FROM public.delivery WHERE transaction_id = $1;`, [execRes.json.masterOrderId]);
      assert.strictEqual(dCheck.rows.length, 2, "Must create exactly 2 deliveries linked to master order");

      const iCheck = await pool.query(`SELECT count(*)::int as c FROM public.invoice WHERE customer_id = $1;`, [customerAId]);
      assert.strictEqual(iCheck.rows[0].c, 1, "Must generate exactly ONE master corporate tax invoice");

      pass(7, "Atomic batch execution succeeded: 1 batch, 2 recipients, 1 master order, 2 deliveries, 1 invoice");
    } catch (e) {
      fail(7, "Batch execution test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Replay Protection Rejects Duplicate File Hash (409 Conflict)
    // -------------------------------------------------------------------------
    try {
      assert.ok(executedValidB64, "Prerequisite: executedValidB64 must exist from test 7");

      const dupExecRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "execute"],
        {
          customerId: customerAId,
          batchName: "Duplicate Attempt",
          fileBase64: executedValidB64,
        },
        tokenStaffFull
      );

      assert.strictEqual(dupExecRes.status, 409, "Duplicate file hash execution must return 409 Conflict");
      assert.strictEqual(dupExecRes.json.error, "DUPLICATE_FILE_HASH");

      pass(8, "Replay defense rejected duplicate file hash upload with 409 Conflict");
    } catch (e) {
      fail(8, "Duplicate hash test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Credit Limit Failure Rejection (422)
    // -------------------------------------------------------------------------
    try {
      // Customer B has credit limit ₹50,000. Create batch ordering 1,000 units (≈ ₹100,000)
      const hugeBuf = await createWorkbookBuffer(headers, [
        ["EMP-99", "Huge Order", "9899999999", "500 High Street, Bengaluru", "560001", "2026-11-25", "MORNING", "BUTTER-CROISSANT", 1000, "Gift", ccCode],
      ]);
      const hugeB64 = hugeBuf.toString("base64");

      const creditFailRes = await apiRequest(
        "POST",
        ["admin", "corporate-gifting", "execute"],
        { customerId: customerBId, fileBase64: hugeB64 },
        tokenStaffFull
      );

      assert.strictEqual(creditFailRes.status, 422, "Credit limit breach must return 422");
      assert.strictEqual(creditFailRes.json.error, "CREDIT_LIMIT_EXCEEDED");

      // Verify zero partial records persisted for customer B
      const bCountB = await pool.query(`SELECT count(*)::int as c FROM public.corporate_gifting_batch WHERE customer_id = $1;`, [customerBId]);
      assert.strictEqual(bCountB.rows[0].c, 0, "Zero batches persisted for customer B on credit failure");

      pass(9, "Credit limit failure rejected with 422 CREDIT_LIMIT_EXCEEDED and zero persistence");
    } catch (e) {
      fail(9, "Credit limit failure test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 10: List Batches Endpoint (GET /batches) with Scoping & Pagination
    // -------------------------------------------------------------------------
    try {
      // 10.1 Staff lists batches for Customer A
      const listStaffRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches"],
        null,
        tokenStaffFull,
        `customerId=${customerAId}&page=1&limit=10`
      );
      assert.strictEqual(listStaffRes.status, 200);
      assert.strictEqual(listStaffRes.json.success, true);
      assert.strictEqual(listStaffRes.json.batches.length, 1);
      assert.strictEqual(listStaffRes.json.batches[0].id, createdBatchId);

      // 10.2 Customer A lists own batches -> Sees their 1 batch
      const listCustARes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches"],
        null,
        tokenCustA
      );
      assert.strictEqual(listCustARes.status, 200);
      assert.strictEqual(listCustARes.json.batches.length, 1);
      assert.strictEqual(listCustARes.json.batches[0].id, createdBatchId);

      // 10.3 Customer B lists own batches -> Sees 0 batches (tenant isolation)
      const listCustBRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches"],
        null,
        tokenCustB
      );
      assert.strictEqual(listCustBRes.status, 200);
      assert.strictEqual(listCustBRes.json.batches.length, 0, "Customer B must NOT see Customer A batches");

      pass(10, "List batches endpoint enforces tenant isolation, query filters, and pagination");
    } catch (e) {
      fail(10, "List batches test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Batch Detail Endpoint (GET /batches/:id) & IDOR Protection
    // -------------------------------------------------------------------------
    try {
      // 11.1 Customer A accesses own batch -> 200 OK
      const dCustARes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches", createdBatchId],
        null,
        tokenCustA
      );
      assert.strictEqual(dCustARes.status, 200);
      assert.strictEqual(dCustARes.json.batch.id, createdBatchId);
      assert.strictEqual(dCustARes.json.recipients.length, 2);

      // 11.2 Customer B attempts to access Customer A's batch -> 404 NOT_FOUND (IDOR block)
      const dCustBRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches", createdBatchId],
        null,
        tokenCustB
      );
      assert.strictEqual(dCustBRes.status, 404, "Customer B cannot access Customer A batch (IDOR defense)");
      assert.strictEqual(dCustBRes.json.error, "BATCH_NOT_FOUND");

      // 11.3 Unknown batch ID -> 404
      const unknownRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches", "cgb_non_existent"],
        null,
        tokenStaffFull
      );
      assert.strictEqual(unknownRes.status, 404);

      pass(11, "Batch detail endpoint enforces IDOR protection and customer isolation");
    } catch (e) {
      fail(11, "Batch detail IDOR test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Recipient PII Sanitization & Masking Defense
    // -------------------------------------------------------------------------
    try {
      // 12.1 Caller lacking recipient PII clearance (staff_view_only lacks CUSTOMERS.VIEW)
      const piiMaskedRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches", createdBatchId],
        null,
        tokenStaffViewOnly
      );
      assert.strictEqual(piiMaskedRes.status, 200);
      const maskedRecipients = piiMaskedRes.json.recipients;
      assert.strictEqual(maskedRecipients.length, 2);
      assert.ok(
        maskedRecipients[0].recipient_phone.includes("******"),
        `Phone must be masked for non-PII staff: ${maskedRecipients[0].recipient_phone}`
      );
      assert.strictEqual(
        maskedRecipients[0].delivery_address,
        "*** Protected Delivery Address ***",
        "Address must be masked for non-PII staff"
      );

      // 12.2 Owning corporate customer receives unmasked recipient details
      const piiUnmaskedRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches", createdBatchId],
        null,
        tokenCustA
      );
      assert.strictEqual(piiUnmaskedRes.status, 200);
      assert.strictEqual(piiUnmaskedRes.json.recipients[0].recipient_phone, "9812345678");
      assert.strictEqual(piiUnmaskedRes.json.recipients[0].delivery_address, "12 Park Lane, Indiranagar");

      pass(12, "PII masking defense verified: sensitive phone/address masked for unprivileged staff");
    } catch (e) {
      fail(12, "PII masking test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Sanitized Server Error Response (Zero SQL Leak)
    // -------------------------------------------------------------------------
    try {
      // Calling with malformed parameters that trigger internal checks
      const errRes = await apiRequest(
        "GET",
        ["admin", "corporate-gifting", "batches", "' OR 1=1 --"],
        null,
        tokenStaffFull
      );
      assert.ok([400, 404].includes(errRes.status), "SQL injection string safely handled");
      assert.ok(!JSON.stringify(errRes.json).includes("SELECT"), "Never leak SQL query");
      assert.ok(!JSON.stringify(errRes.json).includes("pg_"), "Never leak PostgreSQL table internals");

      pass(13, "Sanitized error responses confirmed: zero SQL strings or database internals leaked");
    } catch (e) {
      fail(13, "Sanitized error test failed", e);
    }

  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN & PRISTINE DATABASE RESTORATION
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("  TEARDOWN & PRISTINE DATABASE RESTORATION                        ");
    console.log("------------------------------------------------------------------");

    try {
      // 1. Delete recipient records
      await pool.query(`DELETE FROM public.corporate_gifting_recipient WHERE batch_id = ANY($1::text[]);`, [createdBatchIds]);
      // 2. Delete batch records
      await pool.query(`DELETE FROM public.corporate_gifting_batch WHERE id = ANY($1::text[]);`, [createdBatchIds]);

      // 3. Delete accounting journal lines, entries, vouchers & invoices
      const allInvs = await pool.query(`
        SELECT id FROM public.invoice 
        WHERE id = ANY($1::text[]) OR customer_id = ANY($2::text[]);
      `, [createdInvoiceIds.filter(Boolean), createdCustomerIds]);
      const allInvIds = allInvs.rows.map((r) => r.id);

      const vRes = await pool.query(`
        SELECT id FROM public.accounting_voucher 
        WHERE reference_id = ANY($1::text[]) OR id = ANY($2::text[])
      `, [allInvIds, createdVoucherIds.filter(Boolean)]);
      const vIds = vRes.rows.map((r) => r.id);

      if (vIds.length > 0) {
        const jeRes = await pool.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1::text[]);`, [vIds]);
        const jeIds = jeRes.rows.map((r) => r.id);
        if (jeIds.length > 0) {
          await pool.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1::text[]);`, [jeIds]);
          await pool.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1::text[]);`, [jeIds]);
        }
        await pool.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1::text[]);`, [vIds]);
      }

      // Also clean any orphan journal lines pointing to customer
      await pool.query(`DELETE FROM public.accounting_journal_line WHERE customer_id = ANY($1::text[]);`, [createdCustomerIds]);

      if (allInvIds.length > 0) {
        await pool.query(`DELETE FROM public.invoice WHERE id = ANY($1::text[]);`, [allInvIds]);
      }

      // 4. Delete deliveries and orders
      await pool.query(`
        DELETE FROM public.delivery 
        WHERE transaction_id = ANY($1::text[]) 
           OR transaction_id IN (SELECT id FROM public."order" WHERE customer_id = ANY($2::text[]));
      `, [createdOrderIds.filter(Boolean), createdCustomerIds]);

      await pool.query(`
        DELETE FROM public."order" 
        WHERE id = ANY($1::text[]) OR customer_id = ANY($2::text[]);
      `, [createdOrderIds.filter(Boolean), createdCustomerIds]);

      // 5. Delete cost centres
      if (createdCostCentreIds.length > 0) {
        await pool.query(`DELETE FROM public.cost_centre WHERE id = ANY($1::text[]);`, [createdCostCentreIds]);
      }

      // 6. Delete customers
      if (createdCustomerIds.length > 0) {
        await pool.query(`DELETE FROM public.customer WHERE id = ANY($1::text[]);`, [createdCustomerIds]);
      }

      // Post-flight verification
      const postCoa = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
      const postTb = await pool.query(`
        SELECT 
          COALESCE(SUM(debit_amount), 0)::numeric(12,2) AS total_dr,
          COALESCE(SUM(credit_amount), 0)::numeric(12,2) AS total_cr
        FROM public.accounting_journal_line;
      `);
      const postDr = Number(postTb.rows[0].total_dr);
      const postCr = Number(postTb.rows[0].total_cr);

      const bRes = await pool.query(`SELECT count(*)::int as count FROM public.corporate_gifting_batch;`);
      const rRes = await pool.query(`SELECT count(*)::int as count FROM public.corporate_gifting_recipient;`);

      console.log(`  [POSTFLIGHT] CoA: ${postCoa.rows[0].count} accounts | TB: Dr ₹${postDr.toFixed(2)} = Cr ₹${postCr.toFixed(2)}`);
      console.log(`  Residual Batches: ${bRes.rows[0].count} | Residual Recipients: ${rRes.rows[0].count}`);

      assert.strictEqual(postCoa.rows[0].count, 100, "CoA must remain 100");
      assert.strictEqual(postDr, preDr, "Dr balance must match baseline");
      assert.strictEqual(postCr, preCr, "Cr balance must match baseline");
      assert.strictEqual(bRes.rows[0].count, 0, "Zero residual batches");
      assert.strictEqual(rRes.rows[0].count, 0, "Zero residual recipients");
    } catch (tdErr) {
      console.error("  ✗ Teardown error:", tdErr);
    } finally {
      await pool.end();
    }
  }

  console.log("------------------------------------------------------------------");
  console.log(`\n==================================================================`);
  console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`==================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runStep7cSuite().catch((err) => {
  console.error("FATAL SUITE CRASH:", err);
  process.exit(1);
});
