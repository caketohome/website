/**
 * CAKETOHOME — E2E TEST SUITE: BRANCH / FULFILLMENT HUB CREATION & MANAGEMENT
 * 
 * Verifies:
 * 1. GET /api/v1/admin/branches returns 200 OK and active branch list
 * 2. POST /api/v1/admin/branches creates new branch returning 201 Created with full payload
 * 3. Persistence verification across queries
 * 4. Manager account synchronization (StaffAccessControl / BRANCH_MANAGER)
 * 5. City & Pincode validation and resolution
 * 6. Duplicate branch code rejection (409 Conflict / 400 Bad Request)
 * 7. Missing required field validation (400 Bad Request)
 * 8. PUT /api/v1/admin/branches update flow (200 OK)
 * 9. DELETE /api/v1/admin/branches archive flow (200 OK)
 * 10. Direct ApiEngine unit verification
 */

import { ApiEngine } from "../src/lib/api-engine";
import { StaffAccessControl } from "../src/lib/staff-access-control";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail || "");
    failCount++;
  }
}

async function runBranchCreationE2ETests() {
  console.log("===============================================================");
  console.log("🚀 STARTING E2E TEST SUITE: BRANCH & FULFILLMENT HUB CREATION");
  console.log("===============================================================\n");

  const baseUrl = "http://localhost:3000/api/v1";

  // ── TEST 1: Initial Branches Fetch ──
  console.log("--- Test 1: GET /api/v1/admin/branches ---");
  try {
    const res = await fetch(`${baseUrl}/admin/branches`);
    assert(res.status === 200, "GET /admin/branches status is 200 OK", res.status);
    const data: any = await res.json();
    assert(Array.isArray(data.branches), "Response contains branches array");
    assert(data.branches.length > 0, "Branches array is non-empty", data.branches.length);
  } catch (err: any) {
    assert(false, "GET /admin/branches request succeeded", err.message);
  }

  // ── TEST 2: Valid Branch Creation (201 Created) ──
  console.log("\n--- Test 2: POST /api/v1/admin/branches (Create Fulfillment Hub) ---");
  const testBranchCode = `HUB-TEST-${Date.now().toString().slice(-4)}`;
  const createPayload = {
    code: testBranchCode,
    name: "Whitefield Tech Hub",
    branch_type: "main_hub",
    extended_status: "open",
    operational_status: "operational",
    address: "ITPB Main Road, Whitefield",
    city: "Bengaluru",
    city_id: "city_bbr",
    state: "Karnataka",
    pincode: "560066",
    phone: "+91 98765 99887",
    email: `whitefield_${Date.now()}@cakes2home.com`,
    manager_name: "Vikram Malhotra",
    manager_account: {
      name: "Vikram Malhotra",
      phone: "+91 98765 99887",
      email: `vikram_${Date.now()}@cakes2home.com`,
      status: "active"
    },
    capacity_settings: {
      max_hourly_orders: 30,
      max_simultaneous_orders: 20,
      max_scheduled_orders: 60,
      max_express_orders: 25,
      max_midnight_orders: 15,
      busy_threshold: 85,
      emergency_stop: false,
      current_load: 0,
      auto_pause_enabled: true,
      is_auto_paused: false,
    },
    is_open: true,
  };

  let createdBranchId: string | null = null;
  try {
    const res = await fetch(`${baseUrl}/admin/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload)
    });
    assert(res.status === 201, "POST /admin/branches returns 201 Created", res.status);
    const data: any = await res.json();
    assert(data.success === true, "Response success is true");
    assert(data.branch !== undefined, "Response contains created branch object");
    assert(data.branch.code === testBranchCode, "Branch code matches payload", data.branch?.code);
    assert(data.branch.name === "Whitefield Tech Hub", "Branch name matches payload", data.branch?.name);
    assert(data.branch.pincode === "560066", "Branch pincode normalized", data.branch?.pincode);
    assert(data.branch.manager_name === "Vikram Malhotra", "Branch manager name matches", data.branch?.manager_name);
    assert(Array.isArray(data.branch.delivery_zones) && data.branch.delivery_zones.length > 0, "Default primary delivery zone auto-initialized");
    
    createdBranchId = data.branch.id;
  } catch (err: any) {
    assert(false, "POST /admin/branches request succeeded", err.message);
  }

  // ── TEST 3: Persistence & Retrieval ──
  console.log("\n--- Test 3: Verify Persistence of Created Branch ---");
  try {
    const res = await fetch(`${baseUrl}/admin/branches`);
    const data: any = await res.json();
    const found = data.branches.find((b: any) => b.id === createdBranchId || b.code === testBranchCode);
    assert(Boolean(found), "Newly created branch is present in GET /admin/branches list", found?.id);
    assert(found?.status === "active", "Newly created branch status is active", found?.status);
  } catch (err: any) {
    assert(false, "Persistence check query succeeded", err.message);
  }

  // ── TEST 4: Manager Account Synchronization ──
  console.log("\n--- Test 4: Verify Staff Manager Account Synchronization ---");
  try {
    // 1. Verify via API response & branch record
    const res = await fetch(`${baseUrl}/admin/branches`);
    const data: any = await res.json();
    const branch = data.branches.find((b: any) => b.id === createdBranchId || b.code === testBranchCode);
    assert(Boolean(branch?.manager_user_id), "Branch linked to canonical staff user ID", branch?.manager_user_id);
    assert(branch?.manager_account?.name === "Vikram Malhotra", "Branch manager account name matches", branch?.manager_account?.name);
    assert(branch?.manager_account?.status === "active", "Branch manager account status is active", branch?.manager_account?.status);
  } catch (err: any) {
    assert(false, "Staff manager profile check succeeded", err.message);
  }

  // ── TEST 5: Duplicate Branch Code Rejection (409 Conflict) ──
  console.log("\n--- Test 5: Rejection of Duplicate Branch Code ---");
  try {
    const duplicatePayload = {
      ...createPayload,
      name: "Duplicate Whitefield Hub",
      phone: "+91 98765 11111",
      email: "duplicate@cakes2home.com",
    };
    const res = await fetch(`${baseUrl}/admin/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(duplicatePayload)
    });
    assert(res.status === 409 || res.status === 400, "Duplicate branch code is rejected with 409/400", res.status);
    const data: any = await res.json();
    assert(data.success === false, "Duplicate response success is false");
    assert(Boolean(data.error) && data.error.includes("already exists"), "Duplicate error message identifies existing code", data.error);
  } catch (err: any) {
    assert(false, "Duplicate branch code test succeeded", err.message);
  }

  // ── TEST 6: Invalid Pincode Validation ──
  console.log("\n--- Test 6: Rejection of Invalid Pincode ---");
  try {
    const invalidPinPayload = {
      ...createPayload,
      code: `HUB-INV-${Date.now().toString().slice(-4)}`,
      pincode: "1234", // Invalid: only 4 digits
    };
    const res = await fetch(`${baseUrl}/admin/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPinPayload)
    });
    assert(res.status === 400, "Invalid pincode returns 400 Bad Request", res.status);
    const data: any = await res.json();
    assert(Boolean(data.error) && data.error.includes("pincode"), "Error message specifies pincode validation issue", data.error);
  } catch (err: any) {
    assert(false, "Invalid pincode test succeeded", err.message);
  }

  // ── TEST 7: Missing Required Fields Validation ──
  console.log("\n--- Test 7: Rejection of Missing Hub Name ---");
  try {
    const missingNamePayload = {
      ...createPayload,
      code: `HUB-NONAME-${Date.now().toString().slice(-4)}`,
      name: "", // Invalid empty name
    };
    const res = await fetch(`${baseUrl}/admin/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(missingNamePayload)
    });
    assert(res.status === 400, "Empty hub name returns 400 Bad Request", res.status);
    const data: any = await res.json();
    assert(Boolean(data.error) && data.error.includes("name"), "Error message specifies name requirement", data.error);
  } catch (err: any) {
    assert(false, "Missing hub name test succeeded", err.message);
  }

  // ── TEST 8: Branch Update (PUT 200 OK) ──
  console.log("\n--- Test 8: PUT /api/v1/admin/branches (Update Branch) ---");
  try {
    const updatePayload = {
      id: createdBranchId,
      name: "Whitefield Premium Delivery Hub",
      phone: "+91 98765 99880",
      extended_status: "open",
      capacity_settings: {
        max_hourly_orders: 45,
        max_simultaneous_orders: 25,
        max_scheduled_orders: 80,
        max_express_orders: 30,
        max_midnight_orders: 20,
        busy_threshold: 90,
        emergency_stop: false,
        current_load: 5,
        auto_pause_enabled: true,
        is_auto_paused: false,
      }
    };
    const res = await fetch(`${baseUrl}/admin/branches`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload)
    });
    assert(res.status === 200, "PUT /admin/branches returns 200 OK", res.status);
    const data: any = await res.json();
    assert(data.success === true, "Update response success is true");
    assert(data.branch?.name === "Whitefield Premium Delivery Hub", "Branch name updated", data.branch?.name);
    assert(data.branch?.capacity_settings?.max_hourly_orders === 45, "Capacity settings updated", data.branch?.capacity_settings?.max_hourly_orders);
  } catch (err: any) {
    assert(false, "Branch update test succeeded", err.message);
  }

  // ── TEST 9: Branch Archival (DELETE 200 OK) ──
  console.log("\n--- Test 9: DELETE /api/v1/admin/branches (Archive Branch) ---");
  try {
    const res = await fetch(`${baseUrl}/admin/branches?id=${createdBranchId}`, {
      method: "DELETE"
    });
    assert(res.status === 200, "DELETE /admin/branches returns 200 OK", res.status);
    const data: any = await res.json();
    assert(data.success === true, "Archive response success is true");
    assert(Boolean(data.branch?.is_archived || data.branch?.status === "archived" || data.success), "Branch marked as archived");

    // Fetch branches to verify archived state
    const listRes = await fetch(`${baseUrl}/admin/branches`);
    const listData: any = await listRes.json();
    const branchInList = listData.branches.find((b: any) => b.id === createdBranchId);
    assert(Boolean(branchInList?.is_archived || branchInList?.status === "archived"), "Branch in list marked archived");
  } catch (err: any) {
    assert(false, "Branch archive test succeeded", err.message);
  }

  // ── TEST 10: ApiEngine Direct Service Verification ──
  console.log("\n--- Test 10: Direct ApiEngine Unit Assertions ---");
  const directBranch = ApiEngine.saveBranch({
    code: `HUB-UNIT-${Date.now().toString().slice(-4)}`,
    name: "Jayanagar Artisan Bakery Hub",
    city: "Bengaluru",
    pincode: "560041",
    manager_name: "Ananya Sharma",
    phone: "+91 98765 22334",
  });
  assert(Boolean(directBranch && directBranch.id), "ApiEngine.saveBranch creates branch object with id", directBranch?.id);
  assert(directBranch.city_id === "city_bbr" || directBranch.city === "Bengaluru", "City mapped correctly");
  assert(directBranch.delivery_zones.length >= 1, "Delivery zones initialized");

  const inProcStaff = StaffAccessControl.listStaffMembers();
  const staffMember = inProcStaff.find((s: any) => s.branch_id === directBranch.id);
  assert(Boolean(staffMember), "StaffAccessControl profile created in unit invocation", staffMember?.user_id);
  assert(staffMember?.role === "BRANCH_MANAGER", "StaffAccessControl role is BRANCH_MANAGER", staffMember?.role);

  // Cleanup unit branch
  ApiEngine.archiveBranch(directBranch.id);

  console.log("\n===============================================================");
  console.log(`🏁 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("===============================================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBranchCreationE2ETests();
