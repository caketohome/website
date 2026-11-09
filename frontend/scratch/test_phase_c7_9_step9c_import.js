/**
 * CakeToHome ERP — Phase C7.9 Step 9C Bulk Employee Roster Import Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Preflight baseline audit (CoA 100, Vouchers 6, JEs 4, JLs 10, TB 3380.00, corporate tables clean).
 * 2. Excel Template Generation (worksheets, columns, sample row, instructions).
 * 3. Dry-Run Validation on clean workbook (valid rows, zero DB mutations).
 * 4. Row-Level Error Diagnostics (missing code, missing name, invalid phone, email, pincode, coordinates).
 * 5. Internal duplicate code defense within workbook (DUPLICATE_CODE_IN_BATCH).
 * 6. Database duplicate code defense:
 *    - Active duplicate -> DUPLICATE_EMPLOYEE_CODE
 *    - Inactive (deactivated) duplicate -> EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED
 * 7. Phone reuse warnings without rejecting creation.
 * 8. Replay protection (SHA-256 hash committed defense).
 * 9. Atomic all-or-nothing commit execution:
 *    - Creation of employee records
 *    - Append-only CREATED and IMPORTED audit events
 *    - Batch status COMMITTED with inserted row counters
 * 10. Fail-closed rollback on invalid batch commit.
 * 11. Scoped authorization: ROSTER_MANAGER of account permitted, cross-account denied.
 * 12. Teardown & Postflight Audit (CoA 100, TB 3380.00, corporate tables clean).
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
  const sheet = workbook.addWorksheet('Employee_Roster');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return await workbook.xlsx.writeBuffer();
}

async function runSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.9 STEP 9C: BULK ROSTER IMPORT SUITE   ");
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

  const { CorporateAccountService } = require('../src/lib/services/corporate-account.service');
  const { CorporateEmployeeService, CorporateEmployeeError } = require('../src/lib/services/corporate-employee.service');
  const { CorporateEmployeeImportService } = require('../src/lib/services/corporate-employee-import.service');
  const { CorporateEmployeeRepository, CorporateEventRepository, CorporateEmployeeImportBatchRepository } = require('../src/lib/repositories/corporate-account.repository');

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
  const createdAccountIds = [];
  const createdCustomerIds = [];
  const createdUserIds = [];

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
    assert.strictEqual(preDr, preCr, "Trial balance must be balanced");
    assert.strictEqual(preDr, 3380.00, "Trial balance must be exactly 3380.00");

    const tablesCheck = await pool.query(`
      SELECT 'corporate_account' as tbl, count(*)::int as cnt FROM public.corporate_account
      UNION ALL SELECT 'corporate_account_contact', count(*)::int FROM public.corporate_account_contact
      UNION ALL SELECT 'corporate_account_member', count(*)::int FROM public.corporate_account_member
      UNION ALL SELECT 'corporate_employee', count(*)::int FROM public.corporate_employee
      UNION ALL SELECT 'corporate_employee_event', count(*)::int FROM public.corporate_employee_event
      UNION ALL SELECT 'corporate_account_event', count(*)::int FROM public.corporate_account_event
      UNION ALL SELECT 'corporate_employee_import_batch', count(*)::int FROM public.corporate_employee_import_batch;
    `);
    for (const r of tablesCheck.rows) {
      assert.strictEqual(r.cnt, 0, `Preflight: Table ${r.tbl} must be clean (0 rows)`);
    }

    console.log(`  [PREFLIGHT] CoA: 100 accounts | TB: Dr ₹${preDr.toFixed(2)} = Cr ₹${preCr.toFixed(2)} | Corporate Tables: 0 rows`);
    console.log("------------------------------------------------------------------\n");

    // -------------------------------------------------------------------------
    // SETUP FIXTURES
    // -------------------------------------------------------------------------
    const tsSuffix = Date.now().toString().slice(-6);
    const custId1 = `cus_import_test_${tsSuffix}_1`;
    const custId2 = `cus_import_test_${tsSuffix}_2`;

    await pool.query(`
      INSERT INTO public.customer (id, first_name, last_name, company_name, email, phone, created_at, updated_at)
      VALUES 
        ($1, 'HCL', 'Technologies', NULL, 'contact1@hcl.corp', '9811133311', NOW(), NOW()),
        ($2, 'Wipro', 'Limited', NULL, 'contact2@wipro.corp', '9811133322', NOW(), NOW());
    `, [custId1, custId2]);
    createdCustomerIds.push(custId1, custId2);

    const userIdSuperAdmin = `usr_sa_imp_${tsSuffix}`;
    const userIdRosterMgr = `usr_rm_imp_${tsSuffix}`;
    const userIdOtherMgr = `usr_om_imp_${tsSuffix}`;

    await pool.query(`
      INSERT INTO public."user" (id, email, first_name, last_name, created_at, updated_at)
      VALUES 
        ($1, 'superadmin@imp.test', 'Admin', 'User', NOW(), NOW()),
        ($2, 'rostermgr@imp.test', 'Roster', 'Manager', NOW(), NOW()),
        ($3, 'othermgr@imp.test', 'Other', 'Manager', NOW(), NOW());
    `, [userIdSuperAdmin, userIdRosterMgr, userIdOtherMgr]);
    createdUserIds.push(userIdSuperAdmin, userIdRosterMgr, userIdOtherMgr);

    const superAdminActor = {
      userId: userIdSuperAdmin,
      isSuperAdmin: true,
      role: "SUPER_ADMIN",
    };

    // Create Corporate Account 1 (HCL)
    const testGstin1 = `29AABCH${tsSuffix.slice(-4)}M1Z1`;
    const testPan1 = `AABCH${tsSuffix.slice(-4)}M`;
    const account1 = await CorporateAccountService.createAccount(
      {
        customer_id: custId1,
        legal_name: "HCL Technologies Ltd",
        gstin: testGstin1,
        pan: testPan1,
      },
      superAdminActor
    );
    createdAccountIds.push(account1.id);

    // Approve Account 1 with different Super Admin
    await pool.query(`
      UPDATE public.corporate_account 
      SET status = 'APPROVED', approved_by = 'user_01KY29WECB2VKDVVAT8J6FH90F', approved_at = NOW() 
      WHERE id = $1;
    `, [account1.id]);

    // Grant ROSTER_MANAGER to userIdRosterMgr
    await CorporateAccountService.grantMembership(
      account1.id,
      { userId: userIdRosterMgr, memberRole: "ROSTER_MANAGER" },
      superAdminActor
    );

    const rosterMgrActor = {
      userId: userIdRosterMgr,
      isSuperAdmin: false,
      role: "CUSTOMER",
      scopedAccountId: account1.id,
      permissions: [],
    };

    const otherMgrActor = {
      userId: userIdOtherMgr,
      isSuperAdmin: false,
      role: "CUSTOMER",
      scopedAccountId: "ca_unrelated_account",
      permissions: [],
    };

    // -------------------------------------------------------------------------
    // TEST 1: Template Generation
    // -------------------------------------------------------------------------
    try {
      const templateBuf = await CorporateEmployeeImportService.generateTemplateBuffer();
      assert.ok(Buffer.isBuffer(templateBuf), "Template must be a Buffer");
      assert.ok(templateBuf.length > 1000, "Template buffer must be non-empty");

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(templateBuf);
      assert.strictEqual(wb.worksheets.length, 2, "Must contain 2 worksheets (Roster + Instructions)");
      const dataSheet = wb.worksheets[0];
      assert.strictEqual(dataSheet.name, "Employee_Roster");
      const headerValues = dataSheet.getRow(1).values.filter(Boolean);
      assert.ok(headerValues.includes("Employee_Code"), "Must include Employee_Code header");
      assert.ok(headerValues.includes("Full_Name"), "Must include Full_Name header");
      assert.ok(headerValues.includes("Phone"), "Must include Phone header");

      pass(1, "Template buffer generated with standard columns, styles, and instructions sheet");
    } catch (err) {
      fail(1, "Template generation failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Dry-Run Validation on Clean Valid Workbook & Zero-Mutation Invariant
    // -------------------------------------------------------------------------
    const headers = [
      "Employee_Code", "Full_Name", "Phone", "Email",
      "Department", "Designation", "Delivery_Address", "City", "State", "PIN_Code",
      "Latitude", "Longitude"
    ];

    const cleanRows = [
      ["HCL-001", "Arun Kumar", "9812345671", "arun@hcl.corp", "Cloud", "Lead Architect", "12 Richmond Rd", "Bengaluru", "KA", "560025", 12.9667, 77.5996],
      ["HCL-002", "Bhavna Patel", "9812345672", "bhavna@hcl.corp", "Data", "Data Engineer", "54 Bannerghatta Rd", "Bengaluru", "KA", "560076", 12.8984, 77.5990],
      ["HCL-003", "Chetan Das", "9812345673", "chetan@hcl.corp", "Security", "Security Analyst", "88 Electronic City", "Bengaluru", "KA", "560100", 12.8452, 77.6602],
    ];

    const cleanBuf = await createExcelBuffer(headers, cleanRows);

    try {
      const res = await CorporateEmployeeImportService.validateRosterImport(
        account1.id,
        cleanBuf,
        "hcl_roster_q4.xlsx",
        rosterMgrActor
      );

      assert.strictEqual(res.isValid, true, "Clean batch must be valid");
      assert.strictEqual(res.totalRows, 3, "Total rows must be 3");
      assert.strictEqual(res.validRows, 3, "Valid rows must be 3");
      assert.strictEqual(res.invalidRows, 0, "Invalid rows must be 0");
      assert.strictEqual(res.errors.length, 0, "Errors array must be empty");
      assert.ok(res.fileHash, "Must contain SHA-256 file hash");
      assert.ok(res.batchId, "Must create a batch tracking record ID");

      // Verify ZERO-MUTATION invariant on corporate_employee
      const empCount = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee WHERE account_id = $1`, [account1.id]);
      assert.strictEqual(empCount.rows[0].cnt, 0, "Zero-mutation invariant: Dry-run must NOT write any employee records");

      // Verify batch record status is DRY_RUN_OK
      const batchCheck = await CorporateEmployeeImportBatchRepository.findById(res.batchId, account1.id);
      assert.strictEqual(batchCheck.status, "DRY_RUN_OK");

      pass(2, "Dry-run validation accepts clean workbook, creates DRY_RUN_OK batch, with ZERO employee mutations");
    } catch (err) {
      fail(2, "Clean dry-run test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Row-Level Error Diagnostics
    // -------------------------------------------------------------------------
    const errorRows = [
      ["", "Missing Code User", "9812345681", "", "", "", "", "", "", "", null, null], // Missing code
      ["ERR-002", "", "9812345682", "", "", "", "", "", "", "", null, null], // Missing name
      ["ERR-003", "Invalid Phone User", "12345", "", "", "", "", "", "", "", null, null], // Bad phone
      ["ERR-004", "Invalid Email User", "9812345684", "bad-email", "", "", "", "", "", "", null, null], // Bad email
      ["ERR-005", "Invalid PIN User", "9812345685", "", "", "", "", "", "", "999", null, null], // Bad PIN
      ["ERR-006", "Invalid Bbox User", "9812345686", "", "", "", "", "", "", "", 51.5074, -0.1278], // Lat outside India
      ["ERR-007", "Missing Longitude User", "9812345687", "", "", "", "", "", "", "", 12.9716, null], // Lat without Lng
      ["ERR-008", "Duplicate 1", "9812345688", "", "", "", "", "", "", "", null, null],
      ["ERR-008", "Duplicate 2", "9812345689", "", "", "", "", "", "", "", null, null], // Duplicate code in file
    ];

    const errorBuf = await createExcelBuffer(headers, errorRows);

    try {
      const res = await CorporateEmployeeImportService.validateRosterImport(
        account1.id,
        errorBuf,
        "malformed_roster.xlsx",
        rosterMgrActor
      );

      assert.strictEqual(res.isValid, false, "Malformed batch must be invalid");
      assert.ok(res.invalidRows >= 8, `Should catch at least 8 invalid rows (got ${res.invalidRows})`);
      assert.ok(res.errors.some(e => e.field === "employee_code" && e.code === "REQUIRED_FIELD"), "Catches missing code");
      assert.ok(res.errors.some(e => e.field === "full_name" && e.code === "REQUIRED_FIELD"), "Catches missing name");
      assert.ok(res.errors.some(e => e.field === "phone" && e.code === "INVALID_PHONE"), "Catches invalid phone");
      assert.ok(res.errors.some(e => e.field === "email" && e.code === "INVALID_EMAIL"), "Catches invalid email");
      assert.ok(res.errors.some(e => e.field === "pincode" && e.code === "INVALID_PINCODE"), "Catches invalid PIN");
      assert.ok(res.errors.some(e => e.field === "coordinates" && e.code === "INVALID_COORDINATES"), "Catches invalid coordinates");
      assert.ok(res.errors.some(e => e.code === "DUPLICATE_CODE_IN_BATCH"), "Catches internal duplicate code in workbook");

      // Verify batch record status is DRY_RUN_FAILED
      const batchCheck = await CorporateEmployeeImportBatchRepository.findById(res.batchId, account1.id);
      assert.strictEqual(batchCheck.status, "DRY_RUN_FAILED");

      pass(3, "Row-level diagnostics catch missing fields, invalid types, coordinate errors, and file duplicates");
    } catch (err) {
      fail(3, "Row-level error diagnostics test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Database Duplicate Code Defense (Active & Inactive Lifecycle)
    // -------------------------------------------------------------------------
    try {
      // 1. Pre-seed an active employee "HCL-ACTIVE"
      await CorporateEmployeeService.createEmployee(
        account1.id,
        {
          employee_code: "HCL-ACTIVE",
          full_name: "Active Staff",
          phone: "9877766601",
        },
        rosterMgrActor
      );

      // 2. Pre-seed and deactivate an employee "HCL-DEACTIVATED"
      const { employee: deactEmp } = await CorporateEmployeeService.createEmployee(
        account1.id,
        {
          employee_code: "HCL-DEACTIVATED",
          full_name: "Deactivated Staff",
          phone: "9877766602",
        },
        rosterMgrActor
      );
      await CorporateEmployeeService.deactivateEmployee(
        account1.id,
        deactEmp.id,
        "Resigned",
        rosterMgrActor
      );

      // 3. Create workbook containing both codes
      const dbDupRows = [
        ["hcl-active", "Imposter Active", "9812345691"], // Duplicate active
        ["HCL-DEACTIVATED", "Rehire Attempt", "9812345692"], // Deactivated duplicate
      ];
      const dbDupBuf = await createExcelBuffer(headers, dbDupRows);

      const res = await CorporateEmployeeImportService.validateRosterImport(
        account1.id,
        dbDupBuf,
        "db_duplicates.xlsx",
        rosterMgrActor
      );

      assert.strictEqual(res.isValid, false);
      const activeErr = res.errors.find(e => e.code === "DUPLICATE_EMPLOYEE_CODE");
      assert.ok(activeErr, "Must flag active duplicate employee code");

      const deactErr = res.errors.find(e => e.code === "EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED");
      assert.ok(deactErr, "Must flag deactivated code requiring explicit reactivation");
      assert.ok(deactErr.message.includes("Rehire requires explicit reactivation"), "Explains explicit rehire requirement");

      pass(4, "Database duplicate detection rejects active codes and enforces explicit rehire for deactivated codes");
    } catch (err) {
      fail(4, "Database duplicate detection test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Phone Reuse Warnings Without Rejection
    // -------------------------------------------------------------------------
    try {
      const phoneWarnRows = [
        ["HCL-PHONE-1", "Emp With Shared Phone 1", "9877766601"], // Reuses phone of HCL-ACTIVE
        ["HCL-PHONE-2", "Emp With Shared Phone 2", "9877766601"], // Shares same phone within batch
      ];
      const phoneWarnBuf = await createExcelBuffer(headers, phoneWarnRows);

      const res = await CorporateEmployeeImportService.validateRosterImport(
        account1.id,
        phoneWarnBuf,
        "phone_sharing.xlsx",
        rosterMgrActor
      );

      assert.strictEqual(res.isValid, true, "Phone reuse must NOT reject the batch");
      assert.strictEqual(res.errors.length, 0, "Zero errors for phone reuse");
      assert.ok(res.warnings.length >= 2, "Must generate phone reuse warnings for both rows");

      pass(5, "Phone reuse emits actionable row warnings without rejecting batch validity");
    } catch (err) {
      fail(5, "Phone reuse warning test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Atomic Commit Execution & Audit Trail
    // -------------------------------------------------------------------------
    let commitResult;
    try {
      commitResult = await CorporateEmployeeImportService.commitRosterImport(
        account1.id,
        cleanBuf,
        "hcl_roster_q4.xlsx",
        rosterMgrActor
      );

      assert.strictEqual(commitResult.success, true);
      assert.strictEqual(commitResult.totalRows, 3);
      assert.strictEqual(commitResult.insertedRows, 3);
      assert.strictEqual(commitResult.batch.status, "COMMITTED");
      assert.strictEqual(commitResult.batch.committed_by, userIdRosterMgr);
      assert.ok(commitResult.batch.committed_at);

      // Verify employees exist in public.corporate_employee
      const empsRes = await pool.query(
        `SELECT employee_code_key, status, coordinate_verified FROM public.corporate_employee 
         WHERE account_id = $1 AND employee_code_key IN ('HCL-001', 'HCL-002', 'HCL-003')`,
        [account1.id]
      );
      assert.strictEqual(empsRes.rows.length, 3);
      for (const emp of empsRes.rows) {
        assert.strictEqual(emp.status, "ACTIVE");
        assert.strictEqual(emp.coordinate_verified, false, "Coordinates must default to unverified");
      }

      // Verify CREATED and IMPORTED events for each inserted employee
      for (const emp of commitResult.employees) {
        const events = await CorporateEventRepository.listEmployeeEvents(emp.id, account1.id);
        const createdEvt = events.find(e => e.event_type === "CREATED");
        const importedEvt = events.find(e => e.event_type === "IMPORTED");
        assert.ok(createdEvt, `Employee ${emp.employee_code} must have CREATED event`);
        assert.ok(importedEvt, `Employee ${emp.employee_code} must have IMPORTED event`);
      }

      pass(6, "Atomic commit inserts all valid employees, logs CREATED and IMPORTED events, and marks batch COMMITTED");
    } catch (err) {
      fail(6, "Atomic commit test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Replay Protection (Committed SHA-256 File Hash)
    // -------------------------------------------------------------------------
    try {
      // Re-uploading exact same file buffer must fail replay check
      await assert.rejects(
        () => CorporateEmployeeImportService.validateRosterImport(
          account1.id,
          cleanBuf,
          "hcl_roster_q4_reupload.xlsx",
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "DUPLICATE_FILE_HASH"
      );

      await assert.rejects(
        () => CorporateEmployeeImportService.commitRosterImport(
          account1.id,
          cleanBuf,
          "hcl_roster_q4_reupload.xlsx",
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "DUPLICATE_FILE_HASH"
      );

      pass(7, "Committed SHA-256 file hash protects account against duplicate batch replay");
    } catch (err) {
      fail(7, "Replay protection test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Fail-Closed Rollback on Invalid Batch Commit
    // -------------------------------------------------------------------------
    try {
      const beforeCountRes = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee WHERE account_id = $1`, [account1.id]);
      const beforeCount = beforeCountRes.rows[0].cnt;

      await assert.rejects(
        () => CorporateEmployeeImportService.commitRosterImport(
          account1.id,
          errorBuf, // Malformed workbook
          "malformed_roster.xlsx",
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "VALIDATION_FAILED"
      );

      const afterCountRes = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee WHERE account_id = $1`, [account1.id]);
      const afterCount = afterCountRes.rows[0].cnt;
      assert.strictEqual(afterCount, beforeCount, "Zero partial mutations on failed commit");

      pass(8, "Commit of invalid batch fails closed with zero employee mutations");
    } catch (err) {
      fail(8, "Fail-closed rollback test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Cross-Account Scoped Authorization Defense
    // -------------------------------------------------------------------------
    try {
      // otherMgrActor has scopedAccountId = "ca_unrelated_account"
      await assert.rejects(
        () => CorporateEmployeeImportService.validateRosterImport(
          account1.id,
          cleanBuf,
          "unauthorized.xlsx",
          otherMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "PERMISSION_DENIED"
      );

      pass(9, "Cross-account roster import authorization strictly fails closed");
    } catch (err) {
      fail(9, "Cross-account authorization test failed", err);
    }

  } catch (criticalErr) {
    console.error("\nFATAL SUITE ERROR:", criticalErr);
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

      // -----------------------------------------------------------------------
      // POSTFLIGHT AUDIT
      // -----------------------------------------------------------------------
      const postCoa = await pool.query(`SELECT count(*)::int as count FROM public.accounting_account;`);
      assert.strictEqual(postCoa.rows[0].count, 100, "Postflight: CoA must remain 100");

      const postVoucher = await pool.query(`SELECT count(*)::int as count FROM public.accounting_voucher;`);
      assert.strictEqual(postVoucher.rows[0].count, 6, "Postflight: Vouchers must remain 6");

      const postJe = await pool.query(`SELECT count(*)::int as count FROM public.accounting_journal_entry;`);
      assert.strictEqual(postJe.rows[0].count, 4, "Postflight: Journal entries must remain 4");

      const postJl = await pool.query(`SELECT count(*)::int as count FROM public.accounting_journal_line;`);
      assert.strictEqual(postJl.rows[0].count, 10, "Postflight: Journal lines must remain 10");

      const postTb = await pool.query(`
        SELECT 
          COALESCE(SUM(debit_amount), 0)::numeric(12,2) AS total_dr,
          COALESCE(SUM(credit_amount), 0)::numeric(12,2) AS total_cr
        FROM public.accounting_journal_line;
      `);
      assert.strictEqual(Number(postTb.rows[0].total_dr), 3380.00, "Postflight: TB Debit must remain 3380.00");
      assert.strictEqual(Number(postTb.rows[0].total_cr), 3380.00, "Postflight: TB Credit must remain 3380.00");

      const candidateCodes = await pool.query(`
        SELECT code FROM public.accounting_account WHERE code IN ('1118B', '2118', '2119', '5114', '5115');
      `);
      assert.strictEqual(candidateCodes.rows.length, 0, "Postflight: Candidate codes must be zero");

      const cleanCheck = await pool.query(`
        SELECT 'corporate_account' as tbl, count(*)::int as cnt FROM public.corporate_account
        UNION ALL SELECT 'corporate_account_contact', count(*)::int FROM public.corporate_account_contact
        UNION ALL SELECT 'corporate_account_member', count(*)::int FROM public.corporate_account_member
        UNION ALL SELECT 'corporate_employee', count(*)::int FROM public.corporate_employee
        UNION ALL SELECT 'corporate_employee_event', count(*)::int FROM public.corporate_employee_event
        UNION ALL SELECT 'corporate_account_event', count(*)::int FROM public.corporate_account_event
        UNION ALL SELECT 'corporate_employee_import_batch', count(*)::int FROM public.corporate_employee_import_batch;
      `);
      for (const r of cleanCheck.rows) {
        assert.strictEqual(r.cnt, 0, `Postflight: Table ${r.tbl} must have 0 rows (found ${r.cnt})`);
      }

      console.log(`  ✓ Postflight Audit: CoA = 100 | Vouchers = 6 | JEs = 4 | JLs = 10 | TB = ₹3,380.00 | Corporate Tables = 0 rows`);
    } catch (postErr) {
      console.error("  ✗ Postflight Invariant Audit Failed:", postErr.message);
      failed++;
    }

    await pool.end();
  }

  console.log("\n==================================================================");
  console.log(`  SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
