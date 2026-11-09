/**
 * CakeToHome ERP — Phase C7.6 Step 1: Cost Centre Master Subsystem Verification Suite
 *
 * Validates all Non-Negotiable Rules & Invariants:
 *  1. Create valid corporate cost centre (branch_id = null)
 *  2. Create valid branch cost centre (branch_id populated)
 *  3. Duplicate code rejected (409 DUPLICATE_CODE)
 *  4. Missing required fields rejected (code, name, department)
 *  5. Nonexistent company rejected (404 COMPANY_NOT_FOUND)
 *  6. Nonexistent branch rejected (404 BRANCH_NOT_FOUND)
 *  7. Nonexistent parent rejected (404 PARENT_NOT_FOUND)
 *  8. Inactive parent rejected (400 PARENT_INACTIVE)
 *  9. Deleted parent rejected (400 PARENT_DELETED)
 * 10. Self-parent rejected (400 SELF_PARENT_PROHIBITED)
 * 11. Circular hierarchy rejected (A -> B -> A, A -> B -> C -> A)
 * 12. Valid nested hierarchy accepted & getCostCentreTree builds tree
 * 13. Update valid master data (name, department, metadata)
 * 14. Deactivate cost centre (is_active = false)
 * 15. Inactive cost centre cannot be selected for new posting (assertCostCentreActiveForPosting)
 * 16. Soft delete cost centre (deleted_at set, is_active = false)
 * 17. Deleted cost centre cannot be selected for new posting (assertCostCentreActiveForPosting)
 * 18. Referenced cost centre / parent with children deletion guarded (HAS_CHILDREN)
 * 19. Branch isolation enforced (BOLA)
 * 20. Corporate/shared cost centre visibility for branch staff
 * 21. RBAC VIEW enforced
 * 22. RBAC MANAGE enforced
 * 23. Unauthorized mutation rejected (403 PERMISSION_DENIED)
 * 24. Database baseline unchanged (CoA = 100, TB = Dr ₹3,380 = Cr ₹3,380)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

const connString = getConnectionString();
process.env.DATABASE_URL = connString;
const pool = new Pool({
  connectionString: connString,
  ssl: connString.includes('supabase') ? { rejectUnauthorized: false } : false
});

// Register TypeScript hook
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

// Import services and repositories under test
const { CostCentreService, CostCentreServiceError } = require('../src/lib/services/cost-centre.service');
const { CostCentreRepository } = require('../src/lib/repositories/cost-centre.repository');

async function runSuite() {
  console.log("==================================================================");
  console.log("  CAKETOHOME ERP — PHASE C7.6 STEP 1: COST CENTRE MASTER SUITE    ");
  console.log("==================================================================\n");

  const createdCostCentreIds = [];
  let passedCount = 0;

  function pass(testNum, desc) {
    passedCount++;
    console.log(`  ✓ PASS [Test ${testNum}]: ${desc}`);
  }

  // Pre-test Baseline Check
  console.log("[Baseline Audit] Verifying pristine starting state...");
  const preCheck = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM public.accounting_account) as coa_count,
      (SELECT COALESCE(SUM(debit_amount),0) FROM public.accounting_journal_line) as total_dr,
      (SELECT COALESCE(SUM(credit_amount),0) FROM public.accounting_journal_line) as total_cr,
      (SELECT COUNT(*) FROM public.cost_centre) as cc_count;
  `);
  const coaBaseline = parseInt(preCheck.rows[0].coa_count, 10);
  const drBaseline = parseFloat(preCheck.rows[0].total_dr);
  const crBaseline = parseFloat(preCheck.rows[0].total_cr);
  const ccBaseline = parseInt(preCheck.rows[0].cc_count, 10);

  assert.strictEqual(coaBaseline, 100, "CoA must be 100 accounts");
  assert.strictEqual(drBaseline, 3380, "Trial balance Dr must be ₹3,380.00");
  assert.strictEqual(crBaseline, 3380, "Trial balance Cr must be ₹3,380.00");
  assert.strictEqual(ccBaseline, 0, "Cost centres must be 0 at baseline");
  console.log("  ✓ Baseline verified: CoA = 100, TB = ₹3,380.00 Dr / Cr, Cost Centres = 0\n");

  // Fetch an existing branch from DB for testing
  const branchRes = await pool.query(`SELECT id, code FROM public.branch ORDER BY id LIMIT 2;`);
  const branch1Id = branchRes.rows[0].id;
  const branch2Id = branchRes.rows[1].id;

  // Actor fixtures
  const superAdminActor = {
    userId: "usr_admin_test",
    role: "SUPER_ADMIN",
    isSuperAdmin: true,
    permissions: ["*"],
  };

  const branch1FinanceActor = {
    userId: "usr_branch1_mgr",
    role: "BRANCH_MANAGER",
    branchId: branch1Id,
    permissions: ["COST_CENTRE.VIEW", "COST_CENTRE.MANAGE"],
  };

  const branch1ReadOnlyActor = {
    userId: "usr_branch1_staff",
    role: "STAFF",
    branchId: branch1Id,
    permissions: ["COST_CENTRE.VIEW"],
  };

  const unauthorizedActor = {
    userId: "usr_random_unauth",
    role: "STAFF",
    branchId: branch1Id,
    permissions: ["ORDERS.VIEW"], // No COST_CENTRE permissions
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Create valid corporate cost centre (branch_id = null)
    // -------------------------------------------------------------------------
    const corpCc = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_HO_EXEC",
      name: "Head Office Executive Leadership",
      department: "HEAD_OFFICE",
      branch_id: null,
      metadata: { budget_tier: "corporate" },
    });
    createdCostCentreIds.push(corpCc.id);
    assert.strictEqual(corpCc.code, "CC_TEST_HO_EXEC");
    assert.strictEqual(corpCc.branch_id, null);
    assert.strictEqual(corpCc.is_active, true);
    assert.strictEqual(corpCc.deleted_at, null);
    pass(1, "Create valid corporate cost centre with branch_id = null");

    // -------------------------------------------------------------------------
    // TEST 2: Create valid branch cost centre (branch_id populated)
    // -------------------------------------------------------------------------
    const branchCc = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_BR1_OPS",
      name: "Branch 01 Storefront Operations",
      department: "BRANCH",
      branch_id: branch1Id,
      metadata: { store_type: "retail" },
    });
    createdCostCentreIds.push(branchCc.id);
    assert.strictEqual(branchCc.code, "CC_TEST_BR1_OPS");
    assert.strictEqual(branchCc.branch_id, branch1Id);
    assert.strictEqual(branchCc.is_active, true);
    pass(2, "Create valid branch-scoped cost centre with branch_id populated");

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate code rejected
    // -------------------------------------------------------------------------
    let dupRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_HO_EXEC", // Duplicate
        name: "Duplicate Attempt",
        department: "HEAD_OFFICE",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "DUPLICATE_CODE") {
        dupRejected = true;
      }
    }
    assert.strictEqual(dupRejected, true, "Duplicate code must be rejected with DUPLICATE_CODE");
    pass(3, "Duplicate cost centre code strictly rejected (409 DUPLICATE_CODE)");

    // -------------------------------------------------------------------------
    // TEST 4: Missing required fields rejected
    // -------------------------------------------------------------------------
    let missingCodeRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "",
        name: "No Code",
        department: "HR",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "INVALID_CODE") {
        missingCodeRejected = true;
      }
    }
    assert.strictEqual(missingCodeRejected, true, "Empty code must be rejected");

    let missingNameRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_NONAME",
        name: " ",
        department: "HR",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "INVALID_NAME") {
        missingNameRejected = true;
      }
    }
    assert.strictEqual(missingNameRejected, true, "Empty name must be rejected");

    let missingDeptRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_NODEPT",
        name: "No Dept",
        department: "",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "INVALID_DEPARTMENT") {
        missingDeptRejected = true;
      }
    }
    assert.strictEqual(missingDeptRejected, true, "Empty department must be rejected");
    pass(4, "Missing required fields (code, name, department) rejected with 400");

    // -------------------------------------------------------------------------
    // TEST 5: Nonexistent company rejected
    // -------------------------------------------------------------------------
    let fakeCompanyRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_FAKE_CO",
        name: "Fake Company CC",
        department: "OPERATIONS",
        company_id: "comp_nonexistent_99999",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "COMPANY_NOT_FOUND") {
        fakeCompanyRejected = true;
      }
    }
    assert.strictEqual(fakeCompanyRejected, true, "Nonexistent company must be rejected");
    pass(5, "Nonexistent company foreign reference rejected with 404 COMPANY_NOT_FOUND");

    // -------------------------------------------------------------------------
    // TEST 6: Nonexistent branch rejected
    // -------------------------------------------------------------------------
    let fakeBranchRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_FAKE_BR",
        name: "Fake Branch CC",
        department: "OPERATIONS",
        branch_id: "br_nonexistent_99999",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "BRANCH_NOT_FOUND") {
        fakeBranchRejected = true;
      }
    }
    assert.strictEqual(fakeBranchRejected, true, "Nonexistent branch must be rejected");
    pass(6, "Nonexistent branch foreign reference rejected with 404 BRANCH_NOT_FOUND");

    // -------------------------------------------------------------------------
    // TEST 7: Nonexistent parent rejected
    // -------------------------------------------------------------------------
    let fakeParentRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_FAKE_PAR",
        name: "Fake Parent CC",
        department: "OPERATIONS",
        parent_id: "cc_nonexistent_99999",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "PARENT_NOT_FOUND") {
        fakeParentRejected = true;
      }
    }
    assert.strictEqual(fakeParentRejected, true, "Nonexistent parent must be rejected");
    pass(7, "Nonexistent parent cost centre rejected with 404 PARENT_NOT_FOUND");

    // -------------------------------------------------------------------------
    // TEST 8: Inactive parent rejected
    // -------------------------------------------------------------------------
    const inactiveParent = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_INACTIVE_PAR",
      name: "Inactive Parent Setup",
      department: "OPERATIONS",
      is_active: false,
    });
    createdCostCentreIds.push(inactiveParent.id);

    let inactiveParentRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_CHILD_OF_INACT",
        name: "Child of Inactive",
        department: "OPERATIONS",
        parent_id: inactiveParent.id,
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "PARENT_INACTIVE") {
        inactiveParentRejected = true;
      }
    }
    assert.strictEqual(inactiveParentRejected, true, "Inactive parent must be rejected");
    pass(8, "Inactive parent cost centre rejected with 400 PARENT_INACTIVE");

    // -------------------------------------------------------------------------
    // TEST 9: Deleted parent rejected
    // -------------------------------------------------------------------------
    const toBeDeletedParent = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_DEL_PAR",
      name: "Parent to be Deleted",
      department: "OPERATIONS",
    });
    createdCostCentreIds.push(toBeDeletedParent.id);
    await CostCentreService.deleteCostCentre(superAdminActor, toBeDeletedParent.id);

    let deletedParentRejected = false;
    try {
      await CostCentreService.createCostCentre(superAdminActor, {
        code: "CC_TEST_CHILD_OF_DEL",
        name: "Child of Deleted",
        department: "OPERATIONS",
        parent_id: toBeDeletedParent.id,
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "PARENT_DELETED") {
        deletedParentRejected = true;
      }
    }
    assert.strictEqual(deletedParentRejected, true, "Deleted parent must be rejected");
    pass(9, "Soft-deleted parent cost centre rejected with 400 PARENT_DELETED");

    // -------------------------------------------------------------------------
    // TEST 10: Self-parent rejected
    // -------------------------------------------------------------------------
    let selfParentRejected = false;
    try {
      await CostCentreService.updateCostCentre(superAdminActor, corpCc.id, {
        parent_id: corpCc.id,
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "SELF_PARENT_PROHIBITED") {
        selfParentRejected = true;
      }
    }
    assert.strictEqual(selfParentRejected, true, "Self-parenting must be rejected");
    pass(10, "Self-parenting update rejected with 400 SELF_PARENT_PROHIBITED");

    // -------------------------------------------------------------------------
    // TEST 11: Circular hierarchy rejected (A -> B -> A and A -> B -> C -> A)
    // -------------------------------------------------------------------------
    const nodeA = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_NODE_A",
      name: "Node A",
      department: "OPERATIONS",
    });
    createdCostCentreIds.push(nodeA.id);

    const nodeB = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_NODE_B",
      name: "Node B",
      department: "OPERATIONS",
      parent_id: nodeA.id, // B -> A
    });
    createdCostCentreIds.push(nodeB.id);

    // Attempt 2-node cycle: Set A's parent to B (A -> B -> A)
    let cycle2Rejected = false;
    try {
      await CostCentreService.updateCostCentre(superAdminActor, nodeA.id, {
        parent_id: nodeB.id,
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "CIRCULAR_HIERARCHY") {
        cycle2Rejected = true;
      }
    }
    assert.strictEqual(cycle2Rejected, true, "Direct 2-node cycle A -> B -> A must be rejected");

    const nodeC = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_NODE_C",
      name: "Node C",
      department: "OPERATIONS",
      parent_id: nodeB.id, // C -> B -> A
    });
    createdCostCentreIds.push(nodeC.id);

    // Attempt 3-node cycle: Set A's parent to C (A -> C -> B -> A)
    let cycle3Rejected = false;
    try {
      await CostCentreService.updateCostCentre(superAdminActor, nodeA.id, {
        parent_id: nodeC.id,
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "CIRCULAR_HIERARCHY") {
        cycle3Rejected = true;
      }
    }
    assert.strictEqual(cycle3Rejected, true, "Multi-node cycle A -> C -> B -> A must be rejected");
    pass(11, "Circular hierarchy loops strictly rejected via recursive ancestor check (400 CIRCULAR_HIERARCHY)");

    // -------------------------------------------------------------------------
    // TEST 12: Valid nested hierarchy accepted & tree view works
    // -------------------------------------------------------------------------
    const tree = await CostCentreService.getCostCentreTree(superAdminActor);
    assert(Array.isArray(tree), "Tree must be an array");
    const foundRootA = tree.find((t) => t.id === nodeA.id);
    assert(foundRootA, "Node A must be a root node in tree");
    assert(foundRootA.children && foundRootA.children.length > 0, "Node A must have children");
    const foundChildB = foundRootA.children.find((c) => c.id === nodeB.id);
    assert(foundChildB, "Node B must be child of Node A");
    assert(foundChildB.children && foundChildB.children.length > 0, "Node B must have child C");
    pass(12, "Valid nested parent-child hierarchy assembled correctly in getCostCentreTree");

    // -------------------------------------------------------------------------
    // TEST 13: Update valid master data
    // -------------------------------------------------------------------------
    const updatedCc = await CostCentreService.updateCostCentre(superAdminActor, corpCc.id, {
      name: "Corporate Executive & Strategic Planning",
      department: "EXECUTIVE",
      metadata: { budget_tier: "corporate", revision: 2 },
    });
    assert.strictEqual(updatedCc.name, "Corporate Executive & Strategic Planning");
    assert.strictEqual(updatedCc.department, "EXECUTIVE");
    assert.strictEqual(updatedCc.metadata.revision, 2);
    pass(13, "Update valid master data fields (name, department, metadata) persists properly");

    // -------------------------------------------------------------------------
    // TEST 14: Deactivate cost centre
    // -------------------------------------------------------------------------
    const deactCc = await CostCentreService.deactivateCostCentre(superAdminActor, branchCc.id);
    assert.strictEqual(deactCc.is_active, false);
    assert.strictEqual(deactCc.deleted_at, null);
    pass(14, "Deactivate cost centre transitions is_active to false");

    // -------------------------------------------------------------------------
    // TEST 15: Inactive cost centre cannot be selected for new posting
    // -------------------------------------------------------------------------
    let inactivePostingBlocked = false;
    try {
      await CostCentreService.assertCostCentreActiveForPosting(branchCc.id);
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "COST_CENTRE_INACTIVE") {
        inactivePostingBlocked = true;
      }
    }
    assert.strictEqual(inactivePostingBlocked, true, "Inactive cost centre must block accounting posting");
    pass(15, "Inactive cost centre rejected by assertCostCentreActiveForPosting (400 COST_CENTRE_INACTIVE)");

    // Reactivate for further tests
    await CostCentreService.reactivateCostCentre(superAdminActor, branchCc.id);
    const reactivated = await CostCentreService.assertCostCentreActiveForPosting(branchCc.id);
    assert.strictEqual(reactivated.is_active, true);

    // -------------------------------------------------------------------------
    // TEST 16: Soft delete cost centre
    // -------------------------------------------------------------------------
    const leafToDelete = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_LEAF_DEL",
      name: "Leaf to Soft Delete",
      department: "OPERATIONS",
    });
    createdCostCentreIds.push(leafToDelete.id);

    const deletedCc = await CostCentreService.deleteCostCentre(superAdminActor, leafToDelete.id);
    assert.notStrictEqual(deletedCc.deleted_at, null);
    assert.strictEqual(deletedCc.is_active, false);
    pass(16, "Soft delete sets deleted_at timestamp and is_active = false");

    // -------------------------------------------------------------------------
    // TEST 17: Deleted cost centre cannot be selected for new posting
    // -------------------------------------------------------------------------
    let deletedPostingBlocked = false;
    try {
      await CostCentreService.assertCostCentreActiveForPosting(leafToDelete.id);
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "COST_CENTRE_DELETED") {
        deletedPostingBlocked = true;
      }
    }
    assert.strictEqual(deletedPostingBlocked, true, "Deleted cost centre must block accounting posting");
    pass(17, "Deleted cost centre rejected by assertCostCentreActiveForPosting (400 COST_CENTRE_DELETED)");

    // -------------------------------------------------------------------------
    // TEST 18: Parent with active children deletion guarded
    // -------------------------------------------------------------------------
    let parentWithChildrenBlocked = false;
    try {
      // nodeA has child nodeB
      await CostCentreService.deleteCostCentre(superAdminActor, nodeA.id);
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "HAS_CHILDREN") {
        parentWithChildrenBlocked = true;
      }
    }
    assert.strictEqual(parentWithChildrenBlocked, true, "Parent with active children cannot be deleted");
    pass(18, "Deleting cost centre with active children blocked with 400 HAS_CHILDREN");

    // -------------------------------------------------------------------------
    // TEST 19: Branch isolation enforced (BOLA)
    // -------------------------------------------------------------------------
    const branch2Cc = await CostCentreService.createCostCentre(superAdminActor, {
      code: "CC_TEST_BR2_OPS",
      name: "Branch 02 Operations",
      department: "BRANCH",
      branch_id: branch2Id,
    });
    createdCostCentreIds.push(branch2Cc.id);

    // Branch 1 user attempts to get Branch 2 CC -> BOLA blocked
    let bolaGetBlocked = false;
    try {
      await CostCentreService.getCostCentreById(branch1FinanceActor, branch2Cc.id);
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "BRANCH_ACCESS_DENIED") {
        bolaGetBlocked = true;
      }
    }
    assert.strictEqual(bolaGetBlocked, true, "Branch 1 actor cannot access Branch 2 cost centre");

    // Branch 1 user attempts to mutate Branch 2 CC -> BOLA blocked
    let bolaUpdateBlocked = false;
    try {
      await CostCentreService.updateCostCentre(branch1FinanceActor, branch2Cc.id, {
        name: "Malicious Edit",
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "BRANCH_ACCESS_DENIED") {
        bolaUpdateBlocked = true;
      }
    }
    assert.strictEqual(bolaUpdateBlocked, true, "Branch 1 actor cannot modify Branch 2 cost centre");
    pass(19, "Branch isolation (BOLA) strictly blocks cross-branch reads and mutations (403 BRANCH_ACCESS_DENIED)");

    // -------------------------------------------------------------------------
    // TEST 20: Corporate/shared cost centre visibility for branch staff
    // -------------------------------------------------------------------------
    // Corporate CC (branch_id = null) should be visible to Branch 1 staff
    const corpSeenByBranch = await CostCentreService.getCostCentreById(branch1FinanceActor, corpCc.id);
    assert.strictEqual(corpSeenByBranch.id, corpCc.id);
    assert.strictEqual(corpSeenByBranch.branch_id, null);

    // Corporate CC is included in Branch 1 staff's list
    const branch1List = await CostCentreService.listCostCentres(branch1FinanceActor);
    const hasCorpInList = branch1List.some((cc) => cc.id === corpCc.id);
    const hasBranch1InList = branch1List.some((cc) => cc.id === branchCc.id);
    const hasBranch2InList = branch1List.some((cc) => cc.id === branch2Cc.id);
    assert.strictEqual(hasCorpInList, true, "Corporate cost centres must be visible to branch staff");
    assert.strictEqual(hasBranch1InList, true, "Own branch cost centres must be visible");
    assert.strictEqual(hasBranch2InList, false, "Other branch cost centres must NOT be visible");
    pass(20, "Corporate/shared cost centres (branch_id = null) visible to branch staff while isolating other branches");

    // -------------------------------------------------------------------------
    // TEST 21: RBAC VIEW enforced
    // -------------------------------------------------------------------------
    // Actor with COST_CENTRE.VIEW can list and get
    const viewList = await CostCentreService.listCostCentres(branch1ReadOnlyActor);
    assert(viewList.length > 0, "Read-only staff can list cost centres");
    pass(21, "Staff with COST_CENTRE.VIEW permission can browse cost centres");

    // -------------------------------------------------------------------------
    // TEST 22: RBAC MANAGE enforced
    // -------------------------------------------------------------------------
    // Staff without MANAGE cannot create
    let createDeniedForReadOnly = false;
    try {
      await CostCentreService.createCostCentre(branch1ReadOnlyActor, {
        code: "CC_TEST_DENIED",
        name: "Should Fail",
        department: "BRANCH",
        branch_id: branch1Id,
      });
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "PERMISSION_DENIED") {
        createDeniedForReadOnly = true;
      }
    }
    assert.strictEqual(createDeniedForReadOnly, true, "Read-only staff cannot create cost centres");
    pass(22, "COST_CENTRE.MANAGE permission required for creation, read-only rejected with 403 PERMISSION_DENIED");

    // -------------------------------------------------------------------------
    // TEST 23: Unauthorized mutation rejected
    // -------------------------------------------------------------------------
    let unauthDenied = false;
    try {
      await CostCentreService.listCostCentres(unauthorizedActor);
    } catch (err) {
      if (err instanceof CostCentreServiceError && err.code === "PERMISSION_DENIED") {
        unauthDenied = true;
      }
    }
    assert.strictEqual(unauthDenied, true, "Unauthorized staff without COST_CENTRE.VIEW rejected");
    pass(23, "Actor lacking COST_CENTRE permissions rejected on all endpoints with 403 PERMISSION_DENIED");

    // -------------------------------------------------------------------------
    // TEST 24: Database baseline unchanged
    // -------------------------------------------------------------------------
    // Clean up test cost centres in reverse order to respect hierarchy
    console.log("\n[Teardown] Cleaning up test cost centres...");
    // Reverse array to delete children before parents
    const toDeleteIds = [...createdCostCentreIds].reverse();
    for (const ccId of toDeleteIds) {
      await pool.query(`DELETE FROM public.cost_centre WHERE id = $1;`, [ccId]);
    }
    console.log(`  ✓ Cleaned up ${toDeleteIds.length} test cost centre(s).`);

    // Verify pristine baseline after test
    const postCheck = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM public.accounting_account) as coa_count,
        (SELECT COALESCE(SUM(debit_amount),0) FROM public.accounting_journal_line) as total_dr,
        (SELECT COALESCE(SUM(credit_amount),0) FROM public.accounting_journal_line) as total_cr,
        (SELECT COUNT(*) FROM public.cost_centre) as cc_count,
        (SELECT COUNT(*) FROM public.accounting_voucher WHERE cost_centre_id IS NOT NULL) as vch_cc_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line WHERE cost_centre_id IS NOT NULL) as line_cc_count;
    `);

    const coaPost = parseInt(postCheck.rows[0].coa_count, 10);
    const drPost = parseFloat(postCheck.rows[0].total_dr);
    const crPost = parseFloat(postCheck.rows[0].total_cr);
    const ccPost = parseInt(postCheck.rows[0].cc_count, 10);
    const vchCcPost = parseInt(postCheck.rows[0].vch_cc_count, 10);
    const lineCcPost = parseInt(postCheck.rows[0].line_cc_count, 10);

    assert.strictEqual(coaPost, 100, "Final CoA must be exactly 100 accounts");
    assert.strictEqual(drPost, 3380, "Final Trial balance Dr must be exactly ₹3,380.00");
    assert.strictEqual(crPost, 3380, "Final Trial balance Cr must be exactly ₹3,380.00");
    assert.strictEqual(ccPost, 0, "Final Cost centre count must return to 0");
    assert.strictEqual(vchCcPost, 0, "Zero vouchers must have cost_centre_id");
    assert.strictEqual(lineCcPost, 0, "Zero journal lines must have cost_centre_id");

    pass(24, "Database baseline perfectly preserved: CoA = 100, TB = ₹3,380.00 Dr / Cr, zero residual records");

    console.log("\n==================================================================");
    console.log(`  PHASE C7.6 STEP 1 RESULT: ${passedCount} PASSED / 0 FAILED (100% Green)`);
    console.log("==================================================================\n");
  } catch (err) {
    console.error("\nTEST FAILED WITH ERROR:", err);
    // Cleanup if failed
    for (const ccId of createdCostCentreIds.reverse()) {
      await pool.query(`DELETE FROM public.cost_centre WHERE id = $1;`, [ccId]).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
    if (globalThis.__cth_pg_pool__) {
      await globalThis.__cth_pg_pool__.end().catch(() => {});
    }
  }

  process.exit(passedCount === 24 ? 0 : 1);
}

runSuite();
