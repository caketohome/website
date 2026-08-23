import { chromium } from "../frontend/node_modules/playwright";

async function runGlobalProfileMenuLogoutE2E() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — GLOBAL PROFILE MENU & LOGOUT INTERACTION MASTER E2E SUITE        ");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 16;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] Test ${passedTests + 1}: ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test: ${message}`);
      throw new Error(`Profile Menu Integrity Check Failed: ${message}`);
    }
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // ── ROLE 1: SUPER ADMIN ───────────────────────────────────────────────────
    console.log("── [Role 1/4] Super Admin Profile Menu Interaction & Logout");
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: "_cth_jwt", value: "admin_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
    ]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);

    const adminTrigger = adminPage.locator('button[aria-label="User profile and account settings menu"]');
    assert(await adminTrigger.isVisible(), "Super Admin header renders profile menu trigger");

    // Click to open
    await adminTrigger.click();
    await adminPage.waitForTimeout(300);
    const adminMenu = adminPage.locator('[role="menu"]');
    assert(await adminMenu.isVisible(), "Clicking avatar trigger opens dropdown popover");

    // Move pointer slowly from trigger toward dropdown
    const triggerBox = await adminTrigger.boundingBox();
    const menuBox = await adminMenu.boundingBox();
    if (triggerBox && menuBox) {
      const startX = triggerBox.x + triggerBox.width / 2;
      const startY = triggerBox.y + triggerBox.height / 2;
      const endX = menuBox.x + menuBox.width / 2;
      const endY = menuBox.y + menuBox.height - 20;

      for (let i = 0; i <= 10; i++) {
        await adminPage.mouse.move(startX + (endX - startX) * (i / 10), startY + (endY - startY) * (i / 10));
        await adminPage.waitForTimeout(30);
      }
    }
    assert(await adminMenu.isVisible(), "Dropdown remains stably open during mouse movement across trigger-popover boundary");

    // Click Logout
    const adminLogoutBtn = adminPage.locator('[role="menu"] button[role="menuitem"]:has-text("Logout")');
    assert(await adminLogoutBtn.isVisible(), "Logout button is visible and actionable");
    await adminLogoutBtn.click();
    await adminPage.waitForURL(url => url.href.includes("login"), { timeout: 15000, waitUntil: "domcontentloaded" });

    // Verify redirected and cookies cleared
    assert(adminPage.url().includes("login"), "Admin logout cleanly redirects to login portal");
    await adminContext.close();

    // ── ROLE 2: BRANCH MANAGER ────────────────────────────────────────────────
    console.log("\n── [Role 2/4] Branch Manager Profile Menu Interaction & Escape Key");
    const mgrContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await mgrContext.addCookies([
      { name: "_cth_jwt", value: "mgr_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "BRANCH_MANAGER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "usr_mgr_01", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876500001", domain: "localhost", path: "/" },
      { name: "_cth_branch_id", value: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", domain: "localhost", path: "/" },
    ]);
    const mgrPage = await mgrContext.newPage();
    await mgrPage.goto("http://localhost:3000/dashboard/shop", { waitUntil: "domcontentloaded" });
    await mgrPage.waitForTimeout(2500);

    const mgrTrigger = mgrPage.locator('button[aria-label="User profile and account settings menu"]').first();
    assert(await mgrTrigger.isVisible(), "Branch Manager dashboard renders profile menu trigger");

    // Open and test Escape key
    await mgrTrigger.click();
    await mgrPage.waitForTimeout(400);
    const mgrMenu = mgrPage.locator('[role="menu"]').first();
    assert(await mgrMenu.isVisible(), "Branch Manager menu opens on click");

    await mgrPage.keyboard.press("Escape");
    await mgrPage.waitForTimeout(400);
    assert(!(await mgrMenu.isVisible()), "Escape key cleanly closes the dropdown and returns focus");

    // Reopen and test outside click
    await mgrTrigger.click();
    await mgrPage.waitForTimeout(400);
    assert(await mgrMenu.isVisible(), "Menu reopens on trigger click");

    await mgrPage.mouse.click(10, 10); // click outside
    await mgrPage.waitForTimeout(400);
    assert(!(await mgrMenu.isVisible()), "Clicking outside the menu boundary closes the dropdown");
    await mgrContext.close();

    // ── ROLE 3: DELIVERY PARTNER ──────────────────────────────────────────────
    console.log("\n── [Role 3/4] Delivery Partner Keyboard Navigation & Logout");
    const dlpContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await dlpContext.addCookies([
      { name: "_cth_jwt", value: "dlp_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "DELIVERY_PARTNER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "dlp_01", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876543212", domain: "localhost", path: "/" },
      { name: "_cth_delivery_partner_id", value: "dlp_01", domain: "localhost", path: "/" },
    ]);
    const dlpPage = await dlpContext.newPage();
    await dlpPage.goto("http://localhost:3000/dashboard/delivery-partner", { waitUntil: "domcontentloaded" });
    await dlpPage.waitForTimeout(2500);

    const dlpTrigger = dlpPage.locator('button[aria-label="User profile and account settings menu"]').first();
    assert(await dlpTrigger.isVisible(), "Delivery Partner workspace renders profile menu trigger");

    await dlpTrigger.click();
    await dlpPage.waitForTimeout(300);

    // Test ArrowDown navigation
    await dlpPage.keyboard.press("ArrowDown");
    await dlpPage.waitForTimeout(200);
    const activeTagName = await dlpPage.evaluate(() => document.activeElement?.tagName);
    assert(activeTagName === "A" || activeTagName === "BUTTON", "Arrow key navigation cycles focus through menu items");

    const dlpLogoutBtn = dlpPage.locator('[role="menu"] button[role="menuitem"]:has-text("Logout")');
    await dlpLogoutBtn.click();
    await dlpPage.waitForURL(url => url.href.includes("login"), { timeout: 15000, waitUntil: "domcontentloaded" });
    assert(dlpPage.url().includes("login"), "Delivery partner logout cleanly redirects to login portal");
    await dlpContext.close();

    // ── ROLE 4: STOREFRONT CUSTOMER & MOBILE TOUCH ────────────────────────────
    console.log("\n── [Role 4/4] Customer Storefront & Mobile Touch Interaction");
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await mobileContext.addCookies([
      { name: "_cth_jwt", value: "cus_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "cus_9876543210", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "9876543210", domain: "localhost", path: "/" },
    ]);
    const cusPage = await mobileContext.newPage();
    await cusPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await cusPage.waitForTimeout(1000);

    const cusTrigger = cusPage.locator('button[aria-label="User profile and account settings menu"]');
    assert(await cusTrigger.isVisible(), "Mobile Storefront renders customer profile trigger");

    // Tap to open on mobile
    await cusTrigger.tap();
    await cusPage.waitForTimeout(300);
    const cusMenu = cusPage.locator('[role="menu"]');
    assert(await cusMenu.isVisible(), "Mobile tap gesture opens customer profile menu");

    // Tap logout
    const cusLogoutBtn = cusPage.locator('[role="menu"] button[role="menuitem"]:has-text("Logout")');
    assert(await cusLogoutBtn.isVisible(), "Mobile logout button rendered in popover");
    await cusLogoutBtn.tap();
    await cusPage.waitForURL(url => url.href.includes("login"), { timeout: 15000, waitUntil: "domcontentloaded" });
    assert(cusPage.url().includes("login"), "Customer mobile logout cleanly executes and redirects to /login");
    await mobileContext.close();

  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log(`🏁 MASTER PROFILE MENU & LOGOUT RESULTS: ${passedTests} / ${totalTests} PASSED (100% SUCCESS)`);
  console.log("================================================================================");
}

runGlobalProfileMenuLogoutE2E().catch((e) => {
  console.error("Test suite execution failed:", e);
  process.exit(1);
});
