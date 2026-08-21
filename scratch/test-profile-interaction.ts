import { chromium } from "../frontend/node_modules/playwright";

async function reproduceProfileMenuBug() {
  console.log("=== Reproducing Profile Menu Interaction Bug ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Add Admin Cookies
  await context.addCookies([
    { name: "_cth_jwt", value: "admin_token", domain: "localhost", path: "/" },
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  
  // Log console errors and warnings
  page.on("console", msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Find profile trigger
  const profileTrigger = page.locator('button[aria-label="User profile and account settings menu"]');
  const isTriggerVisible = await profileTrigger.isVisible();
  console.log("Profile trigger visible:", isTriggerVisible);

  if (!isTriggerVisible) {
    console.error("Profile trigger not found!");
    await browser.close();
    return;
  }

  // Get trigger bounding box
  const triggerBox = await profileTrigger.boundingBox();
  console.log("Trigger box:", triggerBox);

  // Click to open
  console.log("Clicking profile trigger...");
  await profileTrigger.click();
  await page.waitForTimeout(500);

  let isMenuVisible = await page.locator('[role="menu"]').isVisible();
  console.log("Menu visible after click:", isMenuVisible);

  if (triggerBox && isMenuVisible) {
    const menuBox = await page.locator('[role="menu"]').boundingBox();
    console.log("Menu bounding box:", menuBox);

    // Simulate slow mouse movement from trigger down into the menu
    console.log("Moving mouse slowly from trigger to dropdown menu...");
    const startX = triggerBox.x + triggerBox.width / 2;
    const startY = triggerBox.y + triggerBox.height / 2;
    const endX = menuBox!.x + menuBox!.width / 2;
    const endY = menuBox!.y + menuBox!.height - 30; // near the bottom logout button

    for (let i = 0; i <= 20; i++) {
      const currentX = startX + (endX - startX) * (i / 20);
      const currentY = startY + (endY - startY) * (i / 20);
      await page.mouse.move(currentX, currentY);
      await page.waitForTimeout(50);
      const stillOpen = await page.locator('[role="menu"]').isVisible();
      if (!stillOpen) {
        console.log(`❌ Menu CLOSED unexpectedly during mouse move at step ${i} (x: ${currentX}, y: ${currentY})`);
        break;
      }
    }

    const finalOpen = await page.locator('[role="menu"]').isVisible();
    console.log("Menu still open after mouse move:", finalOpen);

    if (finalOpen) {
      console.log("Attempting to click Logout...");
      const logoutBtn = page.locator('[role="menu"] button:has-text("Logout"), [role="menu"] button:has-text("Sign out")');
      const isLogoutVisible = await logoutBtn.isVisible();
      console.log("Logout button visible:", isLogoutVisible);
      if (isLogoutVisible) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
        console.log("After clicking Logout, checking confirmation or logout state...");
        const confirmVisible = await page.locator('text=Are you sure you want to logout?').isVisible();
        console.log("Confirmation dialog visible:", confirmVisible);
      }
    }
  }

  await browser.close();
}

reproduceProfileMenuBug().catch(console.error);
