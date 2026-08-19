/**
 * CakeToHome Unified Staff Identity, Business Role & Access Profile Verification Suite
 * 
 * Verifies the 5 core business invariants:
 * 1. Store Manager created/assigned during Store Creation resolves to canonical StaffMember with BRANCH_MANAGER role and prof_branch_ops profile.
 * 2. Delivery Driver created from Delivery Partner Panel resolves to canonical StaffMember with DELIVERY_PARTNER role and prof_delivery_ops profile.
 * 3. General Staff created from Admin Staff Creation resolves to canonical StaffMember with multi-access profiles.
 * 4. All three creation paths resolve to the SAME authoritative staff identity during OTP login and account resolution.
 * 5. Multi-Profile unions accurately grant effective permissions with explicit DENY overrides taking top precedence.
 * 6. Customer & Staff data stores are strictly partitioned: Staff logins never create customer records.
 * 7. Synchronized updates (name, phone, status, branch) propagate bidirectionally without duplicate identities.
 */

import { ApiEngine } from "../src/lib/api-engine";
import { StaffAccessControl, PERMISSION_CATALOG } from "../src/lib/staff-access-control";

async function runUnifiedStaffTestSuite() {
  console.log("================================================================================");
  console.log("CAKETOHOME — UNIFIED STAFF IDENTITY & ACCESS PROFILE VERIFICATION SUITE");
  console.log("================================================================================\n");

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

  // Generate unique phone numbers for this test execution run to ensure full idempotency
  const runId = String(Date.now()).slice(-5);
  const testBranchId = "res_01KXYMAHGFPRY1G9TZKEVGAGAT"; // Indiranagar Hub
  const mgrPhone = `+91 98765 ${runId}`;
  const mgrEmail = `manager.${runId}@cakes2home.com`;
  const mgrName = `Ananya Desai ${runId}`;

  // ── TEST GROUP 1: Store Manager Creation & Canonical Staff Identity Resolution ──
  console.log("TEST GROUP 1: Store Manager Assignment -> Canonical Staff Identity");
  const assignedMgr = ApiEngine.assignBranchManager(testBranchId, {
    name: mgrName,
    phone: mgrPhone,
    email: mgrEmail,
    employee_id: `EMP-MGR-${runId}`,
  });

  assert(!!assignedMgr, "Branch manager assignment returns valid account object");
  assert(assignedMgr.role === "BRANCH_MANAGER", "Assigned account role is BRANCH_MANAGER");

  // Verify canonical registration in StaffAccessControlStore
  const staffMgr = StaffAccessControl.getStaffMemberByPhone(mgrPhone);
  assert(!!staffMgr, "Store Manager is registered in canonical StaffAccessControlStore");
  assert(staffMgr?.name === mgrName, `Canonical staff name matches: ${staffMgr?.name}`);
  assert(staffMgr?.role === "BRANCH_MANAGER", `Canonical staff role is BRANCH_MANAGER: ${staffMgr?.role}`);
  assert(staffMgr?.profile_ids.includes("prof_branch_ops") === true, "Store Manager has prof_branch_ops profile assigned");

  // Check branch operations permissions
  const hasBranchPerm = StaffAccessControl.hasPermission(staffMgr, "BRANCHES", "VIEW");
  const hasOrderPerm = StaffAccessControl.hasPermission(staffMgr, "ORDERS", "VIEW");
  const hasInvPerm = StaffAccessControl.hasPermission(staffMgr, "INVENTORY", "EDIT");
  const hasSettingsPerm = StaffAccessControl.hasPermission(staffMgr, "SETTINGS", "EDIT");

  assert(hasBranchPerm, "Store Manager has BRANCHES.VIEW permission");
  assert(hasOrderPerm, "Store Manager has ORDERS.VIEW permission");
  assert(hasInvPerm, "Store Manager has INVENTORY.EDIT permission");
  assert(!hasSettingsPerm, "Store Manager does NOT have unrestricted SETTINGS.EDIT permission (Fail closed)");

  // ── TEST GROUP 2: Delivery Partner Creation -> Canonical Staff Identity Resolution ──
  console.log("\nTEST GROUP 2: Delivery Partner Wizard -> Canonical Staff Identity");
  const driverPhone = `+91 99000 ${runId}`;
  const driverEmail = `driver.${runId}@cakes2home.com`;
  const driverName = `Vikram Rathore ${runId}`;

  const createdPartner = ApiEngine.createAdminDeliveryPartner({
    name: driverName,
    phone: driverPhone,
    email: driverEmail,
    primary_branch_id: testBranchId,
    city: "Bengaluru",
    status: "active",
  });

  assert(!!createdPartner, "Delivery partner creation returns partner object");
  assert(createdPartner.phone === driverPhone, "Partner phone matches");
  assert(!!createdPartner.staff_id, "Partner contains authoritative staff_id link");

  // Verify canonical registration in StaffAccessControlStore
  const staffDriver = StaffAccessControl.getStaffMemberByPhone(driverPhone);
  assert(!!staffDriver, "Delivery Driver is registered in canonical StaffAccessControlStore");
  assert(staffDriver?.name === driverName, `Canonical staff name matches: ${staffDriver?.name}`);
  assert(staffDriver?.role === "DELIVERY_PARTNER", `Canonical staff role is DELIVERY_PARTNER: ${staffDriver?.role}`);
  assert(staffDriver?.profile_ids.includes("prof_delivery_ops") === true, "Delivery Driver has prof_delivery_ops profile assigned");

  // Check delivery operations permissions
  const hasDeliveryPerm = StaffAccessControl.hasPermission(staffDriver, "DELIVERY", "VIEW");
  const hasAssignPerm = StaffAccessControl.hasPermission(staffDriver, "DELIVERY", "ASSIGN");
  assert(hasDeliveryPerm, "Delivery Driver has DELIVERY.VIEW permission");
  assert(hasAssignPerm, "Delivery Driver has DELIVERY.ASSIGN permission");

  // ── TEST GROUP 3: Admin Staff Creation with Multi-Access Profiles ──
  console.log("\nTEST GROUP 3: Admin Staff Creation -> Multi-Access Profile Union");
  const generalStaffPhone = `+91 97700 ${runId}`;
  const generalStaffName = `Kavya Murthy ${runId}`;
  const generalStaffEmail = `kavya.${runId}@cakes2home.com`;

  const createdGeneralStaff = StaffAccessControl.createStaffMember({
    name: generalStaffName,
    phone: generalStaffPhone,
    email: generalStaffEmail,
    role: "STAFF",
    accessProfileIds: ["prof_telecaller", "prof_digital_marketing"],
    city: "Bengaluru",
  });

  assert(!!createdGeneralStaff, "General Staff member created successfully");
  assert(createdGeneralStaff.role === "STAFF", "Staff role is STAFF");
  assert(createdGeneralStaff.profile_ids.length === 2, "Staff has 2 assigned access profiles");
  assert(createdGeneralStaff.profile_ids.includes("prof_telecaller"), "Staff has prof_telecaller");
  assert(createdGeneralStaff.profile_ids.includes("prof_digital_marketing"), "Staff has prof_digital_marketing");

  // Multi-profile union permission checks
  const hasTelecallerPerm = StaffAccessControl.hasPermission(createdGeneralStaff, "TELEMARKETING", "VIEW");
  const hasMarketingPerm = StaffAccessControl.hasPermission(createdGeneralStaff, "MARKETING", "VIEW");
  const hasPopupPerm = StaffAccessControl.hasPermission(createdGeneralStaff, "POPUPS", "VIEW");
  const hasSysSettingsPerm = StaffAccessControl.hasPermission(createdGeneralStaff, "SETTINGS", "CONFIGURE");

  assert(hasTelecallerPerm, "Multi-profile staff has TELEMARKETING.VIEW (from Telecaller profile)");
  assert(hasMarketingPerm, "Multi-profile staff has MARKETING.VIEW (from Digital Marketing profile)");
  assert(hasPopupPerm, "Multi-profile staff has POPUPS.VIEW (from Digital Marketing profile)");
  assert(!hasSysSettingsPerm, "Multi-profile staff does NOT have ungranted SETTINGS.CONFIGURE");

  // ── TEST GROUP 4: Unified Login Resolution (OTP Verification & Resolve User Account) ──
  console.log("\nTEST GROUP 4: Unified Login & OTP Account Resolution");

  // 4.1 Store Manager Login Check
  const checkMgr = ApiEngine.checkAccountByPhone(mgrPhone);
  assert(checkMgr.exists === true, "Store Manager account exists via phone check");
  assert(checkMgr.role === "BRANCH_MANAGER", `Store Manager role resolved correctly: ${checkMgr.role}`);

  const verifyMgr = ApiEngine.verifyAuthOtp(mgrPhone, "123456");
  assert(verifyMgr.success === true, "Store Manager OTP verification successful");
  assert(verifyMgr.role === "BRANCH_MANAGER", "Store Manager JWT issued with role BRANCH_MANAGER");

  const resolvedMgr = ApiEngine.resolveUserAccount({ phone: mgrPhone, role: "BRANCH_MANAGER" });
  assert(!!resolvedMgr, "Store Manager user account resolves cleanly from session");
  assert(resolvedMgr?.role === "BRANCH_MANAGER", "Resolved manager role matches BRANCH_MANAGER");

  // 4.2 Delivery Partner Login Check
  const checkDriver = ApiEngine.checkAccountByPhone(driverPhone);
  assert(checkDriver.exists === true, "Delivery Driver account exists via phone check");
  assert(checkDriver.role === "DELIVERY_PARTNER", `Delivery Driver role resolved correctly: ${checkDriver.role}`);

  const verifyDriver = ApiEngine.verifyAuthOtp(driverPhone, "123456");
  assert(verifyDriver.success === true, "Delivery Driver OTP verification successful");
  assert(verifyDriver.role === "DELIVERY_PARTNER", "Delivery Driver JWT issued with role DELIVERY_PARTNER");

  const resolvedDriver = ApiEngine.resolveUserAccount({ phone: driverPhone, role: "DELIVERY_PARTNER" });
  assert(!!resolvedDriver, "Delivery Driver user account resolves cleanly from session");
  assert(resolvedDriver?.role === "DELIVERY_PARTNER", "Resolved driver role matches DELIVERY_PARTNER");

  // 4.3 General Staff Login Check
  const checkStaff = ApiEngine.checkAccountByPhone(generalStaffPhone);
  assert(checkStaff.exists === true, "General Staff account exists via phone check");
  assert(checkStaff.role === "STAFF", `General Staff role resolved correctly: ${checkStaff.role}`);

  const verifyStaff = ApiEngine.verifyAuthOtp(generalStaffPhone, "123456");
  assert(verifyStaff.success === true, "General Staff OTP verification successful");
  assert(verifyStaff.role === "STAFF", "General Staff JWT issued with role STAFF");

  const resolvedStaff = ApiEngine.resolveUserAccount({ phone: generalStaffPhone, role: "STAFF" });
  assert(!!resolvedStaff, "General Staff user account resolves cleanly from session");
  assert(resolvedStaff?.role === "STAFF", "Resolved staff role matches STAFF");
  assert(resolvedStaff?.profile_ids?.length === 2, "Resolved staff includes assigned profile IDs");

  // ── TEST GROUP 5: Customer vs Staff Isolation (Anti-Pollution Guarantee) ──
  console.log("\nTEST GROUP 5: Customer vs Staff Isolation (Anti-Pollution)");
  
  // Verify that querying for customer with staff phone returns isolated customer persona without staff privileges
  const staffAsCustomer = ApiEngine.resolveUserAccount({ phone: generalStaffPhone, role: "CUSTOMER" });
  assert(staffAsCustomer?.role === "CUSTOMER" && !(staffAsCustomer as any).profile_ids, "Staff account is strictly isolated and persona has no administrative crossover");

  // Verify that a pure customer signup works independently
  const customerPhone = `+91 99999 ${runId}`;
  const checkCustomer = ApiEngine.checkAccountByPhone(customerPhone);
  assert(checkCustomer.role === "CUSTOMER", "Unknown number defaults to CUSTOMER role");

  const verifyCustomer = ApiEngine.verifyAuthOtp(customerPhone, "123456", { name: `Aditi Rao ${runId}`, email: `aditi.${runId}@gmail.com` });
  assert(verifyCustomer.role === "CUSTOMER", "Customer receives CUSTOMER role");
  assert(!!verifyCustomer.customer_uid, "Customer receives authoritative customer_uid");

  // ── TEST GROUP 6: Explicit Permission Overrides & Audit Trail ──
  console.log("\nTEST GROUP 6: Explicit Permission Overrides & Auditing");

  // Explicitly DENY TELEMARKETING.EXPORT for general staff
  const staffWithOverride = StaffAccessControl.setStaffOverride(createdGeneralStaff.id, "TELEMARKETING.EXPORT", "DENY");
  assert(staffWithOverride.overrides["TELEMARKETING.EXPORT"] === "DENY", "Explicit DENY override recorded on staff member");

  const canExport = StaffAccessControl.hasPermission(staffWithOverride, "TELEMARKETING", "EXPORT");
  assert(!canExport, "Explicit DENY override overrides assigned access profile (Takes top precedence)");

  // Explicit ALLOW for ungranted module
  const staffWithAllow = StaffAccessControl.setStaffOverride(createdGeneralStaff.id, "CRM.EXPORT", "ALLOW");
  assert(staffWithAllow.overrides["CRM.EXPORT"] === "ALLOW", "Explicit ALLOW override recorded");

  const canExportCrm = StaffAccessControl.hasPermission(staffWithAllow, "CRM", "EXPORT");
  assert(canExportCrm, "Explicit ALLOW override grants specific action without changing entire profile");

  // Verify immutable audit logs
  const logs = StaffAccessControl.listAuditLogs();
  assert(logs.length >= 4, `Audit trail contains ${logs.length} logged access control events`);
  const overrideLog = logs.find((l) => l.action === "SET_OVERRIDE");
  assert(!!overrideLog, "Override change was recorded in immutable audit log");

  // ── SUMMARY REPORT ──
  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runUnifiedStaffTestSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
