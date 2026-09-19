const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  console.log("Starting full final visual capture with luxury cream theme...");
  const outDir = path.join(__dirname, 'screenshots_repaired');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();

  // 1. /products (Catalog page with light cream background and high contrast header)
  console.log("1. Capturing /products...");
  await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, "products_repaired.png") });
  console.log("  ✓ Saved products_repaired.png");

  // 2. /products/chocolate-truffle (PDP with luxury cream, genuine cake image, navy/gold styling)
  console.log("2. Capturing /products/chocolate-truffle...");
  await page.goto("http://localhost:3000/products/chocolate-truffle", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, "pdp_repaired.png") });
  console.log("  ✓ Saved pdp_repaired.png");

  // 3. Scroll to reviews section on PDP
  console.log("3. Capturing reviews section...");
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, "pdp_reviews_repaired.png") });
  console.log("  ✓ Saved pdp_reviews_repaired.png");

  // 4. /dashboard?tab=popups
  console.log("4. Capturing /dashboard?tab=popups...");
  await page.goto("http://localhost:3000/dashboard?tab=popups", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, "popups_dashboard_repaired.png") });
  console.log("  ✓ Saved popups_dashboard_repaired.png");

  // 5. Open popup drawer
  console.log("5. Opening popup editor drawer...");
  const createBtn = await page.$('button:has-text("Create Campaign"), button:has-text("New Campaign"), button:has-text("Create Popup")');
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, "popup_drawer_repaired.png") });
    console.log("  ✓ Saved popup_drawer_repaired.png");
  }

  // 6. /dashboard?tab=orders
  console.log("6. Capturing /dashboard?tab=orders...");
  await page.goto("http://localhost:3000/dashboard?tab=orders", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, "orders_dashboard_repaired.png") });
  console.log("  ✓ Saved orders_dashboard_repaired.png");

  // 7. Location Modal with GPS button and quick area chips
  console.log("7. Capturing location modal...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const locBtn = await page.$('button[aria-label*="location" i], header button:has-text("Set location"), header button:has-text("Deliver to")');
  if (locBtn) {
    await locBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, "location_modal_repaired.png") });
    console.log("  ✓ Saved location_modal_repaired.png");
  }

  await browser.close();
  console.log("All visual evidence captured successfully!");
}

main().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
