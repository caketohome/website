/**
 * CakeToHome Identity, Profile & Role Isolation Automated Regression Suite
 * 
 * Verifies:
 * 1. Phone 9000000001 -> Customer Alex Johnson (CUSTOMER)
 * 2. Phone 9000000002 -> Delivery Partner Suresh Kumar (DELIVERY_PARTNER)
 * 3. Phone 9000000003 -> Store Manager Rahul Kumar (BRANCH_MANAGER)
 * 4. User IDs are completely isolated (USER A != USER B != USER C)
 * 5. Roles come strictly from server identity (CUSTOMER != DELIVERY_PARTNER != BRANCH_MANAGER)
 * 6. New unregistered phone 9876500099 receives a unique customer ID (never Alex Johnson)
 * 7. Zero fallback to Alex Johnson or Suresh Kumar across logins
 */

import { ApiEngine } from "../src/lib/api-engine";

async function runAuthRoleIsolationTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — IDENTITY, PROFILE & ROLE ISOLATION REGRESSION TEST SUITE");
  console.log("================================================================ algorithm:\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details || ""}`);
      failed++;
    }
  }

  // Ensure initial test accounts exist in ApiEngine persistent memory
  ApiEngine.ensureDeliveryPartnersStore();

  const phoneCustomer = "+91 90000 00001";
  const phoneDriver = "+91 90000 00002";
  const phoneManager = "+91 90000 00003";
  const phoneNewGuest = "+91 98765 00099";

  // Register Delivery Partner Suresh Kumar for phone 9000000002 if not present
  const partners = ApiEngine.listDeliveryPartners();
  let driverRecord = partners.find((p: any) => (p.phone || "").replace(/\D/g, "").endsWith("9000000002"));
  if (!driverRecord) {
    driverRecord = {
      id: "dlp_driver_9000000002",
      partner_number: "CTH-DP-900002",
      name: "Suresh Kumar",
      full_name: "Suresh Kumar",
      first_name: "Suresh",
      last_name: "Kumar",
      phone: "+91 90000 00002",
      email: "suresh.kumar@cakes2home.com",
      status: "active",
      availability_status: "ONLINE",
      primary_branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      primary_branch_name: "Indiranagar Flagship Kitchen",
    };
    partners.push(driverRecord);
    ApiEngine.persist();
  }

  // Register Store Manager Rahul Kumar for phone 9000000003 if not present
  const rawBranch = ApiEngine.getBranchById("br_indiranagar") || ApiEngine.getBranchById("res_01KXYMAHGFPRY1G9TZKEVGAGAT") || ApiEngine.listBranches()[0];
  const mgrAccount = {
    id: "shpmgr_manager_9000000003",
    employee_id: "EMP-9003",
    name: "Rahul Kumar",
    phone: "+91 90000 00003",
    email: "rahul.kumar@cakes2home.com",
    role: "BRANCH_MANAGER",
    status: "active",
  };
  rawBranch.manager_account = mgrAccount;
  rawBranch.manager_name = "Rahul Kumar";
  rawBranch.phone = "+91 90000 00003";
  ApiEngine.persist();

  // Register Customer Alex Johnson for phone 9000000001
  let custInStore = (ApiEngine.listCustomers() || []).find((c: any) => (c.phone || "").replace(/\D/g, "").endsWith("9000000001"));
  if (custInStore) {
    custInStore.name = "Alex Johnson";
    custInStore.first_name = "Alex";
    custInStore.last_name = "Johnson";
    custInStore.email = "alex.johnson@cakes2home.com";
  } else {
    custInStore = ApiEngine.createCustomerAccount({
      phone: "+91 90000 00001",
      name: "Alex Johnson",
      email: "alex.johnson@cakes2home.com",
    });
  }
  ApiEngine.persist();

  // ── TEST 1: Customer Account OTP Verification ──
  console.log("TEST GROUP 1: Customer Authentication (9000000001)");
  const authCust = ApiEngine.verifyOtp(phoneCustomer, "123456");
  assert(authCust.success === true, "Customer OTP verification succeeds");
  assert(authCust.role === "CUSTOMER", "Customer role resolved as CUSTOMER");
  assert(authCust.user.name === "Alex Johnson", "Customer profile name is Alex Johnson");
  assert(authCust.user.phone.replace(/\D/g, "").endsWith("9000000001"), "Customer phone matches 9000000001");

  // ── TEST 2: Delivery Partner OTP Verification ──
  console.log("\nTEST GROUP 2: Delivery Partner Authentication (9000000002)");
  const authDriver = ApiEngine.verifyOtp(phoneDriver, "123456");
  assert(authDriver.success === true, "Delivery Partner OTP verification succeeds");
  assert(authDriver.role === "DELIVERY_PARTNER", "Delivery Partner role resolved as DELIVERY_PARTNER");
  assert(authDriver.user.name === "Suresh Kumar", "Delivery Partner profile name is Suresh Kumar");
  assert(authDriver.user.name !== "Alex Johnson", "Delivery Partner DOES NOT return Alex Johnson");
  assert(authDriver.user.phone.replace(/\D/g, "").endsWith("9000000002"), "Delivery Partner phone matches 9000000002");

  // ── TEST 3: Branch Manager OTP Verification ──
  console.log("\nTEST GROUP 3: Branch Manager Authentication (9000000003)");
  const authManager = ApiEngine.verifyOtp(phoneManager, "123456");
  assert(authManager.success === true, "Branch Manager OTP verification succeeds");
  assert(authManager.role === "BRANCH_MANAGER", "Branch Manager role resolved as BRANCH_MANAGER");
  assert(authManager.user.name === "Rahul Kumar", "Branch Manager profile name is Rahul Kumar");
  assert(authManager.user.name !== "Alex Johnson", "Branch Manager DOES NOT return Alex Johnson");
  assert(authManager.user.phone.replace(/\D/g, "").endsWith("9000000003"), "Branch Manager phone matches 9000000003");

  // ── TEST 4: Cross-Account Identity & Role Isolation ──
  console.log("\nTEST GROUP 4: Identity & Role Isolation Verification");
  assert(authCust.user.id !== authDriver.user.id, "Customer User ID != Delivery Partner User ID");
  assert(authCust.user.id !== authManager.user.id, "Customer User ID != Branch Manager User ID");
  assert(authDriver.user.id !== authManager.user.id, "Delivery Partner User ID != Branch Manager User ID");
  assert(authCust.role !== authDriver.role, "Customer Role != Delivery Partner Role");
  assert(authCust.role !== authManager.role, "Customer Role != Branch Manager Role");

  // ── TEST 5: New Guest Customer Verification ──
  console.log("\nTEST GROUP 5: New Unregistered Phone Verification (9876500099)");
  const authGuest = ApiEngine.verifyOtp(phoneNewGuest, "123456");
  assert(authGuest.success === true, "New Guest OTP verification succeeds");
  assert(authGuest.role === "CUSTOMER", "New Guest role resolved as CUSTOMER");
  assert(authGuest.user.id === "cus_9876500099", "New Guest receives distinct ID cus_9876500099");
  assert(authGuest.user.name !== "Alex Johnson", "New Guest profile IS NOT Alex Johnson");

  // ── TEST 6: User Resolution by Session ID ──
  console.log("\nTEST GROUP 6: Session User Account Resolution");
  const resCust = ApiEngine.resolveUserAccount({ userId: authCust.user.id });
  const resDriver = ApiEngine.resolveUserAccount({ userId: authDriver.user.id });
  const resManager = ApiEngine.resolveUserAccount({ userId: authManager.user.id });

  assert(resCust?.name === "Alex Johnson" && resCust?.role === "CUSTOMER", "Session resolution for Customer is Alex Johnson (CUSTOMER)");
  assert(resDriver?.name === "Suresh Kumar" && resDriver?.role === "DELIVERY_PARTNER", "Session resolution for Driver is Suresh Kumar (DELIVERY_PARTNER)");
  assert(resManager?.name === "Rahul Kumar" && resManager?.role === "BRANCH_MANAGER", "Session resolution for Manager is Rahul Kumar (BRANCH_MANAGER)");

  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================ algorithm:\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthRoleIsolationTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
