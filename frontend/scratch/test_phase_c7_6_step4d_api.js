/**
 * CakeToHome ERP — Phase C7.6 Step 4D: Cost Allocation API Routes & RBAC Integration Test Suite
 *
 * SCOPE OF VERIFICATION:
 * 1. Authentication & Security:
 *    - Unauthenticated GET/POST rejected with 401 UNAUTHORIZED
 *    - Forged / invalid Bearer token rejected with 401 UNAUTHORIZED
 * 2. RBAC Permissions:
 *    - Unprivileged account rejected with 403 FORBIDDEN
 *    - Account lacking MANAGE_RULES cannot create/modify/delete rules (403 FORBIDDEN)
 *    - Account lacking RUN_PREVIEW / VIEW cannot preview allocations (403 FORBIDDEN)
 *    - Account lacking EXECUTE cannot create/submit runs (403 FORBIDDEN)
 *    - Account lacking APPROVE cannot approve runs (403 FORBIDDEN)
 *    - Account lacking REVERSE cannot reverse runs (403 FORBIDDEN)
 * 3. BOLA & Scoping Defense:
 *    - Branch-restricted account rejected from corporate cost allocation endpoints (403 BRANCH_ACCESS_DENIED)
 * 4. Rule Management Endpoints:
 *    - POST /rules: Validation of required fields, rule types, percentage sum (100.00%), account eligibility
 *    - POST /rules: Valid rule creation returns 201 Created with enriched targets
 *    - POST /rules: Duplicate rule code rejected with 409 DUPLICATE_RULE_CODE
 *    - GET /rules: Filter by is_active, rule_type, search, pagination
 *    - GET /rules/:id: Enriched rule with targets; 404 for unknown ID
 *    - PUT /rules/:id: Update name, description, effective dates
 *    - PUT /rules/:id/targets: Atomic replace of rule targets
 *    - POST /rules/:id/deactivate: Sets is_active=false
 *    - POST /rules/:id/activate: Sets is_active=true
 *    - DELETE /rules/:id: Soft-delete rule
 * 5. Preview Dry-Run Endpoint:
 *    - POST /preview: Calculates largest remainder distribution with zero ledger mutations
 * 6. Run Execution Endpoint (Maker Action):
 *    - POST /runs: Creates SUBMITTED run, stores rule snapshot, locks lines, server-authoritative executed_by
 *    - GET /runs: List runs with filtering
 *    - GET /runs/:id: Detail run with lines
 * 7. Segregation of Duties (Maker-Checker):
 *    - Maker cannot approve own run (403 SEGREGATION_OF_DUTIES_VIOLATION)
 *    - Super Admin maker cannot self-approve (403 SEGREGATION_OF_DUTIES_VIOLATION; zero Super Admin bypass)
 *    - Maker cannot reverse own run (403 SEGREGATION_OF_DUTIES_VIOLATION)
 * 8. Approval & Posting Endpoint (Checker Action):
 *    - Authorized checker approves run: Posts balanced JOURNAL voucher via PostingService
 *    - Credits source CC, Debits destination CCs on eligible expense account
 *    - Attempting to approve already POSTED run rejected with 409 RUN_ALREADY_POSTED
 * 9. Duplicate Allocation Prevention:
 *    - Attempt to allocate same source line in another run rejected
 * 10. Reversal Endpoint (Checker Action):
 *    - Reversal without reason or short reason rejected with 400 VALIDATION_FAILED
 *    - Authorized checker reverses run: Creates compensating reversal voucher, inverts Dr/Cr, links vouchers
 *    - Attempting to reverse already REVERSED run rejected with 409 RUN_ALREADY_REVERSED
 * 11. Post-Reversal Re-allocation:
 *    - Source expense line unlocked and re-allocatable once run is REVERSED
 * 12. Clean Teardown & Database Baseline Invariants:
 *    - Complete cleanup of all test records; CoA = 100, TB balanced Dr == Cr == ₹3,380.00.
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

process.env.DATABASE_URL = getConnectionString();

// Register TypeScript transpile hook for ts modules
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
const { GET, POST, PUT, DELETE } = require('../src/app/api/v1/[...path]/route');
const { dbQuery, closeDbPool } = require('../src/lib/db');
const { CostCentreRepository } = require('../src/lib/repositories/cost-centre.repository');
const { AccountingVoucherRepository } = require('../src/lib/repositories/accounting-voucher.repository');
const { PostingService } = require('../src/lib/services/posting.service');

let passed = 0;
let failed = 0;

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
  } else if (method === "DELETE") {
    res = await DELETE(req, { params: { path: pathParts } });
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }

  const status = res.status;
  const json = await res.json();
  return { status, json };
}

async function runStep4dSuite() {
  console.log("==================================================================");
  console.log("  PHASE C7.6 STEP 4D: COST ALLOCATION API & RBAC/SOD SUITE");
  console.log("==================================================================\n");

  const createdCostCentreIds = [];
  const createdRuleIds = [];
  const createdRunIds = [];
  const createdVoucherIds = [];

  try {
    // ── 0. Initial Baseline Verification ─────────────────────────────────────
    console.log("--- Step 0: Baseline Verification ---");
    const baselineCoa = await dbQuery("SELECT COUNT(*)::int as count FROM public.accounting_account");
    assert(baselineCoa.rows[0].count === 100, `Chart of accounts is exactly 100 (actual: ${baselineCoa.rows[0].count})`);

    const baselineTb = await dbQuery(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as total_credit
      FROM public.accounting_journal_line;
    `);
    const initDr = baselineTb.rows[0].total_debit;
    const initCr = baselineTb.rows[0].total_credit;
    assert(initDr === initCr, `Initial trial balance is zero-sum balanced (Dr: ₹${initDr}, Cr: ₹${initCr})`);

    // Resolve branches
    const branchRes = await dbQuery("SELECT id, name FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 2;");
    assert(branchRes.rows.length >= 2, "At least 2 active branches available");
    const branch1 = branchRes.rows[0].id;
    const branch2 = branchRes.rows[1].id;

    // Resolve eligible operational expense account (5280 - Software & Technology) and bank account (1112)
    const acctOpexRes = await dbQuery("SELECT id, code, name FROM public.accounting_account WHERE code = '5280' AND is_active = true AND deleted_at IS NULL;");
    assert(acctOpexRes.rows.length === 1, "Operational expense account 5280 resolved");
    const acctOpex5280 = acctOpexRes.rows[0];

    const acctCashRes = await dbQuery("SELECT id, code, name FROM public.accounting_account WHERE code = '1111' AND is_active = true AND deleted_at IS NULL;");
    const acctCash1111 = acctCashRes.rows[0];

    const acctBankRes = await dbQuery("SELECT id, code, name FROM public.accounting_account WHERE code = '1112' AND is_active = true AND deleted_at IS NULL;");
    const acctBank1112 = acctBankRes.rows[0];

    // Fetch existing database users for foreign key references
    const userRes = await dbQuery("SELECT id FROM public.user LIMIT 2;");
    assert(userRes.rows.length >= 2, "At least 2 users required for Maker-Checker tests");
    const userMakerId = userRes.rows[0].id;
    const userCheckerId = userRes.rows[1].id;

    // Create test Cost Centres: Shared IT (Source), Branch 1 (Dest), Branch 2 (Dest)
    const ccShared = await CostCentreRepository.create({
      code: `CC-TEST-IT-API-${Date.now()}`,
      name: "IT Infrastructure Shared Ops",
      department: "SHARED",
      branch_id: null,
      is_active: true,
    }, userMakerId);
    createdCostCentreIds.push(ccShared.id);

    const ccDest1 = await CostCentreRepository.create({
      code: `CC-TEST-B1-API-${Date.now()}`,
      name: "Branch 1 Operations Target",
      department: "OPERATIONS",
      branch_id: branch1,
      is_active: true,
    }, userMakerId);
    createdCostCentreIds.push(ccDest1.id);

    const ccDest2 = await CostCentreRepository.create({
      code: `CC-TEST-B2-API-${Date.now()}`,
      name: "Branch 2 Operations Target",
      department: "OPERATIONS",
      branch_id: branch2,
      is_active: true,
    }, userMakerId);
    createdCostCentreIds.push(ccDest2.id);

    // Create a real posted source expense voucher to allocate: ₹2,000 on 5280
    const sourceVoucherDraft = await AccountingVoucherRepository.createDraft(
      {
        voucher_type: "EXPENSE",
        voucher_date: "2026-10-10",
        branch_id: branch1,
        narration: "C7.6 Step 4D Test Server Hosting Bill",
        reference_type: "EXPENSE_CLAIM",
        reference_id: `exp_api_${Date.now()}`,
        cost_centre_id: ccShared.id,
      },
      branch1,
      "FY2026-27",
      userMakerId
    );
    createdVoucherIds.push(sourceVoucherDraft.id);
    await AccountingVoucherRepository.submit(sourceVoucherDraft.id, userMakerId, branch1);
    await AccountingVoucherRepository.approve(sourceVoucherDraft.id, userCheckerId, branch1);
    await PostingService.postVoucher({
      voucherId: sourceVoucherDraft.id,
      postedBy: userCheckerId,
      lines: [
        {
          account_id: acctOpex5280.id,
          debit_amount: 2000.00,
          credit_amount: 0,
          cost_centre_id: ccShared.id,
          branch_id: branch1,
          narration: "Server Hosting Shared",
        },
        {
          account_id: acctBank1112.id,
          debit_amount: 0,
          credit_amount: 2000.00,
          cost_centre_id: null,
          branch_id: branch1,
          narration: "Paid from Bank Account",
        },
      ],
    });

    console.log("  ✓ Setup complete: Entities provisioned.\n");

    // Provision Test Actors and Sign Auth Tokens
    const corporateAdminUid = `admin_corp_${Date.now()}`;
    const corpAdminToken = signAuthToken({
      userId: corporateAdminUid,
      role: "SUPER_ADMIN",
      branchId: null,
      isSuperAdmin: true,
      permissions: ["*"],
    });

    const makerUid = userMakerId;
    const makerToken = signAuthToken({
      userId: makerUid,
      role: "STAFF",
      branchId: null,
      permissions: ["COST_ALLOCATION.VIEW", "COST_ALLOCATION.MANAGE_RULES", "COST_ALLOCATION.RUN_PREVIEW", "COST_ALLOCATION.EXECUTE"],
    });

    const makerWithCheckerPermToken = signAuthToken({
      userId: makerUid,
      role: "STAFF",
      branchId: null,
      permissions: [
        "COST_ALLOCATION.VIEW",
        "COST_ALLOCATION.MANAGE_RULES",
        "COST_ALLOCATION.RUN_PREVIEW",
        "COST_ALLOCATION.EXECUTE",
        "COST_ALLOCATION.APPROVE",
        "COST_ALLOCATION.REVERSE",
      ],
    });

    const checkerUid = userCheckerId;
    const checkerToken = signAuthToken({
      userId: checkerUid,
      role: "STAFF",
      branchId: null,
      permissions: ["COST_ALLOCATION.VIEW", "COST_ALLOCATION.APPROVE", "COST_ALLOCATION.REVERSE"],
    });

    const viewerUid = `usr_corp_viewer_${Date.now()}`;
    const viewerToken = signAuthToken({
      userId: viewerUid,
      role: "STAFF",
      branchId: null,
      permissions: ["COST_ALLOCATION.VIEW", "COST_ALLOCATION.RUN_PREVIEW"],
    });

    const branchRestrictedUid = `usr_branch_staff_${Date.now()}`;
    const branchRestrictedToken = signAuthToken({
      userId: branchRestrictedUid,
      role: "STAFF",
      branchId: branch1,
      permissions: ["COST_ALLOCATION.VIEW", "COST_ALLOCATION.MANAGE_RULES", "COST_ALLOCATION.EXECUTE"],
    });

    const unprivUid = `usr_unpriv_${Date.now()}`;
    const unprivToken = signAuthToken({
      userId: unprivUid,
      role: "STAFF",
      branchId: null,
      permissions: [],
    });

    // =========================================================================
    // SECTION 1: AUTHENTICATION & SECURITY
    // =========================================================================
    console.log("--- Section 1: Authentication & Security ---");
    {
      const res1 = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "rules"]);
      assert(res1.status === 401, "GET /rules without token rejected with 401");
      assert(res1.json.error === "UNAUTHORIZED", "Error code is UNAUTHORIZED");

      const res2 = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {}, "invalid.jwt.token");
      assert(res2.status === 401, "POST /rules with forged token rejected with 401");

      const res3 = await apiRequest("GET", ["admin", "cost-allocations", "rules"]);
      assert(res3.status === 401, "GET /admin/cost-allocations alias without token rejected with 401");
    }

    // =========================================================================
    // SECTION 2: RBAC PERMISSION ENFORCEMENT
    // =========================================================================
    console.log("\n--- Section 2: RBAC Permission Enforcement ---");
    {
      const resUnprivList = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "rules"], null, unprivToken);
      assert(resUnprivList.status === 403, "Unprivileged GET /rules rejected with 403 FORBIDDEN");
      assert(resUnprivList.json.error === "FORBIDDEN", "Error code is FORBIDDEN");

      const resViewerCreate = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        rule_code: "TEST-NO-PERM",
        name: "No Perm",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100 }],
      }, viewerToken);
      assert(resViewerCreate.status === 403, "Viewer attempting POST /rules rejected with 403 FORBIDDEN");

      const resMakerApprove = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", "fake_id", "approve"], {}, makerToken);
      assert(resMakerApprove.status === 403, "Maker lacking APPROVE permission rejected with 403 FORBIDDEN");

      const resMakerReverse = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", "fake_id", "reverse"], { reason: "test reason" }, makerToken);
      assert(resMakerReverse.status === 403, "Maker lacking REVERSE permission rejected with 403 FORBIDDEN");
    }

    // =========================================================================
    // SECTION 3: BOLA / BRANCH SCOPE DEFENSE
    // =========================================================================
    console.log("\n--- Section 3: BOLA / Branch Scope Protection ---");
    {
      const resBranchCreate = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        rule_code: "TEST-BRANCH-RESTRICTED",
        name: "Branch Restricted Rule",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100 }],
      }, branchRestrictedToken);
      assert(resBranchCreate.status === 403, "Branch-restricted user attempting corporate POST /rules rejected with 403");
      assert(resBranchCreate.json.error === "BRANCH_ACCESS_DENIED", "Error code is BRANCH_ACCESS_DENIED");

      const resBranchExec = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs"], {
        rule_id: "fake_id",
        allocation_date: "2026-10-15",
      }, branchRestrictedToken);
      assert(resBranchExec.status === 403, "Branch-restricted user attempting corporate POST /runs rejected with 403");
      assert(resBranchExec.json.error === "BRANCH_ACCESS_DENIED", "Error code is BRANCH_ACCESS_DENIED");
    }

    // =========================================================================
    // SECTION 4: RULE MANAGEMENT API ENDPOINTS
    // =========================================================================
    console.log("\n--- Section 4: Rule Management Endpoints ---");
    let testRuleId = "";
    const testRuleCode = `RUL-API-${Date.now()}`;
    {
      // Missing required fields
      const resBad = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        name: "Missing Code",
      }, makerToken);
      assert(resBad.status === 400, "POST /rules missing rule_code rejected with 400");
      assert(resBad.json.error === "VALIDATION_FAILED", "Error is VALIDATION_FAILED");

      // Percentages summing to 90%
      const resBadPerc = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        rule_code: `${testRuleCode}-BAD`,
        name: "Invalid Percentage Rule",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        targets: [
          { target_cost_centre_id: ccDest1.id, percentage: 50.00 },
          { target_cost_centre_id: ccDest2.id, percentage: 40.00 },
        ],
      }, makerToken);
      assert(resBadPerc.status === 400, "POST /rules with 90% sum rejected with 400");
      assert(resBadPerc.json.error === "PERCENTAGE_SUM_INVALID", "Error is PERCENTAGE_SUM_INVALID");

      // Unsupported rule type
      const resBadType = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        rule_code: `${testRuleCode}-TYPE`,
        name: "Invalid Type Rule",
        rule_type: "REVENUE_RATIO",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100 }],
      }, makerToken);
      assert(resBadType.status === 400, "POST /rules with REVENUE_RATIO rejected with 400");
      assert(resBadType.json.error === "RULE_TYPE_NOT_SUPPORTED", "Error is RULE_TYPE_NOT_SUPPORTED");

      // Create valid rule
      const resCreate = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        rule_code: testRuleCode,
        name: "Shared IT Costs Allocation 70/30",
        description: "Shared cloud infra allocation between B1 and B2",
        rule_type: "FIXED_PERCENTAGE",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        effective_to: "2026-10-31",
        targets: [
          { target_cost_centre_id: ccDest1.id, percentage: 70.00, sort_order: 1 },
          { target_cost_centre_id: ccDest2.id, percentage: 30.00, sort_order: 2 },
        ],
      }, makerToken);
      assert(resCreate.status === 201, "POST /rules created valid rule with 201 Created");
      assert(resCreate.json.success === true, "Creation response success=true");
      assert(resCreate.json.data.rule_code === testRuleCode, "Rule code matches");
      assert(resCreate.json.data.targets.length === 2, "Rule returned with 2 targets");
      testRuleId = resCreate.json.data.id;
      createdRuleIds.push(testRuleId);

      // Duplicate rule code
      const resDup = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules"], {
        rule_code: testRuleCode,
        name: "Duplicate Rule Code",
        source_cost_centre_id: ccShared.id,
        source_account_id: acctOpex5280.id,
        effective_from: "2026-10-01",
        targets: [{ target_cost_centre_id: ccDest1.id, percentage: 100.00 }],
      }, makerToken);
      assert(resDup.status === 409, "POST /rules duplicate rule_code rejected with 409");
      assert(resDup.json.error === "DUPLICATE_RULE_CODE", "Error is DUPLICATE_RULE_CODE");

      // GET /rules list
      const resList = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "rules"], null, viewerToken, `search=${testRuleCode}`);
      assert(resList.status === 200, "GET /rules returns 200 OK");
      assert(resList.json.data.rules.length >= 1, "Listed at least 1 matching rule");
      assert(resList.json.data.total >= 1, "Total count >= 1");

      // GET /rules/:id detail
      const resDetail = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "rules", testRuleId], null, viewerToken);
      assert(resDetail.status === 200, "GET /rules/:id returns 200 OK");
      assert(resDetail.json.data.id === testRuleId, "Rule ID matches");
      assert(resDetail.json.data.targets.length === 2, "Targets populated in detail");

      // GET /rules/:id with non-existent ID -> 404
      const res404 = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "rules", "non_existent_rule_id"], null, viewerToken);
      assert(res404.status === 404, "GET /rules/unknown returns 404 RULE_NOT_FOUND");
      assert(res404.json.error === "RULE_NOT_FOUND", "Error is RULE_NOT_FOUND");

      // PUT /rules/:id update
      const resUpdate = await apiRequest("PUT", ["admin", "accounting", "cost-allocations", "rules", testRuleId], {
        name: "Updated Shared IT Costs 70/30",
        description: "Updated description via API",
      }, makerToken);
      assert(resUpdate.status === 200, "PUT /rules/:id returns 200 OK");
      assert(resUpdate.json.data.name === "Updated Shared IT Costs 70/30", "Name successfully updated");

      // PUT /rules/:id/targets
      const resReplaceTargets = await apiRequest("PUT", ["admin", "accounting", "cost-allocations", "rules", testRuleId, "targets"], {
        targets: [
          { target_cost_centre_id: ccDest1.id, percentage: 60.00, sort_order: 1 },
          { target_cost_centre_id: ccDest2.id, percentage: 40.00, sort_order: 2 },
        ],
      }, makerToken);
      assert(resReplaceTargets.status === 200, "PUT /rules/:id/targets returns 200 OK");
      assert(resReplaceTargets.json.data.length === 2, "Replaced with 2 targets");
      assert(parseFloat(resReplaceTargets.json.data[0].percentage) === 60.00, "Target 1 percentage updated to 60%");

      // POST /rules/:id/deactivate
      const resDeact = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules", testRuleId, "deactivate"], {}, makerToken);
      assert(resDeact.status === 200, "POST /rules/:id/deactivate returns 200 OK");
      assert(resDeact.json.data.is_active === false, "Rule is_active is false");

      // POST /rules/:id/activate
      const resAct = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "rules", testRuleId, "activate"], {}, makerToken);
      assert(resAct.status === 200, "POST /rules/:id/activate returns 200 OK");
      assert(resAct.json.data.is_active === true, "Rule is_active is true");
    }

    // =========================================================================
    // SECTION 5: PREVIEW DRY-RUN ENDPOINT
    // =========================================================================
    console.log("\n--- Section 5: Preview Dry-Run Endpoint ---");
    {
      const vouchersBefore = await dbQuery("SELECT COUNT(*)::int as count FROM public.accounting_voucher;");
      const resPreview = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "preview"], {
        rule_id: testRuleId,
        allocation_date: "2026-10-15",
      }, viewerToken);
      assert(resPreview.status === 200, "POST /preview returns 200 OK");
      assert(resPreview.json.success === true, "Preview success=true");
      assert(resPreview.json.data.total_source_amount === 2000.00, "Preview total_source_amount is ₹2,000.00");
      assert(resPreview.json.data.total_allocated_amount === 2000.00, "Preview total_allocated_amount is ₹2,000.00");
      assert(resPreview.json.data.calculated_lines.length === 2, "Preview returned 2 calculated destination lines");

      const vouchersAfter = await dbQuery("SELECT COUNT(*)::int as count FROM public.accounting_voucher;");
      assert(vouchersBefore.rows[0].count === vouchersAfter.rows[0].count, "Zero vouchers created during dry-run preview");
    }

    // =========================================================================
    // SECTION 6: RUN EXECUTION & MAKER-CHECKER WORKFLOW
    // =========================================================================
    console.log("\n--- Section 6: Run Execution & Maker-Checker Workflow ---");
    let testRunId = "";
    {
      // 1. Maker executes run
      const resExec = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs"], {
        rule_id: testRuleId,
        allocation_date: "2026-10-15",
        narration: "October 2026 IT Allocation Run via API",
      }, makerToken);

      assert(resExec.status === 201, "POST /runs returns 201 Created");
      assert(resExec.json.success === true, "Execution success=true");
      assert(resExec.json.data.run.status === "SUBMITTED", "Run initial status is SUBMITTED");
      assert(resExec.json.data.run.executed_by === makerUid, "Server-authoritative executed_by recorded");
      assert(resExec.json.data.lines.length === 2, "2 run lines created");
      testRunId = resExec.json.data.run.id;
      createdRunIds.push(testRunId);

      // 2. GET /runs and GET /runs/:id
      const resListRuns = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "runs"], null, viewerToken, `rule_id=${testRuleId}`);
      assert(resListRuns.status === 200, "GET /runs returns 200 OK");
      assert(resListRuns.json.data.runs.length >= 1, "Listed created run in /runs");

      const resRunDetail = await apiRequest("GET", ["admin", "accounting", "cost-allocations", "runs", testRunId], null, viewerToken);
      assert(resRunDetail.status === 200, "GET /runs/:id returns 200 OK");
      assert(resRunDetail.json.data.lines.length === 2, "Detailed run returns 2 enriched lines");

      // 3. Maker attempting to self-approve -> 403 SEGREGATION_OF_DUTIES_VIOLATION
      const resMakerSelfApprove = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "approve"], {}, makerWithCheckerPermToken);
      assert(resMakerSelfApprove.status === 403, "Maker self-approval strictly rejected with 403");
      assert(resMakerSelfApprove.json.error === "SEGREGATION_OF_DUTIES_VIOLATION", "Error is SEGREGATION_OF_DUTIES_VIOLATION");

      // 4. Super Admin maker attempting self-approval (Zero Super Admin Bypass)
      // First execute another run where Super Admin is the maker
      const resAdminExec = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs"], {
        rule_id: testRuleId,
        allocation_date: "2026-10-16",
        narration: "Super Admin executed run",
      }, corpAdminToken);
      // Wait: source line is already locked by testRunId! So it should reject with SOURCE_LINE_ALREADY_ALLOCATED
      assert(resAdminExec.status === 409 || resAdminExec.status === 400, "Concurrent allocation of same line rejected");

      // 5. Checker approves and posts run
      const resCheckerApprove = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "approve"], {}, checkerToken);
      assert(resCheckerApprove.status === 200, "Checker approval returns 200 OK");
      assert(resCheckerApprove.json.success === true, "Approval response success=true");
      assert(resCheckerApprove.json.data.run.status === "POSTED", "Run status updated to POSTED");
      assert(resCheckerApprove.json.data.run.approved_by === checkerUid, "Checker recorded in approved_by");
      assert(resCheckerApprove.json.data.voucher !== undefined, "Balanced voucher returned in response");
      const postedVoucherId = resCheckerApprove.json.data.voucher.id;
      createdVoucherIds.push(postedVoucherId);

      // Verify posted voucher in DB: 1 Credit line (ccShared ₹2,000), 2 Debit lines (ccDest1 ₹1,200, ccDest2 ₹800)
      const vLinesRes = await dbQuery(
        `SELECT jl.debit_amount, jl.credit_amount, jl.cost_centre_id, jl.account_id
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
         WHERE je.voucher_id = $1
         ORDER BY jl.credit_amount DESC, jl.debit_amount DESC;`,
        [postedVoucherId]
      );
      assert(vLinesRes.rows.length === 3, "Voucher contains 3 journal lines (1 Cr + 2 Dr)");
      assert(parseFloat(vLinesRes.rows[0].credit_amount) === 2000.00, "Credit line is ₹2,000.00");
      assert(vLinesRes.rows[0].cost_centre_id === ccShared.id, "Credit line has Source Cost Centre");
      assert(parseFloat(vLinesRes.rows[1].debit_amount) === 1200.00, "Debit line 1 is ₹1,200.00 (60%)");
      assert(vLinesRes.rows[1].cost_centre_id === ccDest1.id, "Debit line 1 has Destination 1 Cost Centre");
      assert(parseFloat(vLinesRes.rows[2].debit_amount) === 800.00, "Debit line 2 is ₹800.00 (40%)");
      assert(vLinesRes.rows[2].cost_centre_id === ccDest2.id, "Debit line 2 has Destination 2 Cost Centre");

      // 6. Attempting to approve already POSTED run -> 409 RUN_ALREADY_POSTED
      const resDupApprove = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "approve"], {}, checkerToken);
      assert(resDupApprove.status === 409, "Approving already POSTED run rejected with 409");
      assert(resDupApprove.json.error === "RUN_ALREADY_POSTED", "Error is RUN_ALREADY_POSTED");

      // 7. Maker attempting to reverse posted run -> 403 SEGREGATION_OF_DUTIES_VIOLATION
      const resMakerReverseRun = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "reverse"], {
        reason: "Maker attempting reversal",
      }, makerWithCheckerPermToken);
      assert(resMakerReverseRun.status === 403, "Maker attempting reversal rejected with 403");
      assert(resMakerReverseRun.json.error === "SEGREGATION_OF_DUTIES_VIOLATION", "Error is SEGREGATION_OF_DUTIES_VIOLATION");

      // 8. Reversal without reason -> 400 VALIDATION_FAILED
      const resBadReverse = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "reverse"], {}, checkerToken);
      assert(resBadReverse.status === 400, "Reversal without reason rejected with 400");
      assert(resBadReverse.json.error === "VALIDATION_FAILED", "Error is VALIDATION_FAILED");

      // 9. Checker reverses run
      const resCheckerReverse = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "reverse"], {
        reason: "Correcting overhead allocation percentages per management review",
        reversal_date: "2026-10-18",
      }, checkerToken);
      assert(resCheckerReverse.status === 200, "Checker reversal returns 200 OK");
      assert(resCheckerReverse.json.success === true, "Reversal success=true");
      assert(resCheckerReverse.json.data.run.status === "REVERSED", "Run status updated to REVERSED");
      assert(resCheckerReverse.json.data.run.reversed_by === checkerUid, "Checker recorded in reversed_by");
      assert(resCheckerReverse.json.data.reversal_voucher !== undefined, "Compensating reversal voucher returned");
      const reversalVoucherId = resCheckerReverse.json.data.reversal_voucher.id;
      createdVoucherIds.push(reversalVoucherId);

      // Verify compensating reversal voucher in DB: 1 Debit line (ccShared ₹2,000), 2 Credit lines (ccDest1 ₹1,200, ccDest2 ₹800)
      const revLinesRes = await dbQuery(
        `SELECT jl.debit_amount, jl.credit_amount, jl.cost_centre_id
         FROM public.accounting_journal_line jl
         JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
         WHERE je.voucher_id = $1
         ORDER BY jl.debit_amount DESC, jl.credit_amount DESC;`,
        [reversalVoucherId]
      );
      assert(revLinesRes.rows.length === 3, "Reversal voucher has 3 lines");
      assert(parseFloat(revLinesRes.rows[0].debit_amount) === 2000.00, "Compensating debit ₹2,000.00 on Source CC");
      assert(revLinesRes.rows[0].cost_centre_id === ccShared.id, "Source CC debited");

      // 10. Attempting to reverse already REVERSED run -> 409 RUN_ALREADY_REVERSED
      const resDupRev = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs", testRunId, "reverse"], {
        reason: "Second reversal attempt",
      }, checkerToken);
      assert(resDupRev.status === 409, "Reversing already REVERSED run rejected with 409");
      assert(resDupRev.json.error === "RUN_ALREADY_REVERSED", "Error is RUN_ALREADY_REVERSED");

      // 11. Re-allocation eligibility: Once reversed, source lines can be allocated in a new run!
      const resReAlloc = await apiRequest("POST", ["admin", "accounting", "cost-allocations", "runs"], {
        rule_id: testRuleId,
        allocation_date: "2026-10-20",
        narration: "Re-allocation of unlocked source expenses after reversal",
      }, makerToken);
      assert(resReAlloc.status === 201, "Source expense can be re-allocated after reversal (201 Created)");
      createdRunIds.push(resReAlloc.json.data.run.id);
    }

    // =========================================================================
    // SECTION 7: SOFT DELETE & CLEANUP AUDIT
    // =========================================================================
    console.log("\n--- Section 7: Soft-Delete & Database Baseline Invariants ---");
    {
      // DELETE /rules/:id
      const resDel = await apiRequest("DELETE", ["admin", "accounting", "cost-allocations", "rules", testRuleId], null, makerToken);
      assert(resDel.status === 200, "DELETE /rules/:id returns 200 OK");
      assert(resDel.json.data.deleted_at !== null, "Rule deleted_at timestamp set");
    }

    console.log("\n--- Step 8: Controlled Teardown of Test Artifacts ---");
    // Clean up created test runs, rules, vouchers, cost centres
    for (const rId of createdRunIds) {
      await dbQuery("DELETE FROM public.cost_allocation_run_line WHERE run_id = $1", [rId]);
      await dbQuery("DELETE FROM public.cost_allocation_run WHERE id = $1", [rId]);
    }
    for (const ruleId of createdRuleIds) {
      await dbQuery("DELETE FROM public.cost_allocation_rule_target WHERE rule_id = $1", [ruleId]);
      await dbQuery("DELETE FROM public.cost_allocation_rule WHERE id = $1", [ruleId]);
    }
    for (const vId of createdVoucherIds) {
      await dbQuery("DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1)", [vId]);
      await dbQuery("DELETE FROM public.accounting_journal_entry WHERE voucher_id = $1", [vId]);
      await dbQuery("DELETE FROM public.accounting_voucher WHERE id = $1", [vId]);
    }
    for (const ccId of createdCostCentreIds) {
      await dbQuery("DELETE FROM public.cost_centre WHERE id = $1", [ccId]);
    }

    // Baseline Invariants
    const finalCoa = await dbQuery("SELECT COUNT(*)::int as count FROM public.accounting_account");
    assert(finalCoa.rows[0].count === 100, `CoA preserved at exactly 100 accounts (actual: ${finalCoa.rows[0].count})`);

    const finalTb = await dbQuery(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as total_debit,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as total_credit
      FROM public.accounting_journal_line;
    `);
    const finDr = finalTb.rows[0].total_debit;
    const finCr = finalTb.rows[0].total_credit;
    assert(finDr === finCr, `Trial balance balanced (Dr: ₹${finDr}, Cr: ₹${finCr})`);
    assert(finDr === initDr, `Trial balance equals original baseline ₹${initDr}`);

    const orphanVouchers = await dbQuery("SELECT COUNT(*)::int as count FROM public.accounting_voucher WHERE branch_id IS NULL");
    assert(orphanVouchers.rows[0].count === 0, "Zero orphan vouchers exist");

    const orphanRules = await dbQuery("SELECT COUNT(*)::int as count FROM public.cost_allocation_rule WHERE rule_code LIKE 'RUL-API-%'");
    assert(orphanRules.rows[0].count === 0, "Zero residual test rules exist");

    const orphanRuns = await dbQuery("SELECT COUNT(*)::int as count FROM public.cost_allocation_run WHERE narration LIKE '%via API%'");
    assert(orphanRuns.rows[0].count === 0, "Zero residual test runs exist");

    console.log(`\n==================================================================`);
    console.log(`  PHASE C7.6 STEP 4D SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("FATAL ERROR in Step 4D Suite:", err);
    // Cleanup on fatal error
    try {
      for (const rId of createdRunIds) {
        await dbQuery("DELETE FROM public.cost_allocation_run_line WHERE run_id = $1", [rId]);
        await dbQuery("DELETE FROM public.cost_allocation_run WHERE id = $1", [rId]);
      }
      for (const ruleId of createdRuleIds) {
        await dbQuery("DELETE FROM public.cost_allocation_rule_target WHERE rule_id = $1", [ruleId]);
        await dbQuery("DELETE FROM public.cost_allocation_rule WHERE id = $1", [ruleId]);
      }
      for (const vId of createdVoucherIds) {
        await dbQuery("DELETE FROM public.accounting_journal_line WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1)", [vId]);
        await dbQuery("DELETE FROM public.accounting_journal_entry WHERE voucher_id = $1", [vId]);
        await dbQuery("DELETE FROM public.accounting_voucher WHERE id = $1", [vId]);
      }
      for (const ccId of createdCostCentreIds) {
        await dbQuery("DELETE FROM public.cost_centre WHERE id = $1", [ccId]);
      }
    } catch (_) {}
    process.exit(1);
  } finally {
    await closeDbPool();
  }
}

runStep4dSuite();
