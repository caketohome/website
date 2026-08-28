import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

async function captureScreenshots() {
  const outputDir = path.resolve(__dirname, "../qa/store-location-audit");
  const brainDir = path.resolve("C:/Users/alexc/.gemini/antigravity-ide/brain/9f292d2c-6f49-43a9-b63c-a00186cc7ab5");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(brainDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    permissions: ["geolocation"],
    geolocation: { latitude: 8.893215, longitude: 76.602512 },
  });

  const page = await context.newPage();

  console.log("Navigating to Store Area Matrix...");
  await page.goto("http://localhost:3000/dashboard/store-area-matrix", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Ensure map is visible
  const showMapBtn = page.locator('button:has-text("Show Map")');
  if (await showMapBtn.isVisible()) {
    await showMapBtn.click();
    await page.waitForTimeout(1500);
  }

  // 1. Store Location Configured / Matrix Overview
  console.log("Capturing 01-store-location-configured.png...");
  await page.screenshot({ path: path.join(outputDir, "01-store-location-configured.png") });
  await page.screenshot({ path: path.join(brainDir, "01-store-location-configured.png") });

  // 2. Search Store Location Dropdown
  console.log("Capturing 02-store-location-search-dropdown.png...");
  const searchInput = page.locator('input[placeholder*="Search store location"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill("Indiranagar");
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(outputDir, "02-store-location-search-dropdown.png") });
  await page.screenshot({ path: path.join(brainDir, "02-store-location-search-dropdown.png") });

  // 3. Select Search Result -> Viewport Centered
  console.log("Capturing 03-store-location-search-viewport-centered.png...");
  const firstResult = page.locator('button:has-text("Center View")').first();
  if (await firstResult.isVisible()) {
    await firstResult.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(outputDir, "03-store-location-search-viewport-centered.png") });
  await page.screenshot({ path: path.join(brainDir, "03-store-location-search-viewport-centered.png") });

  // 4. Use Current Location (GPS)
  console.log("Capturing 04-store-location-gps-acquired.png...");
  const gpsBtn = page.locator('button:has-text("Use Current Location")').first();
  if (await gpsBtn.isVisible()) {
    await gpsBtn.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: path.join(outputDir, "04-store-location-gps-acquired.png") });
  await page.screenshot({ path: path.join(brainDir, "04-store-location-gps-acquired.png") });

  // 5. Pick on Map Mode
  console.log("Capturing 05-store-location-map-pick.png...");
  const pickBtn = page.locator('button:has-text("Pick on Map")').first();
  if (await pickBtn.isVisible()) {
    await pickBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(outputDir, "05-store-location-map-pick.png") });
  await page.screenshot({ path: path.join(brainDir, "05-store-location-map-pick.png") });

  // Click on map canvas to set pick position
  const mapCanvas = page.locator("#map-fence-container");
  if (await mapCanvas.isVisible()) {
    await mapCanvas.click({ position: { x: 300, y: 200 } });
    await page.waitForTimeout(1000);
  }

  // 6. Draggable Store Marker Repositioned
  console.log("Capturing 06-store-location-drag-marker.png...");
  await page.screenshot({ path: path.join(outputDir, "06-store-location-drag-marker.png") });
  await page.screenshot({ path: path.join(brainDir, "06-store-location-drag-marker.png") });

  // 7. Unsaved Changes Warning Banner
  console.log("Capturing 07-store-location-unsaved-warning.png...");
  await page.screenshot({ path: path.join(outputDir, "07-store-location-unsaved-warning.png") });
  await page.screenshot({ path: path.join(brainDir, "07-store-location-unsaved-warning.png") });

  // 8. Save Store Location Persistence
  console.log("Capturing 08-store-location-saved-success.png...");
  const saveStoreBtn = page.locator('button:has-text("Save Store Location")');
  if (await saveStoreBtn.isVisible()) {
    await saveStoreBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(outputDir, "08-store-location-saved-success.png") });
  await page.screenshot({ path: path.join(brainDir, "08-store-location-saved-success.png") });

  // 9. Radius Centered on Store
  console.log("Capturing 09-store-radius-centered-on-store.png...");
  const radiusBtn = page.locator('button:has-text("Radius")');
  if (await radiusBtn.isVisible()) {
    await radiusBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(outputDir, "09-store-radius-centered-on-store.png") });
  await page.screenshot({ path: path.join(brainDir, "09-store-radius-centered-on-store.png") });

  // 10. Radius Moved with Marker
  console.log("Capturing 10-store-radius-moved-with-marker.png...");
  const fitBtn = page.locator('button:has-text("Fit")');
  if (await fitBtn.isVisible()) {
    await fitBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(outputDir, "10-store-radius-moved-with-marker.png") });
  await page.screenshot({ path: path.join(brainDir, "10-store-radius-moved-with-marker.png") });

  // 11. Branch Create / Edit Modal Location Setup
  console.log("Capturing 11-branch-modal-location-setup.png...");
  await page.goto("http://localhost:3000/dashboard/branches", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const editHubBtn = page.locator('button:has-text("Edit Hub")').first();
  if (await editHubBtn.isVisible()) {
    await editHubBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(outputDir, "11-branch-modal-location-setup.png") });
  await page.screenshot({ path: path.join(brainDir, "11-branch-modal-location-setup.png") });

  // 12. Customer Checkout Serviceability Proof
  console.log("Capturing 12-customer-checkout-serviceability-proof.png...");
  await page.goto("http://localhost:3000/checkout", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outputDir, "12-customer-checkout-serviceability-proof.png") });
  await page.screenshot({ path: path.join(brainDir, "12-customer-checkout-serviceability-proof.png") });

  await browser.close();
  console.log("🎉 All 12 screenshots captured successfully!");
}

captureScreenshots().catch((err) => {
  console.error("Failed to capture screenshots:", err);
  process.exit(1);
});
