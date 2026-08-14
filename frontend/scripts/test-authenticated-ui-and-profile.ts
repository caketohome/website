import { chromium } from "playwright";

async function testAuthUIAndProfileMenu() {
  console.log("================================================================================");
  console.log("   CAKETOHOME: AUTHENTICATED UI & PROFILE MENU VISUAL VERIFICATION");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Set Super Admin authentication cookies
  await context.addCookies([
    { name: "_cth_jwt", value: "mock_super_admin_jwt", domain: "localhost", path: "/" },
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
  ]);

  console.log("1. Navigating to http://localhost:3000/dashboard?tab=settings ...");
  await page.goto("http://localhost:3000/dashboard?tab=settings", { waitUntil: "networkidle" });
  await page.screenshot({ path: "temp-dashboard-authenticated.png" });
  console.log("   ✅ Captured screenshot: temp-dashboard-authenticated.png");

  console.log("2. Locating and clicking Profile Badge / Menu ...");
  const profileButton = await page.$("button:has-text('Super Admin'), button[aria-haspopup='menu'], .profile-badge, [data-testid='profile-menu-trigger']");
  if (profileButton) {
    await profileButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "temp-profile-dropdown-open.png" });
    console.log("   ✅ Profile menu opened! Captured screenshot: temp-profile-dropdown-open.png");
  } else {
    // Search for profile container button
    const buttons = await page.$$("nav button");
    for (const b of buttons) {
      const text = await b.textContent();
      if (text?.includes("Super Admin") || text?.includes("Admin") || text?.includes("👑")) {
        await b.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "temp-profile-dropdown-open.png" });
        console.log("   ✅ Profile menu clicked! Captured screenshot: temp-profile-dropdown-open.png");
        break;
      }
    }
  }

  console.log("3. Navigating to homepage with Super Admin session ...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "temp-homepage-authenticated.png" });
  console.log("   ✅ Captured screenshot: temp-homepage-authenticated.png");

  // Open profile dropdown on homepage
  const homeButtons = await page.$$("nav button");
  for (const b of homeButtons) {
    const text = await b.textContent();
    if (text?.includes("Super Admin") || text?.includes("Admin") || text?.includes("👑")) {
      await b.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "temp-home-profile-dropdown-open.png" });
      console.log("   ✅ Homepage profile menu open! Captured screenshot: temp-home-profile-dropdown-open.png");
      break;
    }
  }

  await browser.close();
  console.log("\n================================================================================");
  console.log("   AUTHENTICATED UI & PROFILE MENU VERIFICATION COMPLETED");
  console.log("================================================================================\n");
}

testAuthUIAndProfileMenu().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
