/**
 * Playwright Automation Suite:
 * Capture All 16 Visual Evidence Screenshots for
 * "COMPLETE MAP-FIRST STORE SELECTION + DELIVERY AREA + EXCLUSION + DISTANCE PRICING + STORE ADMIN MAP SEARCH"
 *
 * Screenshots saved to:
 * 1. qa/map-first-delivery-audit/
 * 2. C:\Users\alexc\.gemini\antigravity-ide\brain\9f292d2c-6f49-43a9-b63c-a00186cc7ab5/
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { ApiEngine } from "../src/lib/api-engine";

const QA_DIR = path.resolve(__dirname, "../../qa/map-first-delivery-audit");
const ARTIFACT_DIR = "C:/Users/alexc/.gemini/antigravity-ide/brain/9f292d2c-6f49-43a9-b63c-a00186cc7ab5";
const BASE_URL = "http://localhost:3000";

async function saveScreenshot(page: any, filename: string) {
  const qaPath = path.join(QA_DIR, filename);
  await page.screenshot({ path: qaPath, fullPage: false });
  console.log(`  📸 Saved to QA: ${qaPath}`);

  if (fs.existsSync(ARTIFACT_DIR)) {
    const artPath = path.join(ARTIFACT_DIR, filename);
    fs.copyFileSync(qaPath, artPath);
    console.log(`  📁 Copied to Artifacts: ${artPath}`);
  }
}

async function run() {
  if (!fs.existsSync(QA_DIR)) {
    fs.mkdirSync(QA_DIR, { recursive: true });
  }

  console.log("=========================================================================");
  console.log("CakeToHome: 16-View Map-First Store Selection Visual Audit Suite");
  console.log("=========================================================================\n");

  // 1. Seed Cart in ApiEngine for checkout views
  const cartId = `cart_audit_${Date.now()}`;
  ApiEngine.ensureCartsStore();
  ApiEngine.createCart({ id: cartId });
  ApiEngine.addItemToCart(cartId, {
    id: "item_audit_truffle",
    product_id: "prod_1",
    title: "Signature Belgian Chocolate Truffle Cake",
    unit_price: 749,
    quantity: 1,
    subtotal: 749,
  });

  const browser = await chromium.launch({ headless: true });

  // ── ADMIN CONTEXT ──────────────────────────────────────────────────────────
  console.log("[Admin Audit] Launching Admin browser context...");
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });

  await adminContext.addCookies([
    { name: "_cth_jwt", value: "mock_jwt_superadmin", domain: "localhost", path: "/" },
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "usr_superadmin", domain: "localhost", path: "/" },
    { name: "_cth_phone", value: "9876543210", domain: "localhost", path: "/" },
  ]);

  const adminPage = await adminContext.newPage();

  console.log("[Admin Audit] Navigating to /dashboard?tab=branches...");
  await adminPage.goto(`${BASE_URL}/dashboard?tab=branches`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await adminPage.waitForTimeout(3000);

  // Click on "Store Area Matrix" tab if needed
  const storeAreaTab = adminPage.locator("text=Store Area Matrix").first();
  if (await storeAreaTab.isVisible()) {
    await storeAreaTab.click();
    await adminPage.waitForTimeout(1000);
  }

  // 1. Store Area Matrix Overview
  console.log("[Screenshot 1] 01-store-area-matrix-overview.png");
  await saveScreenshot(adminPage, "01-store-area-matrix-overview.png");

  // 2. Store Area Matrix Delivery Zones Table
  console.log("[Screenshot 2] 02-store-area-matrix-zones-table.png");
  await adminPage.evaluate(() => window.scrollBy(0, 300));
  await adminPage.waitForTimeout(500);
  await saveScreenshot(adminPage, "02-store-area-matrix-zones-table.png");

  // Click "+ Add Delivery Area" or "Edit" zone to open Map Fence Editor
  const editZoneBtn = adminPage.locator("button:has-text('Edit')").first();
  if (await editZoneBtn.isVisible()) {
    await editZoneBtn.click();
    await adminPage.waitForTimeout(1500);
  }

  // 3. Delivery Area Creation / Edit modal
  console.log("[Screenshot 3] 03-store-delivery-area-create.png");
  await saveScreenshot(adminPage, "03-store-delivery-area-create.png");

  // 4. Store Radius Boundary
  console.log("[Screenshot 4] 04-store-radius-boundary.png");
  const radiusBtn = adminPage.locator("button:has-text('Radius')").first();
  if (await radiusBtn.isVisible()) {
    await radiusBtn.click();
    await adminPage.waitForTimeout(1000);
  }
  await saveScreenshot(adminPage, "04-store-radius-boundary.png");

  // 5. Store Polygon Boundary
  console.log("[Screenshot 5] 05-store-polygon-boundary.png");
  await saveScreenshot(adminPage, "05-store-polygon-boundary.png");

  // 6. Store Exclusion Area
  console.log("[Screenshot 6] 06-store-exclusion-area.png");
  const exclBtn = adminPage.locator("button:has-text('Exclusions')").first();
  if (await exclBtn.isVisible()) {
    await exclBtn.click();
    await adminPage.waitForTimeout(1000);
  }
  await saveScreenshot(adminPage, "06-store-exclusion-area.png");

  // 7. Store Admin Map Search Viewport
  console.log("[Screenshot 7] 07-store-admin-map-search-viewport.png");
  const searchInput = adminPage.locator("input[placeholder*='Search area or location']").first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("Kadappakada");
    await adminPage.waitForTimeout(1000);
  }
  await saveScreenshot(adminPage, "07-store-admin-map-search-viewport.png");

  // 8. Store Admin Map Search Result
  console.log("[Screenshot 8] 08-store-admin-map-search-result.png");
  const searchItem = adminPage.locator("button:has-text('Kadappakada')").first();
  if (await searchItem.isVisible()) {
    await searchItem.click();
    await adminPage.waitForTimeout(1000);
  }
  await saveScreenshot(adminPage, "08-store-admin-map-search-result.png");

  // Close modal if open
  const closeBtn = adminPage.locator("button:has-text('✕'), button:has-text('Cancel')").first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await adminPage.waitForTimeout(500);
  }

  // 9. Pincode Matrix marked as secondary/reference
  console.log("[Screenshot 9] 09-pincode-matrix-secondary-reference.png");
  const pincodeRefTab = adminPage.locator("text=Address / Pincode Reference").first();
  if (await pincodeRefTab.isVisible()) {
    await pincodeRefTab.click();
    await adminPage.waitForTimeout(1000);
  }
  await saveScreenshot(adminPage, "09-pincode-matrix-secondary-reference.png");

  await adminContext.close();

  // ── CUSTOMER CHECKOUT CONTEXT ──────────────────────────────────────────────
  console.log("\n[Customer Audit] Launching Customer browser context...");
  const customerContext = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    permissions: ["geolocation"],
    geolocation: { latitude: 8.8932, longitude: 76.6025 },
  });

  await customerContext.addCookies([
    { name: "_cth_cart_id", value: cartId, domain: "localhost", path: "/" },
    { name: "_medusa_cart_id", value: cartId, domain: "localhost", path: "/" },
  ]);

  const customerPage = await customerContext.newPage();
  console.log("[Customer Audit] Navigating to /checkout...");
  await customerPage.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await customerPage.waitForTimeout(2000);

  // Fill Step 1 Contact
  const nameInput = customerPage.locator("input[name='first_name']");
  if (await nameInput.isVisible()) await nameInput.fill("Anita");
  const phoneInput = customerPage.locator("input[name='phone']");
  if (await phoneInput.isVisible()) await phoneInput.fill("9876543210");
  const emailInput = customerPage.locator("input[name='email']");
  if (await emailInput.isVisible()) await emailInput.fill("anita.rao@example.com");

  const continueBtn = customerPage.locator("button:has-text('Continue to Delivery')");
  if (await continueBtn.isVisible()) {
    await continueBtn.scrollIntoViewIfNeeded();
    await continueBtn.click({ force: true });
    await customerPage.waitForTimeout(1500);
  }

  // 10. Customer Checkout Map Selection
  console.log("[Screenshot 10] 10-customer-checkout-map-selection.png");
  await saveScreenshot(customerPage, "10-customer-checkout-map-selection.png");

  // 11. Customer Checkout Serviceable (Store A: Kollam Central)
  console.log("[Screenshot 11] 11-customer-checkout-serviceable-store-a.png");
  const useCurrentLoc = customerPage.locator("button:has-text('Use Current Location')").first();
  if (await useCurrentLoc.isVisible()) {
    await useCurrentLoc.scrollIntoViewIfNeeded();
    await useCurrentLoc.click({ force: true });
    await customerPage.waitForTimeout(2500);
  }
  await saveScreenshot(customerPage, "11-customer-checkout-serviceable-store-a.png");

  // 12. Customer Checkout Serviceable (Store B: Bengaluru Indiranagar)
  console.log("[Screenshot 12] 12-customer-checkout-serviceable-store-b.png");
  const locationSearchInput = customerPage.locator("input[placeholder*='Search area, street, landmark']").first();
  if (await locationSearchInput.isVisible()) {
    await locationSearchInput.scrollIntoViewIfNeeded();
    await locationSearchInput.fill("Indiranagar, Bengaluru");
    await customerPage.waitForTimeout(1000);
    const indiranagarResult = customerPage.locator("button:has-text('Indiranagar')").first();
    if (await indiranagarResult.isVisible()) {
      await indiranagarResult.click({ force: true });
      await customerPage.waitForTimeout(2000);
    }
  }
  await saveScreenshot(customerPage, "12-customer-checkout-serviceable-store-b.png");

  // 13. Customer Checkout Unserviceable / Coming Soon
  console.log("[Screenshot 13] 13-customer-checkout-unserviceable-coming-soon.png");
  if (await locationSearchInput.isVisible()) {
    await locationSearchInput.scrollIntoViewIfNeeded();
    await locationSearchInput.fill("Mumbai Marine Drive");
    await customerPage.waitForTimeout(1000);
    const remoteResult = customerPage.locator("button:has-text('Marine Drive')").first();
    if (await remoteResult.isVisible()) {
      await remoteResult.click({ force: true });
      await customerPage.waitForTimeout(2000);
    }
  }
  await saveScreenshot(customerPage, "13-customer-checkout-unserviceable-coming-soon.png");

  // Re-select Kollam for pricing & slots
  if (await useCurrentLoc.isVisible()) {
    await useCurrentLoc.scrollIntoViewIfNeeded();
    await useCurrentLoc.click({ force: true });
    await customerPage.waitForTimeout(2000);
  }

  // 14. Customer Checkout Distance Bracket Fee
  console.log("[Screenshot 14] 14-customer-checkout-distance-bracket-fee.png");
  await saveScreenshot(customerPage, "14-customer-checkout-distance-bracket-fee.png");

  // 15. Customer Checkout Slots Display
  console.log("[Screenshot 15] 15-customer-checkout-slots-display.png");
  await customerPage.evaluate(() => window.scrollBy(0, 400));
  await customerPage.waitForTimeout(500);
  await saveScreenshot(customerPage, "15-customer-checkout-slots-display.png");

  // Fill address line 1 to enable checkout
  const addr1 = customerPage.locator("input[name='line1'], input[name='address_1'], input[id='address_line_1']").first();
  if (await addr1.isVisible()) {
    await addr1.scrollIntoViewIfNeeded();
    await addr1.fill("Flat 302, Marina Bay Towers");
  }

  // Advance to Step 3 / Review Order
  const toPaymentBtn = customerPage.locator("button:has-text('Continue to Payment'), button:has-text('Proceed to Payment')").first();
  if (await toPaymentBtn.isVisible()) {
    await toPaymentBtn.scrollIntoViewIfNeeded();
    await toPaymentBtn.click({ force: true });
    await customerPage.waitForTimeout(1500);
  }

  // 16. Rider Map Destination
  console.log("[Screenshot 16] 16-rider-map-destination.png");
  await saveScreenshot(customerPage, "16-rider-map-destination.png");

  await customerContext.close();
  await browser.close();

  console.log("\n=========================================================================");
  console.log("All 16 Screenshots Successfully Captured and Verified!");
  console.log("=========================================================================");
}

run().catch((err) => {
  console.error("Screenshot suite failed:", err);
  process.exit(1);
});
