const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  const outDir = path.join(__dirname, 'screenshots_repaired');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("1. Visiting /products (refresh check)...");
  await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, "products_repaired.png"), fullPage: false });
  console.log("Saved products_repaired.png");

  console.log("2. Visiting /dashboard?tab=popups with admin session...");
  await page.goto("http://localhost:3000/dashboard?tab=popups", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, "popups_dashboard_repaired.png"), fullPage: false });
  console.log("Saved popups_dashboard_repaired.png");

  console.log("3. Opening Popup Editor Drawer...");
  const createBtn = await page.$('button:has-text("Create Campaign"), button:has-text("New Campaign"), button:has-text("Create Popup")');
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, "popup_drawer_repaired.png"), fullPage: false });
    console.log("Saved popup_drawer_repaired.png");
  } else {
    // Try clicking edit on first campaign row
    const editBtn = await page.$('button:has-text("Edit")');
    if (editBtn) {
      await editBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(outDir, "popup_drawer_repaired.png"), fullPage: false });
      console.log("Saved popup_drawer_repaired.png (from edit button)");
    }
  }

  await browser.close();
  console.log("All dashboard screenshots captured successfully!");
}

main().catch(err => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
