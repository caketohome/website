import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { ApiEngine } from "../src/lib/api-engine";

async function capture() {
  const artifactDir = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\9f292d2c-6f49-43a9-b63c-a00186cc7ab5";
  fs.mkdirSync(artifactDir, { recursive: true });

  const cart = ApiEngine.createCart();
  ApiEngine.addToCart(cart.id, {
    id: "prod_truffle_capture",
    product_id: "prod_truffle_capture",
    title: "Belgian Dark Chocolate Truffle Cake",
    price: 649,
    quantity: 1,
    weight: "1 Kg",
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    permissions: ["geolocation"],
    geolocation: { latitude: 8.8932, longitude: 76.6141 }, // Kollam Central Cake Studio
  });

  await context.addCookies([
    {
      name: "_cth_cart_id",
      value: cart.id,
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cth_role",
      value: "super_admin",
      domain: "localhost",
      path: "/",
    },
    {
      name: "_cth_jwt",
      value: "mock_super_admin_jwt",
      domain: "localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  console.log("Navigating to Checkout with geolocation mock...");
  await page.goto("http://localhost:3000/checkout", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Click continue to Step 2
  const continueBtn = page.locator('button:has-text("Continue to Delivery Mode & Slots")').first();
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click "Use Current Location" to acquire GPS coordinates inside the serviceable area
  const gpsBtn = page.locator('button:has-text("Use Current Location")').first();
  if (await gpsBtn.isVisible()) {
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/checkout/availability") && r.status() === 200,
      { timeout: 10000 }
    );
    await gpsBtn.click();
    const gpsRes = await responsePromise;
    const gpsJson = await gpsRes.json();
    console.log("Today Availability Response slots count:", gpsJson.available_slots?.length);
    console.log("Today slots:", gpsJson.available_slots?.map((s: any) => s.slot_name));
    await page.waitForTimeout(1500);
  }

  // Screenshot 3: Serviceable location acquired -> Serving store summary, date pills, slots (Express 45-min active)
  await page.screenshot({
    path: path.join(artifactDir, "03-checkout-step2-serviceable-today-slots.png"),
    fullPage: true,
  });
  console.log("Captured: 03-checkout-step2-serviceable-today-slots.png");

  // Click Tomorrow date pill and wait for the availability API response for tomorrow
  const tomorrowBtn = page.locator('button:has-text("Tomorrow")').first();
  if (await tomorrowBtn.isVisible()) {
    const tomorrowResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/checkout/availability") && r.status() === 200,
      { timeout: 10000 }
    );
    await tomorrowBtn.click();
    const tomorrowRes = await tomorrowResponsePromise;
    console.log("Tomorrow request URL:", tomorrowRes.url());
    const tomorrowJson = await tomorrowRes.json();
    console.log("Tomorrow Availability Response slots count:", tomorrowJson.available_slots?.length);
    console.log("Tomorrow slots:", tomorrowJson.available_slots?.map((s: any) => s.slot_name));
    await page.waitForTimeout(2000);
  }

  // Screenshot 4: Tomorrow date selected -> Express 45-min SUPPRESSED, Standard and Midnight active
  await page.screenshot({
    path: path.join(artifactDir, "04-checkout-step2-tomorrow-express-suppressed.png"),
    fullPage: true,
  });
  console.log("Captured: 04-checkout-step2-tomorrow-express-suppressed.png");

  await browser.close();
  console.log("🎉 Enhanced Visual Audit Complete!");
}

capture().catch((e) => {
  console.error("Capture error:", e);
  process.exit(1);
});
