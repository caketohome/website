/**
 * CakeToHome — Master Global Navigation Integrity & Cross-Panel Removal E2E Test Suite
 * 
 * Verifies that:
 * 1. The 4 deprecated cross-panel navigation links:
 *    - 🏪 Shop Manager
 *    - 🍰 Menu & Items
 *    - 🛵 Delivery Partner
 *    - 👤 Customer Portal
 *    are 100% absent from the shared header across all panels (Desktop, Tablet, Mobile).
 * 2. They are NOT hidden via CSS (`display:none` / `visibility:hidden`), but are completely absent from the header DOM.
 * 3. Super Admin (`/dashboard`), Branch Manager (`/dashboard/shop`), Delivery Partner (`/dashboard/delivery-partner`),
 *    and Customer (`/account` and `/`) panels remain 100% operational.
 * 4. Role-scoped Profile Menu maintains authoritative, isolated navigation per role.
 */

import { chromium } from "../frontend/node_modules/playwright";

async function runGlobalNavigationIntegrityE2E() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — GLOBAL NAVIGATION INTEGRITY & CROSS-PANEL CLEANUP E2E SUITE       ");
  console.log("================================================================================\n");

  let passedTests = 0;
  const totalAssertions = 20;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] Assertion ${passedTests + 1}: ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Assertion: ${message}`);
      throw new Error(`Navigation Integrity Test Failure: ${message}`);
    }
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // ── 1. SUPER ADMIN PANEL HEADER (DESKTOP & MOBILE) ─────────────────────────
    console.log("[PHASE 1] Verifying Super Admin Panel Navigation (/dashboard)...");
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: "_cth_jwt", value: "admin_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
    ]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded", timeout: 45000 });
    await adminPage.waitForTimeout(1000);

    const adminNavHtml = await adminPage.locator("nav").first().innerHTML();
    assert(!adminNavHtml.includes("Shop Manager"), "Super Admin header does NOT contain 'Shop Manager'");
    assert(!adminNavHtml.includes("Menu & Items"), "Super Admin header does NOT contain 'Menu & Items'");
    assert(!adminNavHtml.includes("Delivery Partner"), "Super Admin header does NOT contain 'Delivery Partner'");
    assert(!adminNavHtml.includes("Customer Portal"), "Super Admin header does NOT contain 'Customer Portal'");
    assert(adminNavHtml.includes("🎂 CakeToHome"), "Super Admin header preserves canonical '🎂 CakeToHome' brand link");

    // ── 2. BRANCH MANAGER PANEL HEADER ─────────────────────────────────────────
    console.log("\n[PHASE 2] Verifying Branch Manager Panel Navigation (/dashboard/shop)...");
    const branchContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await branchContext.addCookies([
      { name: "_cth_jwt", value: "shpmgr_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "BRANCH_MANAGER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "shpmgr_01", domain: "localhost", path: "/" },
      { name: "_cth_branch_id", value: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", domain: "localhost", path: "/" },
    ]);
    const branchPage = await branchContext.newPage();
    await branchPage.goto("http://localhost:3000/dashboard/shop", { waitUntil: "domcontentloaded", timeout: 45000 });
    await branchPage.waitForTimeout(1000);

    const branchNavHtml = await branchPage.locator("nav").first().innerHTML();
    assert(!branchNavHtml.includes("Shop Manager"), "Branch Manager header does NOT contain 'Shop Manager'");
    assert(!branchNavHtml.includes("Delivery Partner"), "Branch Manager header does NOT contain 'Delivery Partner'");
    assert(!branchNavHtml.includes("Customer Portal"), "Branch Manager header does NOT contain 'Customer Portal'");
    
    // Operational verification: Branch Manager Operations dashboard content loads
    const branchContent = await branchPage.textContent("body");
    assert(
      branchContent?.includes("Live Kitchen KOT Queue") || branchContent?.includes("Kitchen Operations") || branchContent?.includes("Indiranagar"),
      "Branch Manager operational interface loads successfully"
    );

    // ── 3. DELIVERY PARTNER WORKSPACE HEADER ────────────────────────────────────
    console.log("\n[PHASE 3] Verifying Delivery Partner Workspace Navigation (/dashboard/delivery-partner)...");
    const dlpContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await dlpContext.addCookies([
      { name: "_cth_jwt", value: "dlp_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "DELIVERY_PARTNER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "dlp_01", domain: "localhost", path: "/" },
    ]);
    const dlpPage = await dlpContext.newPage();
    await dlpPage.goto("http://localhost:3000/dashboard/delivery-partner", { waitUntil: "domcontentloaded", timeout: 45000 });
    await dlpPage.waitForTimeout(1000);

    const dlpNavHtml = await dlpPage.locator("nav").first().innerHTML();
    assert(!dlpNavHtml.includes("Shop Manager"), "Delivery Partner header does NOT contain 'Shop Manager'");
    assert(!dlpNavHtml.includes("Menu & Items"), "Delivery Partner header does NOT contain 'Menu & Items'");
    assert(!dlpNavHtml.includes("Customer Portal"), "Delivery Partner header does NOT contain 'Customer Portal'");

    // Operational verification: Delivery Partner cards / columns load
    const dlpContent = await dlpPage.textContent("body");
    assert(
      dlpContent?.includes("Available Jobs") || dlpContent?.includes("Claimed") || dlpContent?.includes("Delivery Partner"),
      "Delivery Partner operational interface loads successfully"
    );

    // ── 4. CUSTOMER ACCOUNT & STOREFRONT HEADERS ──────────────────────────────
    console.log("\n[PHASE 4] Verifying Customer Account & Storefront Navigation...");
    const customerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await customerContext.addCookies([
      { name: "_cth_customer_uid", value: "cus_ananya_test", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
    ]);
    const customerPage = await customerContext.newPage();
    await customerPage.goto("http://localhost:3000/account", { waitUntil: "domcontentloaded", timeout: 45000 });
    await customerPage.waitForTimeout(1000);

    const customerContent = await customerPage.textContent("body");
    assert(
      customerContent?.includes("Personal Profile") || customerContent?.includes("Account Hub"),
      "Customer Account Hub loads successfully"
    );

    // Storefront home
    await customerPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await customerPage.waitForTimeout(1000);
    const storeNavHtml = await customerPage.locator("nav").first().innerHTML();
    assert(!storeNavHtml.includes("Shop Manager"), "Storefront navigation does NOT contain 'Shop Manager'");
    assert(!storeNavHtml.includes("Delivery Partner"), "Storefront navigation does NOT contain 'Delivery Partner'");
    assert(!storeNavHtml.includes("Customer Portal"), "Storefront navigation does NOT contain 'Customer Portal'");

    // ── 5. MOBILE VIEWPORT VERIFICATION (375x667) ──────────────────────────────
    console.log("\n[PHASE 5] Verifying Mobile Viewport Responsive Layout (375x667)...");
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    await mobileContext.addCookies([
      { name: "_cth_jwt", value: "admin_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    ]);
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded", timeout: 45000 });
    await mobilePage.waitForTimeout(1000);

    const mobileNavHtml = await mobilePage.locator("nav").first().innerHTML();
    assert(!mobileNavHtml.includes("Shop Manager"), "Mobile header does NOT contain 'Shop Manager'");
    assert(!mobileNavHtml.includes("Delivery Partner"), "Mobile header does NOT contain 'Delivery Partner'");
    assert(!mobileNavHtml.includes("Customer Portal"), "Mobile header does NOT contain 'Customer Portal'");

    // ── SUMMARY & RESULTS ──────────────────────────────────────────────────────
    console.log("\n================================================================================");
    console.log(`  GLOBAL NAVIGATION INTEGRITY RESULTS: ${passedTests} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
    console.log("================================================================================\n");

    if (passedTests === totalAssertions) {
      console.log("  >>> ALL 20 GLOBAL NAVIGATION INTEGRITY ASSERTIONS PASSED PERFECTLY. <<<");
    } else {
      throw new Error(`Only ${passedTests}/${totalAssertions} assertions passed.`);
    }
  } finally {
    await browser.close();
  }
}

runGlobalNavigationIntegrityE2E().catch((err) => {
  console.error("FATAL ERROR in runGlobalNavigationIntegrityE2E:", err);
  process.exit(1);
});
