import { chromium, Browser, Page } from "../frontend/node_modules/playwright";

async function testRoleProfileMenu(roleName: string, cookies: { name: string; value: string; domain: string; path: string }[], expectedFirstLink: string) {
  console.log(`\n────────────────────────────────────────────────────────────────`);
  console.log(`  TESTING PROFILE MENU FOR ROLE: ${roleName}`);
  console.log(`────────────────────────────────────────────────────────────────`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies(cookies);

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warn") {
      console.log(`  [Browser Console ${msg.type()}]:`, msg.text());
    }
  });

  try {
    await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);

    const trigger = page.locator("button[aria-label='User profile and account settings menu']");
    const isTriggerVisible = await trigger.isVisible();
    console.log(`  1. Trigger visible: ${isTriggerVisible ? "✅ YES" : "❌ NO"}`);

    if (!isTriggerVisible) {
      await browser.close();
      return false;
    }

    // Step 2: Open Menu
    await trigger.click();
    await page.waitForTimeout(300);

    const dropdown = page.locator("div[role='menu']");
    const isDropdownVisible = await dropdown.isVisible();
    console.log(`  2. Dropdown opened: ${isDropdownVisible ? "✅ YES" : "❌ NO"}`);

    if (!isDropdownVisible) {
      await browser.close();
      return false;
    }

    // Step 3: Check Menu Items
    const menuItems = await page.locator("[role='menuitem']").all();
    console.log(`  3. Found ${menuItems.length} menu items:`);
    for (const item of menuItems) {
      const text = await item.textContent();
      console.log(`     • ${text?.trim().replace(/\s+/g, ' ')}`);
    }

    // Step 4: Pointer Movement from trigger to menu items
    const triggerBox = await trigger.boundingBox();
    const dropdownBox = await dropdown.boundingBox();
    if (triggerBox && dropdownBox) {
      const startX = triggerBox.x + triggerBox.width / 2;
      const startY = triggerBox.y + triggerBox.height / 2;
      const targetX = dropdownBox.x + dropdownBox.width / 2;
      const targetY = dropdownBox.y + 40;

      // Slow mouse movement
      await page.mouse.move(startX, startY);
      await page.mouse.move(targetX, targetY, { steps: 15 });
      await page.waitForTimeout(200);

      const stillOpen = await dropdown.isVisible();
      console.log(`  4. Dropdown remains open during pointer move: ${stillOpen ? "✅ YES" : "❌ NO (CLOSED)"}`);
    }

    // Step 5: Test Navigation Click
    const firstLink = page.locator(`a[role='menuitem']:has-text('${expectedFirstLink}')`);
    if (await firstLink.isVisible()) {
      console.log(`  5. Clicking '${expectedFirstLink}' link...`);
      await firstLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      console.log(`     Target URL reached: ${page.url()}`);
    }

    // Step 6: Open again and test Logout button
    await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const trig2 = page.locator("button[aria-label='User profile and account settings menu']");
    await trig2.click();
    await page.waitForTimeout(300);

    const logoutBtn = page.locator("button[role='menuitem']:has-text('Logout')");
    if (await logoutBtn.isVisible()) {
      console.log(`  6. Clicking 'Logout' button...`);
      await logoutBtn.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      console.log(`     Post-logout URL: ${page.url()}`);
    }

    await browser.close();
    return true;
  } catch (err: any) {
    console.error(`  ❌ Error testing ${roleName}:`, err.message);
    await browser.close();
    return false;
  }
}

async function runAllRoles() {
  console.log("================================================================================");
  console.log("  REPRODUCING & TRACING GLOBAL PROFILE MENU FOR ALL ROLES                      ");
  console.log("================================================================================\n");

  // 1. Super Admin
  await testRoleProfileMenu("SUPER_ADMIN", [
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ], "Admin Dashboard");

  // 2. Branch Manager
  await testRoleProfileMenu("BRANCH_MANAGER", [
    { name: "_cth_role", value: "BRANCH_MANAGER", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "shpmgr_01", domain: "localhost", path: "/" },
    { name: "_cth_branch_id", value: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", domain: "localhost", path: "/" },
  ], "Shop Dashboard");

  // 3. Delivery Partner
  await testRoleProfileMenu("DELIVERY_PARTNER", [
    { name: "_cth_role", value: "DELIVERY_PARTNER", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "dlp_01", domain: "localhost", path: "/" },
    { name: "_cth_partner_id", value: "dlp_01", domain: "localhost", path: "/" },
  ], "Partner Portal");

  // 4. Customer
  await testRoleProfileMenu("CUSTOMER", [
    { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "cust_01", domain: "localhost", path: "/" },
    { name: "_cth_customer_uid", value: "cust_01", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
  ], "My Profile");
}

runAllRoles().catch(console.error);
