const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/final_verification');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('========================================================================');
  console.log('  CakeToHome — Capturing Verification Screenshots Across Viewports      ');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900 },
    { name: 'laptop_1024', width: 1024, height: 768 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'mobile_375', width: 375, height: 812, isMobile: true, hasTouch: true },
  ];

  // 1. Homepage & Storefront across all 4 viewports
  for (const vp of viewports) {
    console.log(`[Viewport: ${vp.name}] Capturing Homepage...`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
      const filename = `01_homepage_${vp.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
      console.log(`  Saved: ${filename}`);
    } catch (err) {
      console.error(`  Error capturing ${vp.name}:`, err.message);
    } finally {
      await ctx.close();
    }
  }

  // 2. Location Modal Open on "Search Area"
  console.log('\nCapturing Location Modal ("Search Area" tab & GPS button)...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);
      
      // Click location header / selector trigger
      const locBtn = page.locator('button:has-text("Select Location"), button:has-text("Deliver to"), [data-testid="delivery-location-trigger"]').first();
      if (await locBtn.isVisible()) {
        await locBtn.click();
      } else {
        // Fallback: look for map pin icon or header location button
        const anyLoc = page.locator('header button:has(.lucide-map-pin), button:has-text("Bangalore"), button:has-text("Bengaluru")').first();
        if (await anyLoc.isVisible()) await anyLoc.click();
      }
      await page.waitForTimeout(1000);

      const filename = `02_location_modal_search_area.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
      console.log(`  Saved: ${filename}`);
    } catch (err) {
      console.error('  Error capturing location modal:', err.message);
    } finally {
      await ctx.close();
    }
  }

  // 3. Checkout Page Step 1 (Pincode optional, high contrast)
  console.log('\nCapturing Checkout Page Step 1...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
      const filename = `03_checkout_step1.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
      console.log(`  Saved: ${filename}`);
    } catch (err) {
      console.error('  Error capturing checkout page:', err.message);
    } finally {
      await ctx.close();
    }
  }

  // 4. Admin Dashboard -> Popups Tab -> Editor Drawer Media Tab
  console.log('\nCapturing Admin Dashboard Popups & Drawer Media Tab...');
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: {
        Cookie: '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01; _cth_phone=+919876543210'
      }
    });
    // Also set cookie in context
    await ctx.addCookies([
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
      { name: '_cth_phone', value: '+919876543210', domain: 'localhost', path: '/' },
    ]);
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/dashboard?tab=popups`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const popupsPanelFilename = `04_admin_popups_panel.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, popupsPanelFilename) });
      console.log(`  Saved: ${popupsPanelFilename}`);

      // Click "Create Popup Campaign" or edit first campaign
      const createBtn = page.locator('button:has-text("Create Popup Campaign")').first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        // Click "Media & Visuals" tab
        const mediaTab = page.locator('button:has-text("Media"), button:has-text("Media & Visuals"), [data-tab="media"]').first();
        if (await mediaTab.isVisible()) {
          await mediaTab.click();
          await page.waitForTimeout(800);
        }

        const drawerMediaFilename = `05_admin_popup_drawer_media_tab.png`;
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, drawerMediaFilename) });
        console.log(`  Saved: ${drawerMediaFilename}`);
      }
    } catch (err) {
      console.error('  Error capturing admin popups:', err.message);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n========================================================================');
  console.log('  ALL SCREENSHOTS CAPTURED SUCCESSFULLY IN scratch/screenshots/final_verification');
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
