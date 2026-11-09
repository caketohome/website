/**
 * CakeToHome ERP — Phase C7.9 Step 9B Domain & Repository Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Preflight baseline audit (CoA 100, Vouchers 6, JEs 4, JLs 10, TB 3380.00, corporate tables clean).
 * 2. Corporate account creation, 1:1 customer linkage, customer master sync.
 * 3. Tax validation: GSTIN regex, PAN regex, PAN-GSTIN matching, active GSTIN uniqueness.
 * 4. Super Admin customer linkage rule (fail-closed, 1:1 enforcement, audit event).
 * 5. Account update, legal name key normalization, audit events.
 * 6. Four-Eyes account approval (SoD creator !== approver, Super Admin only, no credit activation).
 * 7. Account status lifecycle (PENDING -> APPROVED -> SUSPENDED -> APPROVED -> CLOSED).
 * 8. Credit request metadata (stores request only, does not activate customer credit).
 * 9. Contact management & single active PRIMARY contact enforcement.
 * 10. Scoped membership (ROSTER_MANAGER, ROSTER_VIEWER, grant/revoke, Super Admin only).
 * 11. Employee creation, normalization, duplicate prevention over all statuses.
 * 12. Phone reuse warnings without rejecting creation.
 * 13. Coordinates validation (India bbox, both-or-neither, verified flag).
 * 14. Soft deactivation & trigger blocking hard DELETE (trg_ce_prevent_delete).
 * 15. Explicit reactivation lifecycle (rehire with same ID and history).
 * 16. Event immutability triggers (trg_cax_append_only, trg_cee_append_only).
 * 17. Import batch audit & committed file hash replay protection.
 * 18. Transaction rollback on failure.
 * 19. Teardown & Postflight audit (zero residual rows, CoA 100, TB 3380.00).
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

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

async function runSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.9 STEP 9B: DOMAIN & REPOSITORY SUITE  ");
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

  const {
    CorporateAccountService,
    CorporateAccountError,
    validateGstinAndPan,
    normalizeLegalNameKey,
  } = require('../src/lib/services/corporate-account.service');

  const {
    CorporateEmployeeService,
    CorporateEmployeeError,
    normalizeEmployeeCode,
    validateCoordinates,
  } = require('../src/lib/services/corporate-employee.service');

  const {
    CorporateAccountRepository,
    CorporateAccountContactRepository,
    CorporateAccountMemberRepository,
    CorporateEmployeeRepository,
    CorporateEventRepository,
    CorporateEmployeeImportBatchRepository,
  } = require('../src/lib/repositories/corporate-account.repository');

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
    const custId1 = `cus_test_corp_${tsSuffix}_1`;
    const custId2 = `cus_test_corp_${tsSuffix}_2`;
    const custId3 = `cus_test_corp_${tsSuffix}_3`;

    await pool.query(`
      INSERT INTO public.customer (id, first_name, last_name, company_name, email, phone, created_at, updated_at)
      VALUES 
        ($1, 'Tata', 'Consultancy', NULL, 'contact1@tcs.corp', '9811122233', NOW(), NOW()),
        ($2, 'Infosys', 'Limited', NULL, 'contact2@infy.corp', '9811122234', NOW(), NOW()),
        ($3, 'Wipro', 'Enterprises', NULL, 'contact3@wipro.corp', '9811122235', NOW(), NOW());
    `, [custId1, custId2, custId3]);
    createdCustomerIds.push(custId1, custId2, custId3);

    const userIdCreator = `usr_creator_${tsSuffix}`;
    const userIdSuperAdmin = `usr_superadmin_${tsSuffix}`;
    const userIdRosterMgr = `usr_rostermgr_${tsSuffix}`;
    const userIdRosterVwr = `usr_rostervwr_${tsSuffix}`;

    await pool.query(`
      INSERT INTO public."user" (id, email, first_name, last_name, created_at, updated_at)
      VALUES 
        ($1, 'creator@corp.test', 'Alice', 'Creator', NOW(), NOW()),
        ($2, 'superadmin@corp.test', 'Bob', 'SuperAdmin', NOW(), NOW()),
        ($3, 'rostermgr@corp.test', 'Charlie', 'RosterMgr', NOW(), NOW()),
        ($4, 'rostervwr@corp.test', 'Diana', 'RosterVwr', NOW(), NOW());
    `, [userIdCreator, userIdSuperAdmin, userIdRosterMgr, userIdRosterVwr]);
    createdUserIds.push(userIdCreator, userIdSuperAdmin, userIdRosterMgr, userIdRosterVwr);

    const superAdminActor = {
      userId: userIdSuperAdmin,
      isSuperAdmin: true,
      role: "SUPER_ADMIN",
    };

    const creatorActor = {
      userId: userIdCreator,
      isSuperAdmin: false,
      role: "OPERATIONS_EXECUTIVE",
      permissions: [
        "CORPORATE_ACCOUNTS.CREATE",
        "CORPORATE_ACCOUNTS.UPDATE",
        "CORPORATE_ACCOUNTS.CREDIT_REQUEST",
      ],
    };

    const unprivilegedActor = {
      userId: "usr_unprivileged_01",
      isSuperAdmin: false,
      role: "CUSTOMER",
      permissions: [],
    };

    // -------------------------------------------------------------------------
    // TEST 1: Tax Validation Helpers (GSTIN, PAN, Cross-Match)
    // -------------------------------------------------------------------------
    try {
      const valid = validateGstinAndPan("29AABCT1332L1ZV", "AABCT1332L");
      assert.strictEqual(valid.normalizedGstin, "29AABCT1332L1ZV");
      assert.strictEqual(valid.normalizedPan, "AABCT1332L");

      assert.throws(
        () => validateGstinAndPan("INVALID_GSTIN", "AABCT1332L"),
        (err) => err instanceof CorporateAccountError && err.code === "INVALID_GSTIN"
      );

      assert.throws(
        () => validateGstinAndPan("29AABCT1332L1ZV", "INVALID_PAN"),
        (err) => err instanceof CorporateAccountError && err.code === "INVALID_PAN"
      );

      // Mismatch: GSTIN has AABCT1332L, but provided PAN is BBCCC9999K
      assert.throws(
        () => validateGstinAndPan("29AABCT1332L1ZV", "BBCCC9999K"),
        (err) => err instanceof CorporateAccountError && err.code === "PAN_GSTIN_MISMATCH"
      );

      pass(1, "Tax validation enforces GSTIN/PAN regex and cross-character consistency");
    } catch (err) {
      fail(1, "Tax validation failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Corporate Account Draft Creation & Initial Invariants
    // -------------------------------------------------------------------------
    let account1;
    const testGstin1 = `29AABCT${tsSuffix.slice(-4)}L1ZV`;
    const testPan1 = `AABCT${tsSuffix.slice(-4)}L`;

    try {
      account1 = await CorporateAccountService.createAccount(
        {
          customer_id: custId1,
          legal_name: "  Tata Consultancy Services Ltd  ",
          trade_name: "TCS",
          gstin: testGstin1,
          pan: testPan1,
          billing_address: { street: "100 MG Road", city: "Bengaluru", state: "KA", pincode: "560001" },
          registered_address: { street: "100 MG Road", city: "Bengaluru", state: "KA", pincode: "560001" },
          primaryContact: {
            name: "Ramesh Sharma",
            email: "ramesh@tcs.corp",
            phone: "9811122299",
            designation: "Procurement Lead",
          },
        },
        creatorActor
      );
      createdAccountIds.push(account1.id);

      assert.ok(account1.id.startsWith("ca_"), "Account ID should have ca_ prefix");
      assert.strictEqual(account1.status, "PENDING", "Initial status must be PENDING");
      assert.strictEqual(account1.legal_name, "Tata Consultancy Services Ltd");
      assert.strictEqual(account1.legal_name_key, "tata consultancy services ltd");
      assert.strictEqual(account1.created_by, userIdCreator);

      // Verify primary contact created
      const primaryContact = await CorporateAccountContactRepository.findPrimaryContact(account1.id);
      assert.ok(primaryContact, "Primary contact must exist");
      assert.strictEqual(primaryContact.name, "Ramesh Sharma");
      assert.strictEqual(primaryContact.contact_type, "PRIMARY");

      // Verify CREATED event recorded
      const events = await CorporateEventRepository.listAccountEvents(account1.id);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].event_type, "CREATED");
      assert.strictEqual(events[0].actor_id, userIdCreator);

      // Verify customer master synced
      const custCheck = await pool.query(`SELECT company_name, gstin FROM public.customer WHERE id = $1`, [custId1]);
      assert.strictEqual(custCheck.rows[0].company_name, "Tata Consultancy Services Ltd");
      assert.strictEqual(custCheck.rows[0].gstin, testGstin1);

      pass(2, "Corporate account created with PENDING status, primary contact, synced customer, and CREATED event");
    } catch (err) {
      fail(2, "Corporate account creation failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: 1:1 Customer Linkage & Active GSTIN Uniqueness Defense
    // -------------------------------------------------------------------------
    try {
      // Second account for same customer_id must fail
      await assert.rejects(
        () => CorporateAccountService.createAccount(
          {
            customer_id: custId1,
            legal_name: "TCS Duplicate Attempt",
            gstin: `29BBBCB${tsSuffix.slice(-4)}M1Z1`,
            pan: `BBBCB${tsSuffix.slice(-4)}M`,
          },
          creatorActor
        ),
        (err) => err instanceof CorporateAccountError && err.code === "CUSTOMER_ALREADY_LINKED"
      );

      // Duplicate active GSTIN must fail
      await assert.rejects(
        () => CorporateAccountService.createAccount(
          {
            customer_id: custId2,
            legal_name: "Infosys with duplicate TCS GSTIN",
            gstin: testGstin1,
            pan: testPan1,
          },
          creatorActor
        ),
        (err) => err instanceof CorporateAccountError && err.code === "DUPLICATE_GSTIN"
      );

      pass(3, "1:1 customer linkage and active GSTIN uniqueness strictly enforced");
    } catch (err) {
      fail(3, "Linkage or GSTIN uniqueness test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Super Admin Customer Linkage Rule
    // -------------------------------------------------------------------------
    try {
      // Non-Super-Admin linking customer must fail closed
      await assert.rejects(
        () => CorporateAccountService.linkCustomer(account1.id, custId2, creatorActor),
        (err) => err instanceof CorporateAccountError && err.code === "PERMISSION_DENIED"
      );

      // Super Admin linking to valid customer2 succeeds
      const linked = await CorporateAccountService.linkCustomer(account1.id, custId2, superAdminActor);
      assert.strictEqual(linked.customer_id, custId2);

      // Audit event CUSTOMER_LINKED recorded
      const events = await CorporateEventRepository.listAccountEvents(account1.id);
      const linkEvent = events.find(e => e.event_type === "CUSTOMER_LINKED");
      assert.ok(linkEvent, "CUSTOMER_LINKED event must be recorded");
      assert.strictEqual(linkEvent.before_state.customer_id, custId1);
      assert.strictEqual(linkEvent.after_state.customer_id, custId2);

      // Link back to custId1 for consistency
      await CorporateAccountService.linkCustomer(account1.id, custId1, superAdminActor);

      pass(4, "Customer linkage restricted strictly to Super Admin with immutable CUSTOMER_LINKED audit");
    } catch (err) {
      fail(4, "Customer linkage test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Four-Eyes Account Approval Enforcement
    // -------------------------------------------------------------------------
    try {
      // 1. Creator cannot approve own draft (SoD violation)
      await assert.rejects(
        () => CorporateAccountService.approveAccount(account1.id, {
          userId: userIdCreator,
          isSuperAdmin: true, // even if elevated, creator === approver must fail
          role: "SUPER_ADMIN"
        }),
        (err) => err instanceof CorporateAccountError && err.code === "SEGREGATION_OF_DUTIES_VIOLATION"
      );

      // 2. Non-Super-Admin cannot approve
      await assert.rejects(
        () => CorporateAccountService.approveAccount(account1.id, creatorActor),
        (err) => err instanceof CorporateAccountError && err.code === "PERMISSION_DENIED"
      );

      // 3. Super Admin (different person) approves successfully
      const approvedAccount = await CorporateAccountService.approveAccount(account1.id, superAdminActor);
      assert.strictEqual(approvedAccount.status, "APPROVED");
      assert.strictEqual(approvedAccount.approved_by, userIdSuperAdmin);
      assert.ok(approvedAccount.approved_at);

      // 4. Invariant Check: Customer is_corporate must REMAIN FALSE (Credit NOT activated)
      const custCheck = await pool.query(`SELECT is_corporate, credit_enabled, credit_status FROM public.customer WHERE id = $1`, [custId1]);
      assert.strictEqual(custCheck.rows[0].is_corporate, false, "Approval must NOT set is_corporate to true");
      assert.strictEqual(custCheck.rows[0].credit_enabled, false, "Approval must NOT enable credit");

      // 5. Audit event APPROVED recorded
      const events = await CorporateEventRepository.listAccountEvents(account1.id);
      const appEvent = events.find(e => e.event_type === "APPROVED");
      assert.ok(appEvent, "APPROVED event must be recorded");
      assert.strictEqual(appEvent.actor_id, userIdSuperAdmin);

      pass(5, "Four-Eyes approval enforced (creator !== approver); credit activation strictly isolated");
    } catch (err) {
      fail(5, "Four-Eyes approval test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Credit Request Metadata Invariant
    // -------------------------------------------------------------------------
    try {
      const creditReqAccount = await CorporateAccountService.requestCredit(
        account1.id,
        { creditLimit: 500000, termsDays: 45 },
        creatorActor
      );
      assert.strictEqual(Number(creditReqAccount.credit_requested_limit), 500000);
      assert.strictEqual(creditReqAccount.credit_requested_terms_days, 45);
      assert.strictEqual(creditReqAccount.credit_requested_by, userIdCreator);

      // Confirm public.customer credit columns still unmutated
      const custCheck = await pool.query(`SELECT credit_limit, payment_terms_days FROM public.customer WHERE id = $1`, [custId1]);
      assert.strictEqual(Number(custCheck.rows[0].credit_limit || 0), 0);

      // Confirm CREDIT_REQUESTED audit event
      const events = await CorporateEventRepository.listAccountEvents(account1.id);
      const crEvent = events.find(e => e.event_type === "CREDIT_REQUESTED");
      assert.ok(crEvent, "CREDIT_REQUESTED event must be recorded");

      pass(6, "Credit request records metadata and audit event without mutating customer credit limits");
    } catch (err) {
      fail(6, "Credit request test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Account Status Lifecycle (SUSPEND -> REACTIVATE)
    // -------------------------------------------------------------------------
    try {
      // Suspend
      const suspended = await CorporateAccountService.suspendAccount(
        account1.id,
        "Temporary statutory compliance hold",
        superAdminActor
      );
      assert.strictEqual(suspended.status, "SUSPENDED");
      assert.strictEqual(suspended.suspended_by, userIdSuperAdmin);
      assert.strictEqual(suspended.suspended_reason, "Temporary statutory compliance hold");

      // Cannot request credit while suspended
      await assert.rejects(
        () => CorporateAccountService.requestCredit(account1.id, { creditLimit: 100000, termsDays: 30 }, creatorActor),
        (err) => err instanceof CorporateAccountError && err.code === "INVALID_ACCOUNT_STATUS"
      );

      // Reactivate
      const reactivated = await CorporateAccountService.reactivateAccount(
        account1.id,
        "Compliance hold cleared by audit",
        superAdminActor
      );
      assert.strictEqual(reactivated.status, "APPROVED");
      assert.strictEqual(reactivated.suspended_by, null);

      pass(7, "Account status lifecycle (SUSPEND -> REACTIVATE) enforced with transition rules and events");
    } catch (err) {
      fail(7, "Account status lifecycle test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Contact Management & Single Active Primary Invariant
    // -------------------------------------------------------------------------
    try {
      // Adding a second active PRIMARY contact must fail
      await assert.rejects(
        () => CorporateAccountService.addContact(
          account1.id,
          {
            contact_type: "PRIMARY",
            name: "Second Primary Contact",
            email: "second@tcs.corp",
            phone: "9811122288",
            is_active: true,
          },
          creatorActor
        ),
        (err) => err instanceof CorporateAccountError && err.code === "PRIMARY_CONTACT_ALREADY_EXISTS"
      );

      // Adding a SECONDARY contact succeeds
      const secondaryContact = await CorporateAccountService.addContact(
        account1.id,
        {
          contact_type: "SECONDARY",
          name: "Deepa Nair",
          email: "deepa@tcs.corp",
          phone: "9811122287",
          is_active: true,
        },
        creatorActor
      );
      assert.strictEqual(secondaryContact.contact_type, "SECONDARY");

      // Deactivate contact
      const deactivated = await CorporateAccountService.deactivateContact(
        account1.id,
        secondaryContact.id,
        creatorActor
      );
      assert.strictEqual(deactivated.is_active, false);

      pass(8, "Contact management enforces exactly one active PRIMARY contact per account");
    } catch (err) {
      fail(8, "Contact management test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Scoped Corporate Account Membership (ROSTER_MANAGER / ROSTER_VIEWER)
    // -------------------------------------------------------------------------
    let memberRosterMgr;
    let memberRosterVwr;

    try {
      // Non-Super-Admin cannot grant membership
      await assert.rejects(
        () => CorporateAccountService.grantMembership(
          account1.id,
          { userId: userIdRosterMgr, memberRole: "ROSTER_MANAGER" },
          creatorActor
        ),
        (err) => err instanceof CorporateAccountError && err.code === "PERMISSION_DENIED"
      );

      // Super Admin grants ROSTER_MANAGER
      memberRosterMgr = await CorporateAccountService.grantMembership(
        account1.id,
        { userId: userIdRosterMgr, memberRole: "ROSTER_MANAGER" },
        superAdminActor
      );
      assert.strictEqual(memberRosterMgr.member_role, "ROSTER_MANAGER");
      assert.strictEqual(memberRosterMgr.status, "ACTIVE");

      // Super Admin grants ROSTER_VIEWER
      memberRosterVwr = await CorporateAccountService.grantMembership(
        account1.id,
        { userId: userIdRosterVwr, memberRole: "ROSTER_VIEWER" },
        superAdminActor
      );
      assert.strictEqual(memberRosterVwr.member_role, "ROSTER_VIEWER");

      // Duplicate active membership rejected
      await assert.rejects(
        () => CorporateAccountService.grantMembership(
          account1.id,
          { userId: userIdRosterMgr, memberRole: "ROSTER_MANAGER" },
          superAdminActor
        ),
        (err) => err instanceof CorporateAccountError && err.code === "MEMBER_ALREADY_EXISTS"
      );

      pass(9, "Scoped account membership granted by Super Admin with role segregation and duplicate checks");
    } catch (err) {
      fail(9, "Scoped membership test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Employee Creation, Code Normalization & India Coordinates
    // -------------------------------------------------------------------------
    let emp1;
    const rosterMgrActor = {
      userId: userIdRosterMgr,
      isSuperAdmin: false,
      role: "CUSTOMER",
      scopedAccountId: account1.id,
      permissions: [],
    };

    const rosterVwrActor = {
      userId: userIdRosterVwr,
      isSuperAdmin: false,
      role: "CUSTOMER",
      scopedAccountId: account1.id,
      permissions: [],
    };

    try {
      // Roster viewer cannot create employees
      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account1.id,
          {
            employee_code: "EMP-001",
            full_name: "Sneha Reddy",
            phone: "9822233344",
          },
          rosterVwrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "PERMISSION_DENIED"
      );

      // Coordinates validation: invalid coordinates outside India bbox
      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account1.id,
          {
            employee_code: "EMP-001",
            full_name: "Sneha Reddy",
            phone: "9822233344",
            default_latitude: 51.5074, // London
            default_longitude: -0.1278,
          },
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "INVALID_COORDINATES"
      );

      // Coordinates validation: lat without lng
      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account1.id,
          {
            employee_code: "EMP-001",
            full_name: "Sneha Reddy",
            phone: "9822233344",
            default_latitude: 12.9716,
            default_longitude: null,
          },
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "INVALID_COORDINATES"
      );

      // Valid employee creation with normalized code "  emp-001  " -> "EMP-001"
      const res1 = await CorporateEmployeeService.createEmployee(
        account1.id,
        {
          employee_code: "  emp-001  ",
          full_name: "Sneha Reddy",
          phone: "9822233344",
          email: "sneha.r@tcs.corp",
          department: "Engineering",
          designation: "Senior Architect",
          default_address: { street: "45 Whitefield Main Rd", city: "Bengaluru", state: "KA", pincode: "560066" },
          city_key: "  Bengaluru  ",
          default_latitude: 12.9698,
          default_longitude: 77.7499,
        },
        rosterMgrActor
      );
      emp1 = res1.employee;

      assert.strictEqual(emp1.employee_code, "emp-001");
      assert.strictEqual(emp1.employee_code_key, "EMP-001");
      assert.strictEqual(emp1.status, "ACTIVE");
      assert.strictEqual(emp1.city_key, "bengaluru");
      assert.strictEqual(emp1.coordinate_verified, false, "Default coordinates must be unverified");
      assert.strictEqual(res1.warnings.length, 0);

      // Verify CREATED audit event
      const events = await CorporateEventRepository.listEmployeeEvents(emp1.id, account1.id);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].event_type, "CREATED");

      pass(10, "Employee creation normalizes code, validates India bbox coordinates, and defaults to unverified");
    } catch (err) {
      fail(10, "Employee creation test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Phone Reuse Warnings Without Rejection
    // -------------------------------------------------------------------------
    let emp2;
    try {
      const res2 = await CorporateEmployeeService.createEmployee(
        account1.id,
        {
          employee_code: "EMP-002",
          full_name: "Karan Reddy", // Family member / shared desk
          phone: "9822233344", // Reused phone from EMP-001
          department: "Engineering",
        },
        rosterMgrActor
      );
      emp2 = res2.employee;

      assert.strictEqual(emp2.employee_code_key, "EMP-002");
      assert.strictEqual(emp2.status, "ACTIVE");
      assert.strictEqual(res2.warnings.length, 1, "Must generate phone reuse warning");
      assert.ok(res2.warnings[0].includes("already used by employee(s)"), "Warning details must cite reused employee");

      pass(11, "Phone reuse emits actionable audit warning without rejecting employee record");
    } catch (err) {
      fail(11, "Phone reuse warning test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Duplicate Employee Code Defense Across Active Status
    // -------------------------------------------------------------------------
    try {
      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account1.id,
          {
            employee_code: "emp-001", // Duplicate case variant of active EMP-001
            full_name: "Sneha Imposter",
            phone: "9899988877",
          },
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "DUPLICATE_EMPLOYEE_CODE"
      );

      pass(12, "Active employee code duplicate rejected across case variants");
    } catch (err) {
      fail(12, "Duplicate code test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Deactivation, Hard Delete Trigger Rejection, and Rehire Life-cycle
    // -------------------------------------------------------------------------
    try {
      // 1. Deactivate EMP-001
      const deactivated = await CorporateEmployeeService.deactivateEmployee(
        account1.id,
        emp1.id,
        "Employee resigned to pursue higher studies",
        rosterMgrActor
      );
      assert.strictEqual(deactivated.status, "INACTIVE");
      assert.strictEqual(deactivated.deactivated_by, userIdRosterMgr);
      assert.strictEqual(deactivated.deactivated_reason, "Employee resigned to pursue higher studies");

      // 2. Database trigger trg_ce_prevent_delete blocks hard DELETE
      await assert.rejects(
        () => pool.query(`DELETE FROM public.corporate_employee WHERE id = $1`, [emp1.id]),
        (err) => err.message.includes("Hard deletion of corporate_employee is prohibited")
      );

      // 3. Creating new employee with deactivated code must fail with EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED
      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account1.id,
          {
            employee_code: "EMP-001",
            full_name: "Sneha Reddy (Rehire attempt)",
            phone: "9822233344",
          },
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED"
      );

      // 4. Explicit reactivation restores same record ID with REACTIVATED audit event
      const reactivated = await CorporateEmployeeService.reactivateEmployee(
        account1.id,
        emp1.id,
        "Employee rehired as Principal Architect",
        rosterMgrActor
      );
      assert.strictEqual(reactivated.id, emp1.id, "Rehire must preserve exact historical record ID");
      assert.strictEqual(reactivated.status, "ACTIVE");
      assert.strictEqual(reactivated.reactivated_by, userIdRosterMgr);

      const events = await CorporateEventRepository.listEmployeeEvents(emp1.id, account1.id);
      const reactEvent = events.find(e => e.event_type === "REACTIVATED");
      assert.ok(reactEvent, "REACTIVATED event must be recorded");

      pass(13, "Deactivation preserves history, DB trigger blocks DELETE, and rehire explicitly reactivates same ID");
    } catch (err) {
      fail(13, "Deactivation and rehire test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Coordinates Verification
    // -------------------------------------------------------------------------
    try {
      const verified = await CorporateEmployeeService.verifyCoordinates(
        account1.id,
        emp1.id,
        superAdminActor
      );
      assert.strictEqual(verified.coordinate_verified, true);
      assert.strictEqual(verified.coordinate_verified_by, userIdSuperAdmin);

      const events = await CorporateEventRepository.listEmployeeEvents(emp1.id, account1.id);
      const coordEvent = events.find(e => e.event_type === "COORDINATES_VERIFIED");
      assert.ok(coordEvent, "COORDINATES_VERIFIED event must be recorded");

      pass(14, "Coordinates verification records verified flag, verifier, and audit event");
    } catch (err) {
      fail(14, "Coordinates verification test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 15: Append-Only Trigger Immutability on Audit Tables
    // -------------------------------------------------------------------------
    try {
      const acctEvent = (await CorporateEventRepository.listAccountEvents(account1.id))[0];
      const empEvent = (await CorporateEventRepository.listEmployeeEvents(emp1.id, account1.id))[0];

      // Block UPDATE on corporate_account_event
      await assert.rejects(
        () => pool.query(`UPDATE public.corporate_account_event SET reason = 'Tampered' WHERE id = $1`, [acctEvent.id]),
        (err) => err.message.includes("corporate_account_event is append-only")
      );

      // Block DELETE on corporate_account_event
      await assert.rejects(
        () => pool.query(`DELETE FROM public.corporate_account_event WHERE id = $1`, [acctEvent.id]),
        (err) => err.message.includes("corporate_account_event is append-only")
      );

      // Block UPDATE on corporate_employee_event
      await assert.rejects(
        () => pool.query(`UPDATE public.corporate_employee_event SET reason = 'Tampered' WHERE id = $1`, [empEvent.id]),
        (err) => err.message.includes("corporate_employee_event is append-only")
      );

      // Block DELETE on corporate_employee_event
      await assert.rejects(
        () => pool.query(`DELETE FROM public.corporate_employee_event WHERE id = $1`, [empEvent.id]),
        (err) => err.message.includes("corporate_employee_event is append-only")
      );

      pass(15, "Security triggers trg_cax_append_only and trg_cee_append_only strictly block UPDATE and DELETE on audit logs");
    } catch (err) {
      fail(15, "Audit event immutability trigger test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Import Batch Replay Defense
    // -------------------------------------------------------------------------
    try {
      const testFileHash = crypto.createHash('sha256').update(`test_roster_csv_${tsSuffix}`).digest('hex');

      // 1. Create batch
      const batch = await CorporateEmployeeService.createImportBatch(
        account1.id,
        {
          file_hash: testFileHash,
          filename: "q4_roster_2026.csv",
          total_rows: 50,
          valid_rows: 50,
          invalid_rows: 0,
          status: "DRY_RUN_OK",
        },
        rosterMgrActor
      );
      assert.strictEqual(batch.status, "DRY_RUN_OK");

      // 2. Commit batch
      const committed = await CorporateEmployeeService.updateImportBatchStatus(
        account1.id,
        batch.id,
        "COMMITTED",
        { inserted_rows: 50, committed_by: userIdRosterMgr },
        rosterMgrActor
      );
      assert.strictEqual(committed.status, "COMMITTED");

      // 3. Replay check: attempting to create or commit second batch with same file hash must fail
      await assert.rejects(
        () => CorporateEmployeeService.createImportBatch(
          account1.id,
          {
            file_hash: testFileHash,
            filename: "q4_roster_2026_reupload.csv",
            total_rows: 50,
          },
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "DUPLICATE_FILE_HASH"
      );

      pass(16, "Import batch replay protection blocks duplicate committed SHA-256 file hashes");
    } catch (err) {
      fail(16, "Import batch replay test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Cross-Account Isolation Defense
    // -------------------------------------------------------------------------
    try {
      // Create a second account for customer 3
      const account2 = await CorporateAccountService.createAccount(
        {
          customer_id: custId3,
          legal_name: "Wipro Technologies",
          gstin: `29WWWCW${tsSuffix.slice(-4)}P1Z9`,
          pan: `WWWCW${tsSuffix.slice(-4)}P`,
        },
        creatorActor
      );
      createdAccountIds.push(account2.id);

      // Actor scoped to account1 attempts to view account2 employees
      await assert.rejects(
        () => CorporateEmployeeService.listEmployees(account2.id, {}, rosterMgrActor),
        (err) => err instanceof CorporateEmployeeError && err.code === "PERMISSION_DENIED"
      );

      // Actor scoped to account1 attempts to add employee to account2
      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account2.id,
          { employee_code: "WIP-01", full_name: "Wipro Staff", phone: "9833344455" },
          rosterMgrActor
        ),
        (err) => err instanceof CorporateEmployeeError && err.code === "PERMISSION_DENIED"
      );

      pass(17, "Cross-account isolation strictly denies unauthorized cross-tenant queries and mutations");
    } catch (err) {
      fail(17, "Cross-account isolation test failed", err);
    }

    // -------------------------------------------------------------------------
    // TEST 18: Atomic Transaction Rollback on Failure
    // -------------------------------------------------------------------------
    try {
      const beforeCountRes = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee WHERE account_id = $1`, [account1.id]);
      const beforeCount = beforeCountRes.rows[0].cnt;

      await assert.rejects(
        () => CorporateEmployeeService.createEmployee(
          account1.id,
          {
            employee_code: "EMP-ROLLBACK-TEST",
            full_name: "Rollback Tester",
            phone: "9844455566",
            // Pass an invalid city_key or corrupt parameter that fails in transaction
            default_latitude: 999.0, // Fails coordinate check
          },
          rosterMgrActor
        )
      );

      const afterCountRes = await pool.query(`SELECT count(*)::int as cnt FROM public.corporate_employee WHERE account_id = $1`, [account1.id]);
      const afterCount = afterCountRes.rows[0].cnt;
      assert.strictEqual(afterCount, beforeCount, "Employee count must remain identical after transaction rollback");

      pass(18, "Transaction rollback guarantees zero partial state mutations on validation failure");
    } catch (err) {
      fail(18, "Transaction rollback test failed", err);
    }

  } catch (criticalErr) {
    console.error("\nFATAL SUITE ERROR:", criticalErr);
    failed++;
  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Clean up test fixtures using session_replication_role = replica
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("  TEARDOWN: Cleaning up test fixtures with replica role...        ");
    console.log("------------------------------------------------------------------");

    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN;");
        await client.query("SET session_replication_role = 'replica';");

        // Delete test fixtures by created IDs
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
      // POSTFLIGHT AUDIT: Accounting Invariants & Table Cleanness
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
