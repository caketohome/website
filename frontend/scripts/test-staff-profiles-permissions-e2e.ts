/**
 * CakeToHome Staff Profiles & Feature-Level Permissions E2E Test Suite
 * Run with: npx tsx scripts/test-staff-profiles-permissions-e2e.ts
 */

import { StaffAccessControl, SYSTEM_ACCESS_PROFILES, PERMISSION_CATALOG } from "../src/lib/staff-access-control";

async function runStaffProfilesPermissionTests() {
  console.log("================================================================================");
  console.log("CAKETOHOME — STAFF PROFILES & FEATURE-LEVEL PERMISSION SYSTEM VERIFICATION");
  console.log("================================================================================\n");

  const results: Record<string, "PASS" | "FAIL"> = {
    profile_creation_and_crud: "FAIL",
    safe_profile_archiving: "FAIL",
    default_deny_architecture: "FAIL",
    permission_priority_hierarchy: "FAIL",
    telecaller_permissions_and_scope: "FAIL",
    digital_marketing_permissions: "FAIL",
    seo_and_content_templates: "FAIL",
    staff_explicit_overrides: "FAIL",
    dynamic_tab_permission_guard: "FAIL",
    permission_audit_logging: "FAIL",
    super_admin_unrestricted_authority: "FAIL",
  };

  // ── 1. Profile Creation & CRUD ─────────────────────────────────────────────
  console.log("1. Testing Profile Creation, Editing, Duplication & Listing...");
  try {
    const createdProfile = StaffAccessControl.createProfile({
      name: "Custom Kitchen Supervisor",
      description: "Supervises kitchen batches and cake baking operations",
      permissions: ["ORDERS.VIEW", "ORDERS.VIEW_DETAILS", "INVENTORY.VIEW", "INVENTORY.EDIT"],
    });

    const updatedProfile = StaffAccessControl.updateProfile(createdProfile.id, {
      description: "Updated kitchen supervisor description",
      permissions: ["ORDERS.VIEW", "ORDERS.VIEW_DETAILS", "INVENTORY.VIEW", "INVENTORY.EDIT", "BRANCHES.VIEW"],
    });

    const duplicatedProfile = StaffAccessControl.duplicateProfile(createdProfile.id);

    const profiles = StaffAccessControl.listProfiles();
    const hasNew = profiles.some((p) => p.id === createdProfile.id);
    const hasDup = profiles.some((p) => p.id === duplicatedProfile.id);

    if (hasNew && hasDup && updatedProfile.permissions.includes("BRANCHES.VIEW")) {
      results.profile_creation_and_crud = "PASS";
      console.log(`   [PASS] Profile CRUD: Created "${createdProfile.name}", Updated, and Duplicated "${duplicatedProfile.name}"`);
    }
  } catch (err: any) {
    console.error("   [FAIL] Profile CRUD error:", err.message);
  }

  // ── 2. Safe Profile Archiving / Deletion ────────────────────────────────────
  console.log("\n2. Testing Safe Profile Archiving / Deletion Invariant...");
  try {
    // Attempt to archive profile assigned to active staff (e.g. Telecaller assigned to Priya)
    let blockedAsExpected = false;
    try {
      StaffAccessControl.archiveProfile("prof_telecaller");
    } catch (e: any) {
      if (e.message.includes("Cannot archive profile") && e.message.includes("assigned")) {
        blockedAsExpected = true;
      }
    }

    // Create an unassigned profile and archive it safely
    const unassigned = StaffAccessControl.createProfile({
      name: "Temporary Trial Profile",
      description: "For testing safe archiving",
      permissions: ["REPORTS.VIEW"],
    });

    const archived = StaffAccessControl.archiveProfile(unassigned.id);
    const notInActiveList = !StaffAccessControl.listProfiles().some((p) => p.id === unassigned.id);

    if (blockedAsExpected && archived.status === "ARCHIVED" && notInActiveList) {
      results.safe_profile_archiving = "PASS";
      console.log("   [PASS] Safe Archiving: Blocked archiving of assigned profile, safely archived unassigned profile.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Safe archiving error:", err.message);
  }

  // ── 3. Default DENY Architecture ──────────────────────────────────────────
  console.log("\n3. Testing Default DENY (Fail Closed) Security Architecture...");
  try {
    const unassignedUser = { id: "usr_random_999", role: "CUSTOMER", phone: "+91 99999 88888" };
    const guestUser = null;

    const test1 = StaffAccessControl.hasPermission(unassignedUser, "TELEMARKETING", "VIEW");
    const test2 = StaffAccessControl.hasPermission(unassignedUser, "GST", "VIEW");
    const test3 = StaffAccessControl.hasPermission(guestUser, "ORDERS", "VIEW");

    if (!test1 && !test2 && !test3) {
      results.default_deny_architecture = "PASS";
      console.log("   [PASS] Default Deny: All unauthenticated/unassigned users receive 100% fail-closed DENY.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Default deny error:", err.message);
  }

  // ── 4. Permission Priority Hierarchy ──────────────────────────────────────
  console.log("\n4. Testing Permission Priority Hierarchy...");
  console.log("   Hierarchy: Super Admin > Explicit Staff DENY > Explicit Staff ALLOW > Profile ALLOW > Default DENY");
  try {
    const testStaff = StaffAccessControl.createStaffMember({
      name: "Aman Gupta",
      phone: "+91 98765 11223",
      email: "aman.g@example.com",
      profile_id: "prof_telecaller",
    });

    // 1. Profile allows TELEMARKETING.EXPORT
    const allowFromProfile = StaffAccessControl.hasPermission(testStaff, "TELEMARKETING", "EXPORT");

    // 2. Set explicit staff DENY for TELEMARKETING.EXPORT
    StaffAccessControl.setStaffOverride(testStaff.id, "TELEMARKETING.EXPORT", "DENY");
    const denyFromOverride = StaffAccessControl.hasPermission(testStaff, "TELEMARKETING", "EXPORT");

    // 3. Set explicit staff ALLOW for TAX_MASTER.VIEW (not in telecaller profile)
    StaffAccessControl.setStaffOverride(testStaff.id, "TAX_MASTER.VIEW", "ALLOW");
    const allowFromOverride = StaffAccessControl.hasPermission(testStaff, "TAX_MASTER", "VIEW");

    // 4. Default deny for non-granted non-overridden permission
    const defaultDenied = StaffAccessControl.hasPermission(testStaff, "SETTINGS", "EDIT");

    if (allowFromProfile && !denyFromOverride && allowFromOverride && !defaultDenied) {
      results.permission_priority_hierarchy = "PASS";
      console.log("   [PASS] Permission Priority: Staff DENY successfully overruled profile ALLOW; Staff ALLOW granted unassigned permission.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Permission priority error:", err.message);
  }

  // ── 5. Telecaller Profile Permissions & Data Scope ────────────────────────
  console.log("\n5. Testing Telecaller Profile Permissions & Scope...");
  try {
    const priya = StaffAccessControl.getStaffMember("staff_01"); // Priya Sharma (Telecaller)

    const canViewTelemarketing = StaffAccessControl.hasPermission(priya, "TELEMARKETING", "VIEW");
    const canExportCallingList = StaffAccessControl.hasPermission(priya, "TELEMARKETING", "EXPORT");
    const canContact = StaffAccessControl.hasPermission(priya, "TELEMARKETING", "CONTACT");
    const canViewPhone = StaffAccessControl.hasPermission(priya, "CUSTOMERS", "VIEW_PHONE");
    const canViewOrders = StaffAccessControl.hasPermission(priya, "ORDERS", "VIEW");

    // Must NOT have access to sensitive financial / admin modules
    const cannotViewGst = !StaffAccessControl.hasPermission(priya, "TAX_MASTER", "VIEW");
    const cannotEditPricing = !StaffAccessControl.hasPermission(priya, "PRODUCTS", "EDIT");
    const cannotManageBranches = !StaffAccessControl.hasPermission(priya, "BRANCHES", "EDIT");
    const cannotManageUsers = !StaffAccessControl.hasPermission(priya, "STAFF_MANAGEMENT", "PROFILES_CRUD");
    const cannotViewSettings = !StaffAccessControl.hasPermission(priya, "SETTINGS", "VIEW");

    if (
      canViewTelemarketing && canExportCallingList && canContact && canViewPhone && canViewOrders &&
      cannotViewGst && cannotEditPricing && cannotManageBranches && cannotManageUsers && cannotViewSettings
    ) {
      results.telecaller_permissions_and_scope = "PASS";
      console.log("   [PASS] Telecaller Profile verified: Granted [Telemarketing, Customer Phone, Orders, Export] | Blocked [GST, Branches, Pricing, Settings, Role Mgmt].");
    }
  } catch (err: any) {
    console.error("   [FAIL] Telecaller permissions error:", err.message);
  }

  // ── 6. Digital Marketing Profile Permissions ──────────────────────────────
  console.log("\n6. Testing Digital Marketing Profile Permissions...");
  try {
    const sneha = StaffAccessControl.getStaffMember("staff_02"); // Sneha Menon (Digital Marketing)

    const canMarketing = StaffAccessControl.hasPermission(sneha, "MARKETING", "CREATE");
    const canPopups = StaffAccessControl.hasPermission(sneha, "POPUPS", "PUBLISH");
    const canCms = StaffAccessControl.hasPermission(sneha, "CMS", "EDIT");
    const canSeo = StaffAccessControl.hasPermission(sneha, "SEO", "VIEW");
    const canAnalytics = StaffAccessControl.hasPermission(sneha, "ANALYTICS", "VIEW");

    // Denied modules
    const cannotGst = !StaffAccessControl.hasPermission(sneha, "TAX_MASTER", "VIEW");
    const cannotInventory = !StaffAccessControl.hasPermission(sneha, "INVENTORY", "EDIT");
    const cannotBranches = !StaffAccessControl.hasPermission(sneha, "BRANCHES", "EDIT");
    const cannotStaff = !StaffAccessControl.hasPermission(sneha, "STAFF_MANAGEMENT", "CREATE");

    if (canMarketing && canPopups && canCms && canSeo && canAnalytics && cannotGst && cannotInventory && cannotBranches && cannotStaff) {
      results.digital_marketing_permissions = "PASS";
      console.log("   [PASS] Digital Marketing Profile verified: Granted [Marketing, Popups, CMS, SEO, Analytics] | Blocked [GST, Inventory, Branches, Staff Mgmt].");
    }
  } catch (err: any) {
    console.error("   [FAIL] Digital marketing permissions error:", err.message);
  }

  // ── 7. SEO & Content Manager Templates ────────────────────────────────────
  console.log("\n7. Testing SEO Manager & Content Manager Templates...");
  try {
    const rahul = StaffAccessControl.getStaffMember("staff_03"); // Rahul Verma (SEO Manager)
    const kavita = StaffAccessControl.getStaffMember("staff_04"); // Kavita Iyer (Content Manager)

    const rahulSeo = StaffAccessControl.hasPermission(rahul, "SEO", "PUBLISH");
    const rahulCms = StaffAccessControl.hasPermission(rahul, "CMS", "EDIT");
    const rahulNoOrders = !StaffAccessControl.hasPermission(rahul, "ORDERS", "CANCEL");

    const kavitaCms = StaffAccessControl.hasPermission(kavita, "CMS", "PUBLISH");
    const kavitaProducts = StaffAccessControl.hasPermission(kavita, "PRODUCTS", "VIEW");
    const kavitaNoGst = !StaffAccessControl.hasPermission(kavita, "TAX_MASTER", "VIEW");

    if (rahulSeo && rahulCms && rahulNoOrders && kavitaCms && kavitaProducts && kavitaNoGst) {
      results.seo_and_content_templates = "PASS";
      console.log("   [PASS] SEO & Content Manager templates verified against granular functional boundaries.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Template test error:", err.message);
  }

  // ── 8. Staff Explicit Overrides ───────────────────────────────────────────
  console.log("\n8. Testing Staff Explicit Overrides (Per-User Deny & Allow)...");
  try {
    const testUser = StaffAccessControl.createStaffMember({
      name: "Vikram Test User",
      phone: "+91 91234 56789",
      email: "vikram.test@example.com",
      profile_id: "prof_telecaller",
    });

    // Disable TELEMARKETING.EXPORT specifically for Vikram
    StaffAccessControl.setStaffOverride(testUser.id, "TELEMARKETING.EXPORT", "DENY");
    const exportDenied = !StaffAccessControl.hasPermission(testUser, "TELEMARKETING", "EXPORT");

    // Enable SEO.VIEW specifically for Vikram
    StaffAccessControl.setStaffOverride(testUser.id, "SEO.VIEW", "ALLOW");
    const seoAllowed = StaffAccessControl.hasPermission(testUser, "SEO", "VIEW");

    // Reset override
    StaffAccessControl.setStaffOverride(testUser.id, "TELEMARKETING.EXPORT", "RESET");
    const exportRestored = StaffAccessControl.hasPermission(testUser, "TELEMARKETING", "EXPORT");

    if (exportDenied && seoAllowed && exportRestored) {
      results.staff_explicit_overrides = "PASS";
      console.log("   [PASS] Staff Overrides: Verified explicit DENY, ALLOW, and RESET lifecycle.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Staff overrides error:", err.message);
  }

  // ── 9. Dynamic Tab Permission Guard & Direct URL Blocking ─────────────────
  console.log("\n9. Testing Dynamic Tab Permission Guard & Direct URL Protection...");
  try {
    const priya = StaffAccessControl.getStaffMember("staff_01"); // Telecaller

    const canTabTelemarketing = StaffAccessControl.isTabPermitted(priya, "telemarketing");
    const canTabCrm = StaffAccessControl.isTabPermitted(priya, "crm");
    const canTabOrders = StaffAccessControl.isTabPermitted(priya, "orders");

    // Blocked tabs for Telecaller
    const blockedTax = !StaffAccessControl.isTabPermitted(priya, "tax_master");
    const blockedBranches = !StaffAccessControl.isTabPermitted(priya, "branches");
    const blockedSettings = !StaffAccessControl.isTabPermitted(priya, "settings");
    const blockedStaff = !StaffAccessControl.isTabPermitted(priya, "staff_profiles");
    const blockedWebhooks = !StaffAccessControl.isTabPermitted(priya, "webhooks");

    if (canTabTelemarketing && canTabCrm && canTabOrders && blockedTax && blockedBranches && blockedSettings && blockedStaff && blockedWebhooks) {
      results.dynamic_tab_permission_guard = "PASS";
      console.log("   [PASS] Tab Permission Guard: Telecaller permitted tabs [telemarketing, crm, orders]; blocked [tax_master, branches, settings, staff_profiles, webhooks].");
    }
  } catch (err: any) {
    console.error("   [FAIL] Tab guard error:", err.message);
  }

  // ── 10. Audit Logging ─────────────────────────────────────────────────────
  console.log("\n10. Testing Permission Audit Logging (Append-Only Trail)...");
  try {
    const auditCountBefore = StaffAccessControl.listAuditLogs().length;

    StaffAccessControl.createProfile({
      name: "Audit Test Profile",
      description: "Testing audit trail generation",
      permissions: ["ORDERS.VIEW"],
    });

    const logs = StaffAccessControl.listAuditLogs(10);
    const latestLog = logs[0];

    const hasLog = (
      latestLog.action === "CREATE_PROFILE" &&
      latestLog.target_name === "Audit Test Profile" &&
      latestLog.actor_name === "Super Admin" &&
      Boolean(latestLog.created_at)
    );

    // Verify zero secret leakage in audit logs
    const zeroSecretsInLogs = logs.every((l) => {
      const s = JSON.stringify(l);
      return !s.includes("password") && !s.includes("jwt_") && !s.includes("otp");
    });

    const totalLogsAfter = StaffAccessControl.listAuditLogs().length;
    if (hasLog && zeroSecretsInLogs && totalLogsAfter > auditCountBefore) {
      results.permission_audit_logging = "PASS";
      console.log(`   [PASS] Audit Logging: Recorded '${latestLog.action}' for target '${latestLog.target_name}' with 100% zero secret leakage.`);
    } else {
      console.error(`   [FAIL] Audit check details: hasLog=${hasLog}, zeroSecrets=${zeroSecretsInLogs}, totalAfter=${totalLogsAfter}, before=${auditCountBefore}`);
    }
  } catch (err: any) {
    console.error("   [FAIL] Audit logging error:", err.message);
  }

  // ── 11. Super Admin Unrestricted Authority ────────────────────────────────
  console.log("\n11. Testing Super Admin Unrestricted System Authority...");
  try {
    const superAdmin = { id: "admin_01", role: "SUPER_ADMIN", phone: "+91 98765 00000" };

    const allTabs = [
      "orders", "catalog", "branches", "delivery", "tax_master", "abandoned_carts",
      "telemarketing", "crm", "login_activity", "marketing", "popups", "seo",
      "automation", "webhooks", "cms", "analytics", "staff_profiles", "notifications", "settings"
    ];

    const allTabsPermitted = allTabs.every((tab) => StaffAccessControl.isTabPermitted(superAdmin, tab));
    const allCatalogPermitted = PERMISSION_CATALOG.every((p) => StaffAccessControl.hasPermission(superAdmin, p.module, p.action));

    if (allTabsPermitted && allCatalogPermitted) {
      results.super_admin_unrestricted_authority = "PASS";
      console.log("   [PASS] Super Admin Authority: 100% unrestricted access retained across all modules, tabs, and actions.");
    }
  } catch (err: any) {
    console.error("   [FAIL] Super admin authority error:", err.message);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log("STAFF PROFILES & PERMISSIONS ACCEPTANCE SUMMARY");
  console.log("================================================================================\n");

  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  const allPassed = Object.values(results).every((v) => v === "PASS");
  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runStaffProfilesPermissionTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
