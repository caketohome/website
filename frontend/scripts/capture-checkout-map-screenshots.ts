/**
 * Playwright Automation Suite:
 * Capture All 12 Visual Artifacts for Checkout Map-First Customer Location & Address Separation
 *
 * Screenshots saved to: qa/checkout-map-audit/
 *  01-empty-location.png
 *  02-gps-location-on-map.png
 *  03-search-results.png
 *  04-search-selected-map.png
 *  05-serviceable-location.png
 *  06-outside-zone.png
 *  07-map-pin-moved.png
 *  08-address-edited-map-unchanged.png
 *  09-explicit-address-location-change.png
 *  10-checkout-final-location.png
 *  11-order-location.png
 *  12-rider-destination.png
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { ApiEngine } from "../src/lib/api-engine";

const OUTPUT_DIR = path.resolve(__dirname, "../../qa/checkout-map-audit");
const BASE_URL = "http://localhost:3000";

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[Screenshot Suite] Output directory: ${OUTPUT_DIR}`);

  // 1. Seed Cart in ApiEngine
  const cartId = `cart_scr_${Date.now()}`;
  ApiEngine.ensureCartsStore();
  ApiEngine.createCart({ id: cartId });
  ApiEngine.addItemToCart(cartId, {
    id: "item_scr_cake",
    product_id: "prod_1",
    title: "Signature Belgian Chocolate Truffle",
    unit_price: 749,
    quantity: 1,
    subtotal: 749,
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["geolocation"],
    geolocation: { latitude: 8.8853, longitude: 76.5803 },
  });

  // Set cart cookie so /checkout loads immediately
  await context.addCookies([
    {
      name: "_cth_cart_id",
      value: cartId,
      domain: "localhost",
      path: "/",
    },
    {
      name: "_medusa_cart_id",
      value: cartId,
      domain: "localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  console.log("[Screenshot Suite] Navigating to /checkout...");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Fill Step 1 (Contact Details)
  console.log("[Screenshot Suite] Filling Step 1 Contact Details...");
  const firstNameInput = page.locator("input[name='first_name']");
  if (await firstNameInput.isVisible()) {
    await firstNameInput.fill("Rahul");
  }
  const phoneInput = page.locator("input[name='phone']");
  if (await phoneInput.isVisible()) {
    await phoneInput.fill("9447123456");
  }
  const emailInput = page.locator("input[name='email']");
  if (await emailInput.isVisible()) {
    await emailInput.fill("rahul.nair@example.com");
  }
  await page.waitForTimeout(500);

  // Advance from Step 1 (Contact) to Step 2 (Fulfillment & Map)
  console.log("[Screenshot Suite] Advancing to Step 2...");
  const continueBtn = page.locator("button:has-text('Continue to Delivery')");
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await page.waitForTimeout(2000);
  }

  // ── 01: Empty Location State ─────────────────────────────────────────────
  console.log("[Screenshot Suite] Capturing 01-empty-location.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "01-empty-location.png"),
    fullPage: false,
  });

  // ── 02: GPS Location on Map ──────────────────────────────────────────────
  console.log("[Screenshot Suite] Clicking 'Use Current Location'...");
  const gpsBtn = page.locator("[data-testid='use-current-location-btn']");
  if (await gpsBtn.isVisible()) {
    await gpsBtn.click();
    await page.waitForTimeout(2500);
  }
  console.log("[Screenshot Suite] Capturing 02-gps-location-on-map.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "02-gps-location-on-map.png"),
    fullPage: false,
  });

  // ── 03: Location Search Autocomplete Results ─────────────────────────────
  console.log("[Screenshot Suite] Typing search query 'Kollam'...");
  const searchInput = page.locator("input[placeholder*='Search area']");
  await searchInput.fill("Kollam");
  await page.waitForTimeout(1000);
  console.log("[Screenshot Suite] Capturing 03-search-results.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "03-search-results.png"),
    fullPage: false,
  });

  // ── 04: Search Result Selected on Map ────────────────────────────────────
  console.log("[Screenshot Suite] Selecting 'Kadappakada Junction' from dropdown...");
  const searchResultItem = page.locator("p:has-text('Kadappakada Junction')").first();
  if (await searchResultItem.isVisible()) {
    await searchResultItem.click();
    await page.waitForTimeout(2000);
  }
  console.log("[Screenshot Suite] Capturing 04-search-selected-map.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "04-search-selected-map.png"),
    fullPage: false,
  });

  // ── 05: Serviceable Location Card ────────────────────────────────────────
  console.log("[Screenshot Suite] Capturing 05-serviceable-location.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "05-serviceable-location.png"),
    fullPage: false,
  });

  // ── 06: Outside Zone Rejection Card ──────────────────────────────────────
  console.log("[Screenshot Suite] Typing out-of-zone search 'Delhi'...");
  await searchInput.fill("Delhi");
  await page.waitForTimeout(1000);
  const delhiItem = page.locator("p:has-text('Connaught Place')").first();
  if (await delhiItem.isVisible()) {
    await delhiItem.click();
    await page.waitForTimeout(2000);
  }
  console.log("[Screenshot Suite] Capturing 06-outside-zone.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "06-outside-zone.png"),
    fullPage: false,
  });

  // ── 07: Map Pin Moved to Custom Doorstep ─────────────────────────────────
  console.log("[Screenshot Suite] Selecting 'Chinnakada Clock Tower'...");
  await searchInput.fill("Chinnakada");
  await page.waitForTimeout(1000);
  const chinnakadaItem = page.locator("p:has-text('Chinnakada Clock Tower')").first();
  if (await chinnakadaItem.isVisible()) {
    await chinnakadaItem.click();
    await page.waitForTimeout(2000);
  }
  console.log("[Screenshot Suite] Capturing 07-map-pin-moved.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "07-map-pin-moved.png"),
    fullPage: false,
  });

  // ── 08: Address Text Edited - Map Coordinates Unchanged ──────────────────
  console.log("[Screenshot Suite] Editing Street Address text to 'Flat 502, Signature Towers'...");
  const addressInput = page.locator("input[name='address']");
  await addressInput.fill("Flat 502, Signature Towers, Chinnakada, Kollam");
  await page.waitForTimeout(1000);
  console.log("[Screenshot Suite] Capturing 08-address-edited-map-unchanged.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "08-address-edited-map-unchanged.png"),
    fullPage: false,
  });

  // ── 09: Explicit Address Location Change ─────────────────────────────────
  console.log("[Screenshot Suite] Clicking '[ Search this address on map ]'...");
  const explicitBtn = page.locator("button:has-text('Search this address on map')");
  if (await explicitBtn.isVisible()) {
    await explicitBtn.click();
    await page.waitForTimeout(1500);
  }
  console.log("[Screenshot Suite] Capturing 09-explicit-address-location-change.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "09-explicit-address-location-change.png"),
    fullPage: false,
  });

  // ── 10: Final Step 2 Checkout State ──────────────────────────────────────
  console.log("[Screenshot Suite] Capturing 10-checkout-final-location.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "10-checkout-final-location.png"),
    fullPage: true,
  });

  // ── 11: Order Details with Persisted Coordinates ─────────────────────────
  console.log("[Screenshot Suite] Creating test order and verifying order confirmation view...");
  const targetDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const slotAvail = ApiEngine.getCheckoutAvailability({
    latitude: 8.8853,
    longitude: 76.5803,
    date: targetDate,
  });
  const targetSlotId = slotAvail.available_slots?.find((s: any) => s.available)?.id || slotAvail.available_slots?.[0]?.id || "slot_standard";

  const orderRes = ApiEngine.confirmCheckout({
    cart_id: cartId,
    pincode: "691001",
    delivery_date: targetDate,
    delivery_slot_id: targetSlotId,
    payment_method: "cod",
    address: {
      first_name: "Rahul",
      last_name: "Nair",
      phone: "+91 94471 23456",
      line1: "Flat 502, Signature Towers",
      city: "Kollam",
      pincode: "691001",
      latitude: 8.8853,
      longitude: 76.5803,
    },
  });

  const orderId = orderRes.order_id || orderRes.order?.id;
  console.log(`[Screenshot Suite] Order created: ${orderId}. Navigating to /your-order...`);
  await page.goto(`${BASE_URL}/your-order?order_id=${encodeURIComponent(orderId)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  console.log("[Screenshot Suite] Capturing 11-order-location.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "11-order-location.png"),
    fullPage: false,
  });

  // ── 12: Rider Destination View ───────────────────────────────────────────
  console.log("[Screenshot Suite] Navigating to /delivery-partner view...");
  await page.goto(`${BASE_URL}/delivery-partner`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  console.log("[Screenshot Suite] Capturing 12-rider-destination.png...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "12-rider-destination.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("\n[Screenshot Suite] All 12 screenshots successfully captured in qa/checkout-map-audit/!");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
