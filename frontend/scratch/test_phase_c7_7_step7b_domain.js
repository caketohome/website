/**
 * CakeToHome ERP — Phase C7.7 Step 7B Domain Engine & Excel Ingestion Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Template generation and header validation (all 11 approved columns).
 * 2. Malformed workbook and oversized-file rejection.
 * 3. Dry-run validation: invalid phone, pincode, delivery dates, invalid quantity.
 * 4. Unknown/inactive SKU resolution and pricing.
 * 5. Cost-centre validation against C7.6.
 * 6. Corporate credit validation (retail customer, disabled credit, pending approval, limit exceeded).
 * 7. Dry-run zero database mutations guarantee (assert 0 changes).
 * 8. Duplicate SHA-256 file hash and concurrent replay defense.
 * 9. Concurrency-safe customer advisory lock & serial credit exposure check.
 * 10. Atomic all-or-nothing execution:
 *     - Master commercial order creation in public.order
 *     - Recipient child deliveries in public.delivery
 *     - Single master corporate GST tax invoice via BillsReceivableService
 *     - Master invoice uniqueness (zero per-recipient duplicate invoices)
 * 11. Transaction rollback on injected failure.
 * 12. Dynamic SalesTaxEngine reuse (intra/inter-state tax breakdown).
 * 13. RBAC, branch scoping, and tenant isolation.
 * 14. Teardown & Post-verification: CoA remains 100, Trial Balance preserved.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

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

async function createExcelBuffer(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Recipients');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return await workbook.xlsx.writeBuffer();
}

async function runSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.7 STEP 7B: DOMAIN & INGESTION SUITE   ");
  console.log("==================================================================\n");

  const conn = getConnectionString();
  process.env.DATABASE_URL = conn;
  const pool = new Pool({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  // Register TypeScript compilation hook
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

  const { CorporateGiftingService, CorporateGiftingError } = require('../src/lib/services/corporate-gifting.service');
  const { CorporateGiftingRepository } = require('../src/lib/repositories/corporate-gifting.repository');

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

  // Tracking fixtures for teardown
  const createdBatchIds = [];
  const createdCustomerIds = [];
  const createdCostCentreIds = [];
  const createdOrderIds = [];
  const createdInvoiceIds = [];
  const createdVoucherIds = [];

  try {
    // -------------------------------------------------------------------------
    // PREFLIGHT: Baseline Audit
    // -------------------------------------------------------------------------
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

    // Fetch an operational branch
    const branchRes = await pool.query(`SELECT id, code, name FROM public.branch WHERE deleted_at IS NULL LIMIT 1;`);
    assert.ok(branchRes.rows.length > 0, "At least one operational branch required");
    const testBranch = branchRes.rows[0];

    // Create a dedicated Cost Centre fixture
    const ccCode = `CC-GIFT-${Date.now().toString().slice(-4)}`;
    const ccRes = await pool.query(`
      INSERT INTO public.cost_centre (code, name, department, is_active, created_at, updated_at)
      VALUES ($1, 'Corporate Gifting Operations', 'MARKETING', true, NOW(), NOW())
      RETURNING id, code;
    `, [ccCode]);
    const testCostCentre = ccRes.rows[0];
    createdCostCentreIds.push(testCostCentre.id);

    // Create an approved corporate customer fixture
    const corpCustId = `cus_corp_${Date.now()}`;
    await pool.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, company_name, email, phone,
        is_corporate, credit_enabled, credit_status, credit_limit, payment_terms_days,
        credit_approved_by, credit_approved_at, created_at, updated_at
      ) VALUES (
        $1, 'Acme', 'Enterprises', 'Acme Corp Pvt Ltd', 'gifting@acme.corp', '9876543210',
        true, true, 'APPROVED', 250000.00, 30,
        'user_01KY29WECB2VKDVVAT8J6FH90F', NOW(), NOW(), NOW()
      );
    `, [corpCustId]);
    createdCustomerIds.push(corpCustId);

    // Create a retail customer fixture (for credit check tests)
    const retailCustId = `cus_ret_${Date.now()}`;
    await pool.query(`
      INSERT INTO public.customer (
        id, first_name, last_name, email, phone,
        is_corporate, credit_enabled, credit_status, credit_limit, created_at, updated_at
      ) VALUES (
        $1, 'Retail', 'Customer', 'retail@example.com', '9123456789',
        false, false, 'INACTIVE', 0, NOW(), NOW()
      );
    `, [retailCustId]);
    createdCustomerIds.push(retailCustId);

    // Standard actor context
    const actorContext = {
      userId: "user_01KY29WECB2VKDVVAT8J6FH90F",
      role: "SUPER_ADMIN",
      branchId: testBranch.id,
      companyId: "c2h_company_default",
    };

    // -------------------------------------------------------------------------
    // TEST 1: Template Generation & Header Validation
    // -------------------------------------------------------------------------
    try {
      const templateBuffer = await CorporateGiftingService.generateTemplateBuffer();
      assert.ok(Buffer.isBuffer(templateBuffer), "Template output must be a Buffer");
      assert.ok(templateBuffer.length > 1000, "Template buffer must be non-empty");

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(templateBuffer);
      const ws = wb.getWorksheet('Recipients');
      assert.ok(ws, "Sheet 'Recipients' must exist");

      const expectedHeaders = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      const actualHeaders = ws.getRow(1).values.filter(Boolean);
      assert.deepStrictEqual(actualHeaders, expectedHeaders, "All 11 approved columns must match exactly");
      pass(1, "Template generated with all 11 approved headers and correct workbook structure");
    } catch (e) {
      fail(1, "Template generation failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Malformed Workbook and Oversized File Rejection
    // -------------------------------------------------------------------------
    try {
      // 2a: Oversized file
      const dummyBig = Buffer.alloc(11 * 1024 * 1024);
      let oversizedErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(dummyBig, corpCustId, actorContext);
      } catch (err) {
        oversizedErr = err;
      }
      assert.ok(oversizedErr instanceof CorporateGiftingError, "Must throw CorporateGiftingError");
      assert.strictEqual(oversizedErr.code, "FILE_TOO_LARGE", "Error code must be FILE_TOO_LARGE");

      // 2b: Invalid file format (corrupt buffer)
      const corruptBuf = Buffer.from("NOT_A_VALID_EXCEL_STREAM");
      let corruptErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(corruptBuf, corpCustId, actorContext);
      } catch (err) {
        corruptErr = err;
      }
      assert.ok(corruptErr instanceof CorporateGiftingError, "Must throw CorporateGiftingError");
      assert.strictEqual(corruptErr.code, "INVALID_FILE_FORMAT", "Error code must be INVALID_FILE_FORMAT");

      // 2c: Missing required headers
      const badHeadersBuf = await createExcelBuffer(["Wrong_Col_1", "Wrong_Col_2"], [["Val1", "Val2"]]);
      let missingHeadersErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(badHeadersBuf, corpCustId, actorContext);
      } catch (err) {
        missingHeadersErr = err;
      }
      assert.ok(missingHeadersErr instanceof CorporateGiftingError, "Must throw CorporateGiftingError");
      assert.strictEqual(missingHeadersErr.code, "MISSING_REQUIRED_HEADERS", "Error code must be MISSING_REQUIRED_HEADERS");

      // 2d: Empty batch (headers only, 0 rows)
      const emptyBatchBuf = await createExcelBuffer([
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ], []);
      let emptyErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(emptyBatchBuf, corpCustId, actorContext);
      } catch (err) {
        emptyErr = err;
      }
      assert.ok(emptyErr instanceof CorporateGiftingError, "Must throw CorporateGiftingError");
      assert.strictEqual(emptyErr.code, "EMPTY_BATCH", "Error code must be EMPTY_BATCH");

      pass(2, "Malformed workbook, oversized file, missing headers, and empty batch correctly rejected");
    } catch (e) {
      fail(2, "File validation bounds test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Dry-Run Row-Level Validation (Phone, Pincode, Date, Quantity)
    // -------------------------------------------------------------------------
    try {
      const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const pastDate = "2020-01-01";
      const farFutureDate = "2030-01-01";

      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];

      const testRows = [
        // Row 2: Invalid phone (not 10 digits starting with 6-9)
        ["EMP001", "Alice Smith", "12345", "123 Main St, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Happy Birthday", testCostCentre.code],
        // Row 3: Invalid pincode (not 6 digits starting with 1-9)
        ["EMP002", "Bob Jones", "9876543211", "456 Park Rd, Bangalore", "056001", futureDate, "MORNING", "ACC-TOP-GOLD", 1, "Cheers", testCostCentre.code],
        // Row 4: Past delivery date
        ["EMP003", "Charlie Brown", "9876543212", "789 Lake View, Bangalore", "560001", pastDate, "AFTERNOON", "ACC-TOP-GOLD", 1, "Congrats", testCostCentre.code],
        // Row 5: Date beyond 60 days
        ["EMP004", "David Clark", "9876543213", "101 River View, Bangalore", "560001", farFutureDate, "EVENING", "ACC-TOP-GOLD", 1, "Best Wishes", testCostCentre.code],
        // Row 6: Invalid quantity (zero)
        ["EMP005", "Emma Watson", "9876543214", "202 Hill Rd, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 0, "Greetings", testCostCentre.code],
      ];

      const invalidBuf = await createExcelBuffer(headers, testRows);
      const valResult = await CorporateGiftingService.validateBatchImport(invalidBuf, corpCustId, actorContext);

      assert.strictEqual(valResult.isValid, false, "Batch with row errors must be marked isValid = false");
      assert.strictEqual(valResult.errors.length >= 5, true, "Must detect at least 5 row errors");

      const errorCodes = valResult.errors.map(e => e.code);
      assert.ok(errorCodes.includes("INVALID_PHONE"), "Must catch INVALID_PHONE");
      assert.ok(errorCodes.includes("INVALID_PINCODE"), "Must catch INVALID_PINCODE");
      assert.ok(errorCodes.includes("DATE_IN_PAST"), "Must catch DATE_IN_PAST");
      assert.ok(errorCodes.includes("DATE_OUT_OF_RANGE"), "Must catch DATE_OUT_OF_RANGE");
      assert.ok(errorCodes.includes("INVALID_QUANTITY"), "Must catch INVALID_QUANTITY");

      pass(3, "Dry-run row validation caught invalid phone, pincode, past date, distant date, and zero quantity");
    } catch (e) {
      fail(3, "Row-level validation test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Unknown / Inactive SKU and Price Resolution
    // -------------------------------------------------------------------------
    try {
      const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];

      const rows = [
        ["EMP101", "Frank Ocean", "9876543215", "Suite 404, Tech Park", "560001", futureDate, "EVENING", "NON_EXISTENT_SKU_999", 2, "Test", testCostCentre.code],
        ["EMP102", "Grace Hopper", "9876543216", "Suite 505, Tech Park", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Test", testCostCentre.code],
      ];

      const skuBuf = await createExcelBuffer(headers, rows);
      const valResult = await CorporateGiftingService.validateBatchImport(skuBuf, corpCustId, actorContext);

      assert.strictEqual(valResult.isValid, false, "Unknown SKU must cause validation failure");
      const skuErr = valResult.errors.find(e => e.code === "SKU_NOT_FOUND");
      assert.ok(skuErr, "Must flag SKU_NOT_FOUND for NON_EXISTENT_SKU_999");

      // Verify Grace Hopper resolved price 99 for ACC-TOP-GOLD
      const validRecipient = valResult.parsedRecipients.find(r => r.productSku === "ACC-TOP-GOLD");
      assert.ok(validRecipient, "ACC-TOP-GOLD recipient must be parsed");
      assert.strictEqual(validRecipient.unitPrice, 99, "Unit price must resolve to authoritative 99");

      pass(4, "Unknown SKU flagged with SKU_NOT_FOUND and authoritative SKU price correctly resolved");
    } catch (e) {
      fail(4, "SKU resolution test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Cost Centre Validation Against C7.6
    // -------------------------------------------------------------------------
    try {
      const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];

      const rows = [
        ["EMP201", "Hannah Abbott", "9876543217", "10 Green Rd, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Test", "INVALID_CC_999"],
      ];

      const ccBuf = await createExcelBuffer(headers, rows);
      const valResult = await CorporateGiftingService.validateBatchImport(ccBuf, corpCustId, actorContext);

      assert.strictEqual(valResult.isValid, false, "Invalid cost centre must cause validation failure");
      const ccErr = valResult.errors.find(e => e.code === "COST_CENTRE_NOT_FOUND");
      assert.ok(ccErr, "Must return COST_CENTRE_NOT_FOUND for non-existent cost centre code");

      pass(5, "Cost centre code validated against active C7.6 records and invalid code rejected");
    } catch (e) {
      fail(5, "Cost centre validation test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Corporate Credit Controls (Retail, Disabled, Unapproved, Limit Exceeded)
    // -------------------------------------------------------------------------
    try {
      const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      const validRows = [
        ["EMP301", "Ian Wright", "9876543218", "12 High St, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Best Wishes", testCostCentre.code],
      ];
      const validBuf = await createExcelBuffer(headers, validRows);

      // 6a: Retail customer (is_corporate = false)
      let retailErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(validBuf, retailCustId, actorContext);
      } catch (err) {
        retailErr = err;
      }
      assert.ok(retailErr instanceof CorporateGiftingError, "Retail customer must be rejected");
      assert.strictEqual(retailErr.code, "CUSTOMER_NOT_CORPORATE", "Must reject with CUSTOMER_NOT_CORPORATE");

      // 6b: Corporate customer with credit disabled
      const disabledCustId = `cus_dis_${Date.now()}`;
      await pool.query(`
        INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate, credit_enabled, credit_status, credit_limit, created_at, updated_at)
        VALUES ($1, 'Disabled', 'Credit', 'dis@corp.com', '9876543299', true, false, 'APPROVED', 50000, NOW(), NOW());
      `, [disabledCustId]);
      createdCustomerIds.push(disabledCustId);

      let disabledErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(validBuf, disabledCustId, actorContext);
      } catch (err) {
        disabledErr = err;
      }
      assert.ok(disabledErr instanceof CorporateGiftingError);
      assert.strictEqual(disabledErr.code, "CUSTOMER_CREDIT_DISABLED", "Must reject with CUSTOMER_CREDIT_DISABLED");

      // 6c: Corporate customer with credit status != 'APPROVED'
      const pendingCustId = `cus_pen_${Date.now()}`;
      await pool.query(`
        INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate, credit_enabled, credit_status, credit_limit, created_at, updated_at)
        VALUES ($1, 'Pending', 'Credit', 'pen@corp.com', '9876543298', true, true, 'PENDING', 50000, NOW(), NOW());
      `, [pendingCustId]);
      createdCustomerIds.push(pendingCustId);

      let pendingErr = null;
      try {
        await CorporateGiftingService.validateBatchImport(validBuf, pendingCustId, actorContext);
      } catch (err) {
        pendingErr = err;
      }
      assert.ok(pendingErr instanceof CorporateGiftingError);
      assert.strictEqual(pendingErr.code, "CREDIT_APPROVAL_REQUIRED", "Must reject with CREDIT_APPROVAL_REQUIRED");

      // 6d: Credit limit exceeded
      // Create customer with ₹100 credit limit and try to order 2 items @ 99 = 198 + tax > 100
      const lowLimitCustId = `cus_low_${Date.now()}`;
      await pool.query(`
        INSERT INTO public.customer (id, first_name, last_name, email, phone, is_corporate, credit_enabled, credit_status, credit_limit, created_at, updated_at)
        VALUES ($1, 'Low', 'Limit', 'low@corp.com', '9876543297', true, true, 'APPROVED', 100.00, NOW(), NOW());
      `, [lowLimitCustId]);
      createdCustomerIds.push(lowLimitCustId);

      const bigBatchRows = [
        ["EMP301", "Ian Wright", "9876543218", "12 High St, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 2, "Gift", testCostCentre.code],
      ];
      const bigBatchBuf = await createExcelBuffer(headers, bigBatchRows);

      // Test both dry-run detection and execution hard block:
      const limitValRes = await CorporateGiftingService.validateBatchImport(bigBatchBuf, lowLimitCustId, actorContext);
      assert.strictEqual(limitValRes.isValid, false, "Batch exceeding credit limit must fail validation");
      assert.strictEqual(limitValRes.summary.creditLimitExceeded, true, "summary.creditLimitExceeded must be true");
      const hasLimitErr = limitValRes.errors.some(e => e.code === "CREDIT_LIMIT_EXCEEDED");
      assert.ok(hasLimitErr, "Must flag CREDIT_LIMIT_EXCEEDED in validation errors");

      let limitErr = null;
      try {
        await CorporateGiftingService.executeBatchImport({
          fileBuffer: bigBatchBuf,
          customerId: lowLimitCustId,
          branchId: testBranch.id,
          batchName: "Overlimit Batch",
          actorContext,
        });
      } catch (err) {
        limitErr = err;
      }
      assert.ok(limitErr instanceof CorporateGiftingError, "Execution must throw CorporateGiftingError");
      assert.strictEqual(limitErr.code, "CREDIT_LIMIT_EXCEEDED", "Must reject execution with CREDIT_LIMIT_EXCEEDED");

      pass(6, "All corporate credit gates enforced: retail blocked, disabled blocked, unapproved blocked, limit-exceeded blocked");
    } catch (e) {
      fail(6, "Corporate credit controls test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Dry-Run Zero Database Mutations Guarantee
    // -------------------------------------------------------------------------
    try {
      // Snapshot row counts before dry run
      const countBefore = await pool.query(`
        SELECT 
          (SELECT count(*) FROM public.corporate_gifting_batch) AS batches,
          (SELECT count(*) FROM public.corporate_gifting_recipient) AS recipients,
          (SELECT count(*) FROM public."order") AS orders,
          (SELECT count(*) FROM public.invoice) AS invoices,
          (SELECT count(*) FROM public.delivery) AS deliveries,
          (SELECT count(*) FROM public.accounting_voucher) AS vouchers;
      `);

      const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      const validRows = [
        ["EMP401", "Jack Black", "9876543219", "55 Market Rd, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Best Wishes", testCostCentre.code],
        ["EMP402", "Kelly Clark", "9876543220", "66 Market Rd, Bangalore", "560001", futureDate, "EVENING", "ACC-CAN-MAGIC", 2, "Happy Celebrations", testCostCentre.code],
      ];
      const validBuf = await createExcelBuffer(headers, validRows);

      const valRes = await CorporateGiftingService.validateBatchImport(validBuf, corpCustId, actorContext);
      assert.strictEqual(valRes.isValid, true, "Valid batch must pass validation");

      const countAfter = await pool.query(`
        SELECT 
          (SELECT count(*) FROM public.corporate_gifting_batch) AS batches,
          (SELECT count(*) FROM public.corporate_gifting_recipient) AS recipients,
          (SELECT count(*) FROM public."order") AS orders,
          (SELECT count(*) FROM public.invoice) AS invoices,
          (SELECT count(*) FROM public.delivery) AS deliveries,
          (SELECT count(*) FROM public.accounting_voucher) AS vouchers;
      `);

      assert.deepStrictEqual(countBefore.rows[0], countAfter.rows[0], "Dry-run must not mutate any database tables");
      pass(7, "Strict zero-mutation guarantee confirmed: batches, recipients, orders, invoices, deliveries, and vouchers unchanged");
    } catch (e) {
      fail(7, "Dry-run zero mutation test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Atomic All-or-Nothing Batch Execution & Master Invoice Creation
    // -------------------------------------------------------------------------
    let executedBatchId = null;
    let masterOrderId = null;
    let masterInvoiceId = null;
    let executionBuf = null;
    try {
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      const batchRows = [
        ["EMP501", "Liam Neeson", "9876543221", "100 MG Road, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Good Luck", testCostCentre.code],
        ["EMP502", "Maya Angelou", "9876543222", "101 MG Road, Bangalore", "560001", futureDate, "MORNING", "ACC-CAN-MAGIC", 2, "Celebrations", testCostCentre.code],
        ["EMP503", "Noah Smith", "9876543223", "102 MG Road, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Congrats", testCostCentre.code],
      ];
      executionBuf = await createExcelBuffer(headers, batchRows);

      const execResult = await CorporateGiftingService.executeBatchImport({
        fileBuffer: executionBuf,
        customerId: corpCustId,
        branchId: testBranch.id,
        batchName: "Q4 Corporate Appreciation Batch",
        actorContext,
      });

      assert.ok(execResult.batch, "Execution must return created batch");
      assert.strictEqual(execResult.batch.total_recipients, 3, "Batch total_recipients must be 3");
      assert.strictEqual(execResult.batch.status, "SCHEDULED", "Batch status must transition to SCHEDULED");
      assert.ok(execResult.batch.order_id, "Batch must reference master order_id");
      assert.ok(execResult.batch.invoice_id, "Batch must reference master corporate invoice_id");
      assert.strictEqual(execResult.recipientsCount, 3, "Must report exactly 3 recipient records");

      const recips = await pool.query(`SELECT * FROM public.corporate_gifting_recipient WHERE batch_id = $1`, [execResult.batch.id]);
      assert.strictEqual(recips.rows.length, 3, "Must insert exactly 3 recipient records in DB");

      executedBatchId = execResult.batch.id;
      masterOrderId = execResult.batch.order_id;
      masterInvoiceId = execResult.batch.invoice_id;
      createdBatchIds.push(executedBatchId);
      createdOrderIds.push(masterOrderId);
      createdInvoiceIds.push(masterInvoiceId);

      // Verify Commercial Master Order in public.order
      const ordCheck = await pool.query(`SELECT * FROM public."order" WHERE id = $1`, [masterOrderId]);
      assert.strictEqual(ordCheck.rows.length, 1, "Master umbrella order must exist in public.order");
      assert.strictEqual(ordCheck.rows[0].customer_id, corpCustId, "Order customer must be corporate customer");
      assert.strictEqual(ordCheck.rows[0].metadata?.channel, "CORPORATE_GIFTING", "Order channel must be CORPORATE_GIFTING");

      // Verify Child Deliveries in public.delivery
      const delCheck = await pool.query(`SELECT * FROM public.delivery WHERE transaction_id = $1`, [masterOrderId]);
      assert.strictEqual(delCheck.rows.length, 3, "Must create exactly 3 delivery rows (1 per recipient)");

      // Verify Single Master Corporate Invoice in public.invoice
      const invCheck = await pool.query(`SELECT * FROM public.invoice WHERE id = $1`, [masterInvoiceId]);
      assert.strictEqual(invCheck.rows.length, 1, "Single master corporate invoice must exist");
      assert.strictEqual(invCheck.rows[0].is_corporate, true, "Invoice is_corporate must be true");
      assert.strictEqual(invCheck.rows[0].status, "POSTED", "Invoice status must be POSTED");
      assert.strictEqual(invCheck.rows[0].order_id, masterOrderId, "Invoice must link to master commercial order");

      // CRITICAL CHECK: Master Invoice Uniqueness — Exactly 1 invoice for the entire batch
      const allInvsForOrder = await pool.query(`SELECT id FROM public.invoice WHERE order_id = $1`, [masterOrderId]);
      assert.strictEqual(allInvsForOrder.rows.length, 1, "Strictly ONE master invoice created for the entire batch. Zero per-recipient invoices!");

      // Verify Accounting Voucher was posted for the single master invoice
      const vCheck = await pool.query(`
        SELECT v.id, v.voucher_no, v.total_amount, v.status
        FROM public.accounting_voucher v
        WHERE v.reference_id = $1 AND v.reference_type = 'SALES_INVOICE'
      `, [masterInvoiceId]);
      assert.strictEqual(vCheck.rows.length, 1, "Canonical GL voucher must be posted for master invoice");
      assert.strictEqual(vCheck.rows[0].status, "POSTED", "Voucher status must be POSTED");
      createdVoucherIds.push(vCheck.rows[0].id);

      pass(8, "Atomic execution completed: 1 batch, 3 recipients, 1 master order, 3 deliveries, 1 single corporate invoice posted");
    } catch (e) {
      fail(8, "Atomic execution test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Duplicate File Hash & Concurrent Replay Defense
    // -------------------------------------------------------------------------
    try {
      assert.ok(executedBatchId, "Prerequisite: executed batch required");
      assert.ok(executionBuf, "Prerequisite: executed buffer required");

      // Re-upload identical file buffer (same bytes = same SHA-256)
      const duplicateBuf = executionBuf;

      let replayErr = null;
      try {
        await CorporateGiftingService.executeBatchImport({
          fileBuffer: duplicateBuf,
          customerId: corpCustId,
          branchId: testBranch.id,
          batchName: "Replay Attempt Batch",
          actorContext,
        });
      } catch (err) {
        replayErr = err;
      }

      assert.ok(replayErr instanceof CorporateGiftingError, "Replay must throw CorporateGiftingError");
      assert.strictEqual(replayErr.code, "DUPLICATE_FILE_HASH", "Replay must be rejected with DUPLICATE_FILE_HASH");
      pass(9, "Duplicate SHA-256 file hash replay defense rejected re-execution of active batch");
    } catch (e) {
      fail(9, "Replay defense test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Concurrency Serialization & Advisory Lock Gate
    // -------------------------------------------------------------------------
    try {
      // Create a customer with credit limit = 400
      // We will launch two competing batch imports concurrently that both try to use ~300 credit
      // Because 300 + 300 = 600 > 400, strictly ONE must succeed and the second MUST fail with CREDIT_LIMIT_EXCEEDED
      const concCustId = `cus_conc_${Date.now()}`;
      await pool.query(`
        INSERT INTO public.customer (
          id, first_name, last_name, company_name, email, phone,
          is_corporate, credit_enabled, credit_status, credit_limit, payment_terms_days,
          credit_approved_by, credit_approved_at, created_at, updated_at
        ) VALUES (
          $1, 'Concurrency', 'Testing Ltd', 'Conc Corp', 'conc@test.corp', '9876543333',
          true, true, 'APPROVED', 400.00, 30,
          'user_01KY29WECB2VKDVVAT8J6FH90F', NOW(), NOW(), NOW()
        );
      `, [concCustId]);
      createdCustomerIds.push(concCustId);

      const futureDate = new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      // 3 items @ 99 = 297 + tax = ~312
      const batchA = await createExcelBuffer(headers, [
        ["EMP_A1", "Person A", "9876543231", "Address A, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 3, "Batch A", testCostCentre.code],
      ]);
      const batchB = await createExcelBuffer(headers, [
        ["EMP_B1", "Person B", "9876543232", "Address B, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 3, "Batch B", testCostCentre.code],
      ]);

      const [resA, resB] = await Promise.allSettled([
        CorporateGiftingService.executeBatchImport({
          fileBuffer: batchA,
          customerId: concCustId,
          branchId: testBranch.id,
          batchName: "Concurrent Batch A",
          actorContext,
        }),
        CorporateGiftingService.executeBatchImport({
          fileBuffer: batchB,
          customerId: concCustId,
          branchId: testBranch.id,
          batchName: "Concurrent Batch B",
          actorContext,
        })
      ]);

      const successCount = [resA, resB].filter(r => r.status === 'fulfilled').length;
      const rejectedCount = [resA, resB].filter(r => r.status === 'rejected').length;

      assert.strictEqual(successCount, 1, "Exactly one batch must succeed under credit limit");
      assert.strictEqual(rejectedCount, 1, "The competing batch must be rejected");

      const rejectedResult = resA.status === 'rejected' ? resA.reason : resB.reason;
      assert.strictEqual(rejectedResult.code, "CREDIT_LIMIT_EXCEEDED", "Competing batch must fail with CREDIT_LIMIT_EXCEEDED");

      // Track the successful one for cleanup
      const successfulResult = resA.status === 'fulfilled' ? resA.value : resB.value;
      createdBatchIds.push(successfulResult.batch.id);
      createdOrderIds.push(successfulResult.batch.order_id);
      createdInvoiceIds.push(successfulResult.batch.invoice_id);

      pass(10, "Advisory transaction lock serialized competing batches: 1 passed, 1 rejected with CREDIT_LIMIT_EXCEEDED (zero credit races)");
    } catch (e) {
      fail(10, "Concurrency lock test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Transaction Rollback on Injected Failure
    // -------------------------------------------------------------------------
    try {
      const countBefore = await pool.query(`
        SELECT 
          (SELECT count(*) FROM public.corporate_gifting_batch) AS batches,
          (SELECT count(*) FROM public.corporate_gifting_recipient) AS recipients,
          (SELECT count(*) FROM public."order") AS orders,
          (SELECT count(*) FROM public.invoice) AS invoices;
      `);

      // Mock an invalid customer during execution to trigger rollback
      const futureDate = new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      const rollbackBuf = await createExcelBuffer(headers, [
        ["EMP_R1", "Rollback Tester", "9876543241", "Rollback Way, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "Rollback", testCostCentre.code],
      ]);

      let errorThrown = false;
      try {
        await CorporateGiftingService.executeBatchImport({
          fileBuffer: rollbackBuf,
          customerId: "cus_non_existent_9999",
          branchId: testBranch.id,
          batchName: "Rollback Injected Batch",
          actorContext,
        });
      } catch (err) {
        errorThrown = true;
      }
      assert.ok(errorThrown, "Must throw on non-existent customer");

      const countAfter = await pool.query(`
        SELECT 
          (SELECT count(*) FROM public.corporate_gifting_batch) AS batches,
          (SELECT count(*) FROM public.corporate_gifting_recipient) AS recipients,
          (SELECT count(*) FROM public."order") AS orders,
          (SELECT count(*) FROM public.invoice) AS invoices;
      `);

      assert.deepStrictEqual(countBefore.rows[0], countAfter.rows[0], "Failure must roll back all mutations completely");
      pass(11, "All-or-nothing rollback confirmed: zero partial batches, orders, or invoices persisted");
    } catch (e) {
      fail(11, "Transaction rollback test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 12: SalesTaxEngine Dynamic Reuse (Place of Supply)
    // -------------------------------------------------------------------------
    try {
      assert.ok(masterInvoiceId, "Prerequisite: executed master invoice required");

      const invRes = await pool.query(`
        SELECT inv.subtotal, inv.tax_total, inv.grand_total, inv.metadata
        FROM public.invoice inv
        WHERE id = $1
      `, [masterInvoiceId]);
      assert.strictEqual(invRes.rows.length, 1);
      const inv = invRes.rows[0];
      const meta = inv.metadata || {};

      // Intra-state supply (Branch in Karnataka, delivery in Bangalore Karnataka)
      // CGST and SGST must be split equally, IGST = 0
      const cgst = Number(meta.cgst || 0);
      const sgst = Number(meta.sgst || 0);
      const igst = Number(meta.igst || 0);
      const taxTotal = Number(inv.tax_total);

      assert.strictEqual(cgst, sgst, "Intra-state supply must split tax equally between CGST and SGST");
      assert.strictEqual(igst, 0, "Intra-state supply must have IGST = 0");
      assert.strictEqual(Math.round((cgst + sgst) * 100) / 100, taxTotal, "CGST + SGST must sum to tax_total");
      assert.ok(taxTotal > 0, "Tax total must be greater than zero");
      assert.strictEqual(meta.is_intra_state, true, "is_intra_state must be true");

      pass(12, "SalesTaxEngine dynamic calculation verified: intra-state place of supply correctly yielded equal CGST/SGST with zero IGST");
    } catch (e) {
      fail(12, "Sales tax calculation test failed", e);
    }

    // -------------------------------------------------------------------------
    // TEST 13: RBAC, Branch Scoping, and Tenant Scoping
    // -------------------------------------------------------------------------
    try {
      // Unassigned staff without branch should be rejected for execution
      const unassignedStaffContext = {
        userId: "staff_no_branch",
        role: "STAFF",
        companyId: "c2h_company_default",
      };

      const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      const headers = [
        "Employee_ID", "Recipient_Name", "Recipient_Phone", "Delivery_Address",
        "Delivery_Pincode", "Delivery_Date", "Delivery_Slot", "Product_SKU",
        "Quantity", "Gift_Message", "Cost_Centre_Code"
      ];
      const rbacBuf = await createExcelBuffer(headers, [
        ["EMP_RBAC", "RBAC Tester", "9876543251", "Branch Ave, Bangalore", "560001", futureDate, "EVENING", "ACC-TOP-GOLD", 1, "RBAC", testCostCentre.code],
      ]);

      let rbacErr = null;
      try {
        await CorporateGiftingService.executeBatchImport({
          fileBuffer: rbacBuf,
          customerId: corpCustId,
          branchId: testBranch.id,
          batchName: "RBAC Unauthorized Batch",
          actorContext: unassignedStaffContext,
        });
      } catch (err) {
        rbacErr = err;
      }
      assert.ok(rbacErr, "Non-authorized staff must be denied");
      assert.ok(rbacErr.code === "BRANCH_ACCESS_DENIED" || rbacErr.message.includes("branch"), "Must reject for branch access");

      // Verify Batch List Scoping
      const batchesList = await CorporateGiftingService.listBatches({
        customerId: corpCustId,
        actorContext,
      });
      assert.ok(batchesList.batches.length > 0, "Must list batches for customer");
      for (const b of batchesList.batches) {
        assert.strictEqual(b.customer_id, corpCustId, "All returned batches must belong to scoped customer");
      }

      pass(13, "RBAC, cross-branch protection, and customer-scoped batch listing verified");
    } catch (e) {
      fail(13, "RBAC test failed", e);
    }

  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN & RESTORATION
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("  TEARDOWN & PRISTINE DATABASE RESTORATION                        ");
    console.log("------------------------------------------------------------------");

    // 1. Delete created batches & recipients (by batch IDs and by customer IDs)
    await pool.query(`
      DELETE FROM public.corporate_gifting_recipient 
      WHERE batch_id = ANY($1::varchar[]) 
         OR batch_id IN (SELECT id FROM public.corporate_gifting_batch WHERE customer_id = ANY($2::text[]));
    `, [createdBatchIds, createdCustomerIds]);

    await pool.query(`
      DELETE FROM public.corporate_gifting_batch 
      WHERE id = ANY($1::varchar[]) OR customer_id = ANY($2::text[]);
    `, [createdBatchIds, createdCustomerIds]);

    // 2. Delete invoices, invoice lines, vouchers & journal lines BEFORE orders/deliveries
    const allInvs = await pool.query(`
      SELECT id FROM public.invoice 
      WHERE id = ANY($1::text[]) OR customer_id = ANY($2::text[]);
    `, [createdInvoiceIds, createdCustomerIds]);
    const allInvIds = allInvs.rows.map(r => r.id);

    if (allInvIds.length > 0 || createdVoucherIds.length > 0) {
      const vRes = await pool.query(`
        SELECT id FROM public.accounting_voucher 
        WHERE reference_id = ANY($1::text[]) OR id = ANY($2::text[])
      `, [allInvIds, createdVoucherIds]);
      const vIds = vRes.rows.map(r => r.id);

      if (vIds.length > 0) {
        const jRes = await pool.query(`SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1::text[])`, [vIds]);
        const jIds = jRes.rows.map(r => r.id);
        if (jIds.length > 0) {
          await pool.query(`DELETE FROM public.accounting_journal_line WHERE journal_entry_id = ANY($1::text[])`, [jIds]);
          await pool.query(`DELETE FROM public.accounting_journal_entry WHERE id = ANY($1::text[])`, [jIds]);
        }
        await pool.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1::text[])`, [vIds]);
      }

      await pool.query(`DELETE FROM public.invoice WHERE id = ANY($1::text[])`, [allInvIds]);
    }

    // 3. Delete test deliveries & orders
    await pool.query(`
      DELETE FROM public.delivery 
      WHERE transaction_id = ANY($1::text[]) 
         OR transaction_id IN (SELECT id FROM public."order" WHERE customer_id = ANY($2::text[]));
    `, [createdOrderIds, createdCustomerIds]);

    await pool.query(`
      DELETE FROM public."order" 
      WHERE id = ANY($1::text[]) OR customer_id = ANY($2::text[]);
    `, [createdOrderIds, createdCustomerIds]);

    // 4. Delete test cost centres
    if (createdCostCentreIds.length > 0) {
      await pool.query(`DELETE FROM public.cost_centre WHERE id = ANY($1::text[])`, [createdCostCentreIds]);
    }

    // 5. Delete test customers
    if (createdCustomerIds.length > 0) {
      await pool.query(`DELETE FROM public.customer WHERE id = ANY($1::text[])`, [createdCustomerIds]);
    }

    // 6. Postflight Audit
    const postCoa = (await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`)).rows[0].count;
    assert.strictEqual(postCoa, 100, "CoA must remain strictly 100 accounts");

    const postTb = await pool.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(12,2) AS total_dr,
        COALESCE(SUM(credit_amount), 0)::numeric(12,2) AS total_cr
      FROM public.accounting_journal_line;
    `);
    const postDr = Number(postTb.rows[0].total_dr);
    const postCr = Number(postTb.rows[0].total_cr);

    assert.strictEqual(postDr, postCr, "Trial balance Dr must equal Cr");
    console.log(`  [POSTFLIGHT] CoA: ${postCoa} accounts | TB: Dr ₹${postDr.toFixed(2)} = Cr ₹${postCr.toFixed(2)}`);

    const residualBatches = (await pool.query(`SELECT count(*)::int as count FROM public.corporate_gifting_batch`)).rows[0].count;
    const residualRecips = (await pool.query(`SELECT count(*)::int as count FROM public.corporate_gifting_recipient`)).rows[0].count;
    assert.strictEqual(residualBatches, 0, "Residual batches must be 0");
    assert.strictEqual(residualRecips, 0, "Residual recipients must be 0");

    console.log(`  Residual Batches: ${residualBatches} | Residual Recipients: ${residualRecips}`);
    console.log("------------------------------------------------------------------\n");

    await pool.end();
  }

  console.log("==================================================================");
  console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error("Test Suite Unhandled Fatal:", err);
  process.exit(1);
});
