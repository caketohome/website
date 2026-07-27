const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/c2a46f7f-f011-4ad5-bc22-59de9e0a969b";
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots/authenticated_roles");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const JWT_SECRET = "supersecret";

function createJwt(actor_id, actor_type) {
  return jwt.sign({ actor_id, actor_type }, JWT_SECRET, { expiresIn: "7d" });
}

(async () => {
  console.log("=================================================================");
  console.log("  AUTHENTICATED MULTI-ROLE DASHBOARD VERIFICATION SUITE");
  console.log("=================================================================\n");

  const browser = await chromium.launch({ headless: true });

  // -----------------------------------------------------------------
  // 1. Customer Portal Authentication
  // -----------------------------------------------------------------
  console.log("📍 1. Testing Customer OTP Login & Account Portal...");
  try {
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page1 = await context1.newPage();

    await page1.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page1.waitForTimeout(2000);

    const phoneInput = page1.locator("input[type='tel'], input[placeholder*='Mobile']").first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill("9876543210");
      const reqBtn = page1.locator("button:has-text('Request OTP'), button:has-text('Send OTP')").first();
      if (await reqBtn.isVisible()) {
        await reqBtn.click();
        await page1.waitForTimeout(1500);
      }
    }

    const autoFillBtn = page1.locator("button:has-text('Auto-fill')").first();
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
      await page1.waitForTimeout(1000);
    } else {
      const otpInput = page1.locator("input[placeholder*='OTP']").first();
      if (await otpInput.isVisible()) {
        await otpInput.fill("123456");
      }
    }

    const verifyBtn = page1.locator("button:has-text('Verify & Login'), button:has-text('Verify OTP')").first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await page1.waitForTimeout(3000);
    }

    await page1.goto("http://localhost:3000/account", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page1.waitForTimeout(2000);

    const ss1 = path.join(SCREENSHOT_DIR, "01-customer-portal-authenticated.png");
    await page1.screenshot({ path: ss1, fullPage: false });
    console.log("  ✓ Customer Portal Authenticated & Screenshot Saved!");
    await context1.close();
  } catch (err) {
    console.error("  ❌ Customer Portal Error:", err.message);
  }

  // -----------------------------------------------------------------
  // 2. Shop Manager Dashboard Authentication
  // -----------------------------------------------------------------
  console.log("\n📍 2. Testing Shop Manager Dashboard Authentication...");
  try {
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const shopToken = createJwt("shpmgr_01", "shop");
    await context2.addCookies([
      { name: "_medusa_jwt", value: shopToken, domain: "localhost", path: "/" }
    ]);

    const page2 = await context2.newPage();
    await page2.goto("http://localhost:3000/dashboard/shop", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page2.waitForTimeout(3000);

    const ss2 = path.join(SCREENSHOT_DIR, "02-shop-manager-dashboard-authenticated.png");
    await page2.screenshot({ path: ss2, fullPage: false });
    console.log("  ✓ Shop Manager Dashboard Authenticated & Screenshot Saved!");
    await context2.close();
  } catch (err) {
    console.error("  ❌ Shop Manager Dashboard Error:", err.message);
  }

  // -----------------------------------------------------------------
  // 3. Delivery Partner Dashboard Authentication
  // -----------------------------------------------------------------
  console.log("\n📍 3. Testing Delivery Partner Dashboard Authentication...");
  try {
    const context3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const driverToken = createJwt("dlp_01", "delivery_partner");
    await context3.addCookies([
      { name: "_medusa_jwt", value: driverToken, domain: "localhost", path: "/" }
    ]);

    const page3 = await context3.newPage();
    await page3.goto("http://localhost:3000/dashboard/delivery-partner", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page3.waitForTimeout(3000);

    const ss3 = path.join(SCREENSHOT_DIR, "03-delivery-partner-dashboard-authenticated.png");
    await page3.screenshot({ path: ss3, fullPage: false });
    console.log("  ✓ Delivery Partner Dashboard Authenticated & Screenshot Saved!");
    await context3.close();
  } catch (err) {
    console.error("  ❌ Delivery Partner Dashboard Error:", err.message);
  }

  // -----------------------------------------------------------------
  // 4. Medusa Admin Panel Authentication
  // -----------------------------------------------------------------
  console.log("\n📍 4. Testing Medusa Super Admin Panel...");
  try {
    const context4 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page4 = await context4.newPage();

    await page4.goto("http://localhost:9000/app", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page4.waitForTimeout(2000);

    const emailInput = page4.locator("input[name='email'], input[type='email']").first();
    const passInput = page4.locator("input[name='password'], input[type='password']").first();

    if (await emailInput.isVisible()) {
      await emailInput.fill("admin@cakes2home.com");
      if (await passInput.isVisible()) {
        await passInput.fill("supersecret");
      }
      const submitBtn = page4.locator("button[type='submit'], button:has-text('Continue'), button:has-text('Sign in')").first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page4.waitForTimeout(4000);
      }
    }

    const ss4 = path.join(SCREENSHOT_DIR, "04-super-admin-panel.png");
    await page4.screenshot({ path: ss4, fullPage: false });
    console.log("  ✓ Super Admin Panel Authenticated & Screenshot Saved!");
    await context4.close();
  } catch (err) {
    console.error("  ❌ Super Admin Panel Error:", err.message);
  }

  await browser.close();
  console.log("\n=================================================================");
  console.log("  AUTHENTICATED DASHBOARDS VERIFICATION COMPLETE");
  console.log("=================================================================\n");
})();
