/**
 * CakeToHome Multi-Access Profile System End-to-End Automated Test Suite
 *
 * Tests:
 * 1. Initial seed profiles and many-to-many junction table initialization
 * 2. Permission union calculation & deduplication
 * 3. Create staff with multiple access profiles
 * 4. Verify effective authorization (UNION of permissions across profiles)
 * 5. Verify explicit staff DENY override priority
 * 6. Update staff profile assignments (atomic junction table transition)
 * 7. Archive protection validation
 * 8. Super Admin unrestricted authority preservation
 * 9. Security audit log verification
 */

import {
  StaffAccessControl,
  PERMISSION_CATALOG,
  SYSTEM_ACCESS_PROFILES,
} from "../src/lib/staff-access-control";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING MULTI-ACCESS PROFILE E2E VERIFICATION SUITE");
  console.log("=======================================================\n");

  // TEST 1: Initial Seed Profiles & Migration
  console.log("Test 1: Verifying Initial System Access Profiles & Pre-seeded Staff...");
  const profiles = StaffAccessControl.listProfiles();
  assert(profiles.length >= 6, `Expected at least 6 active profiles, found ${profiles.length}`);

  const staffList = StaffAccessControl.listStaffMembers();
  assert(staffList.length >= 4, `Expected at least 4 pre-seeded staff members, found ${staffList.length}`);

  const priya = staffList.find((s) => s.name === "Priya Sharma");
  assert(!!priya, "Priya Sharma staff member found");
  assert(Array.isArray(priya!.profile_ids) && priya!.profile_ids.includes("prof_telecaller"), "Priya has profile_ids containing 'prof_telecaller'");
  assert(Array.isArray(priya!.profile_names) && priya!.profile_names.includes("Telecaller"), "Priya has profile_names containing 'Telecaller'");

  const priyaAssignments = StaffAccessControl.getStaffJunctionAssignments(priya!.id);
  assert(priyaAssignments.length >= 1, `Priya has ${priyaAssignments.length} junction assignments`);
  assert(priyaAssignments[0].profile_id === "prof_telecaller", "Priya's junction assignment references 'prof_telecaller'");

  // TEST 2: Permission Union Calculation & Deduplication
  console.log("\nTest 2: Verifying Deduplicated Permission Union Calculation...");
  const testProfileIds = ["prof_telecaller", "prof_customer_support", "prof_digital_marketing"];
  const unionResult = StaffAccessControl.calculateProfileUnionPermissions(testProfileIds);

  const telecaller = profiles.find((p) => p.id === "prof_telecaller")!;
  const support = profiles.find((p) => p.id === "prof_customer_support")!;
  const marketing = profiles.find((p) => p.id === "prof_digital_marketing")!;

  const naiveSum = telecaller.permissions.length + support.permissions.length + marketing.permissions.length;
  console.log(`    - Telecaller permissions: ${telecaller.permissions.length}`);
  console.log(`    - Support permissions: ${support.permissions.length}`);
  console.log(`    - Digital Marketing permissions: ${marketing.permissions.length}`);
  console.log(`    - Naive Sum (with duplicates): ${naiveSum}`);
  console.log(`    - Deduplicated Union Count: ${unionResult.permissionCount}`);

  assert(unionResult.permissionCount < naiveSum, "Union calculation successfully deduplicates shared permissions");
  assert(unionResult.uniquePermissions.includes("TELEMARKETING.VIEW"), "Union includes Telecaller permission");
  assert(unionResult.uniquePermissions.includes("CUSTOMERS.SEARCH"), "Union includes Customer Support permission");
  assert(unionResult.uniquePermissions.includes("POPUPS.PUBLISH"), "Union includes Digital Marketing permission");

  // TEST 3: Create Staff with Multiple Profiles
  console.log("\nTest 3: Creating Staff Account with Multiple Access Profiles (John Doe)...");
  const newStaff = StaffAccessControl.createStaffMember({
    name: "John Doe",
    phone: "+91 99880 11223",
    email: "john.doe@cakes2home.com",
    accessProfileIds: ["prof_telecaller", "prof_customer_support", "prof_digital_marketing"],
    branch_name: "Koramangala Kitchen",
    city: "Bengaluru",
  });

  assert(newStaff.id.startsWith("staff_"), `Created staff ID: ${newStaff.id}`);
  assert(newStaff.profile_ids.length === 3, `Expected 3 assigned profile IDs, got ${newStaff.profile_ids.length}`);
  assert(newStaff.profile_names.length === 3, `Expected 3 profile names, got [${newStaff.profile_names.join(", ")}]`);

  const johnAssignments = StaffAccessControl.getStaffJunctionAssignments(newStaff.id);
  assert(johnAssignments.length === 3, `Junction table contains 3 records for John Doe`);

  // TEST 4: Effective Authorization Evaluation
  console.log("\nTest 4: Evaluating Effective Authorization for Combined Profiles...");
  assert(StaffAccessControl.hasPermission(newStaff, "TELEMARKETING", "VIEW"), "John Doe CAN VIEW Telemarketing queue (from Telecaller)");
  assert(StaffAccessControl.hasPermission(newStaff, "CUSTOMERS", "VIEW_PHONE"), "John Doe CAN VIEW Customer Phone (from Telecaller/Support)");
  assert(StaffAccessControl.hasPermission(newStaff, "MARKETING", "CREATE"), "John Doe CAN CREATE Marketing campaigns (from Digital Marketing)");
  assert(StaffAccessControl.hasPermission(newStaff, "POPUPS", "ANALYTICS"), "John Doe CAN VIEW Popup Analytics (from Digital Marketing)");
  assert(!StaffAccessControl.hasPermission(newStaff, "TAX_MASTER", "EDIT"), "John Doe CANNOT EDIT Tax Master (Unassigned - Fail Closed)");
  assert(!StaffAccessControl.hasPermission(newStaff, "BRANCHES", "EDIT"), "John Doe CANNOT EDIT Branches (Unassigned - Fail Closed)");

  // TEST 5: Explicit Staff Overrides
  console.log("\nTest 5: Setting Explicit Staff Overrides (DENY Precedence)...");
  StaffAccessControl.setStaffOverride(newStaff.id, "TELEMARKETING.EXPORT", "DENY");
  assert(!StaffAccessControl.hasPermission(newStaff, "TELEMARKETING", "EXPORT"), "Explicit staff DENY override blocks TELEMARKETING.EXPORT even though Telecaller profile allows it");
  assert(StaffAccessControl.hasPermission(newStaff, "TELEMARKETING", "VIEW"), "Other Telemarketing permissions remain active");

  // TEST 6: Atomic Update of Profile Assignments
  console.log("\nTest 6: Updating Staff Profile Assignments (Atomic Transition)...");
  const updatedStaff = StaffAccessControl.updateStaffMember(newStaff.id, {
    accessProfileIds: ["prof_seo_manager", "prof_content_manager"],
  });

  assert(updatedStaff.profile_ids.length === 2, `Expected 2 assigned profile IDs, got ${updatedStaff.profile_ids.length}`);
  assert(updatedStaff.profile_names.includes("SEO Manager"), "SEO Manager profile assigned");
  assert(updatedStaff.profile_names.includes("Content Manager"), "Content Manager profile assigned");

  const updatedAssignments = StaffAccessControl.getStaffJunctionAssignments(newStaff.id);
  assert(updatedAssignments.length === 2, `Junction table updated to exactly 2 records`);

  assert(StaffAccessControl.hasPermission(updatedStaff, "SEO", "VIEW"), "John Doe CAN VIEW SEO dashboard (new profile)");
  assert(StaffAccessControl.hasPermission(updatedStaff, "CMS", "CREATE"), "John Doe CAN CREATE CMS pages (new profile)");
  assert(!StaffAccessControl.hasPermission(updatedStaff, "TELEMARKETING", "VIEW"), "John Doe CAN NO LONGER VIEW Telemarketing (old profile removed)");

  // TEST 7: Archive Protection
  console.log("\nTest 7: Verifying Safe Deletion & Archiving Protection...");
  let archiveBlocked = false;
  try {
    StaffAccessControl.archiveProfile("prof_seo_manager");
  } catch (err: any) {
    archiveBlocked = true;
    console.log(`    - Archive blocked as expected: "${err.message}"`);
  }
  assert(archiveBlocked, "Profile archiving correctly rejected while assigned to active staff");

  // TEST 8: Super Admin Unrestricted Authority
  console.log("\nTest 8: Verifying Super Admin Authority...");
  assert(StaffAccessControl.hasPermission("admin_01", "TAX_MASTER", "EDIT"), "Super Admin has full access to TAX_MASTER.EDIT");
  assert(StaffAccessControl.hasPermission("admin_01", "ANY_CUSTOM_MODULE", "ANY_ACTION"), "Super Admin has full access to arbitrary modules");
  const adminEffective = StaffAccessControl.getEffectivePermissions("admin_01");
  assert(adminEffective.length === PERMISSION_CATALOG.length, `Super Admin has all ${PERMISSION_CATALOG.length} catalog permissions`);

  // TEST 9: Audit Trail Integrity
  console.log("\nTest 9: Verifying Security Audit Trail Logs...");
  const logs = StaffAccessControl.listAuditLogs();
  assert(logs.length >= 6, `Expected at least 6 audit logs, found ${logs.length}`);

  const createLog = logs.find((l) => l.action === "CREATE_STAFF" && l.target_name === "John Doe");
  assert(!!createLog, "Audit log recorded CREATE_STAFF for John Doe");

  const updateLog = logs.find((l) => l.action === "UPDATE_STAFF_PROFILES" && l.target_name === "John Doe");
  assert(!!updateLog, "Audit log recorded UPDATE_STAFF_PROFILES for John Doe");

  console.log("\n=======================================================");
  console.log("🎉 ALL MULTI-ACCESS PROFILE UNIT & E2E TESTS PASSED (100%)");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
