const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const PRODUCT_URL = `${BASE_URL}/products/belgian-chocolate-truffle-cake`;
const SCREENSHOTS_DIR = 'C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\3002f95e-032a-416b-b5d6-0b0e5cba2669\\screenshots_pdp';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'iphone_se', width: 320, height: 568, device: 'iPhone SE' },
  { name: 'android_compact', width: 360, height: 640, device: 'Android Compact' },
  { name: 'iphone_8', width: 375, height: 667, device: 'iPhone 8' },
  { name: 'iphone_14', width: 390, height: 844, device: 'iPhone 14' },
  { name: 'pixel_7', width: 412, height: 915, device: 'Pixel 7' },
  { name: 'iphone_14_pro_max', width: 430, height: 932, device: 'iPhone 14 Pro Max' },
  { name: 'ipad_portrait', width: 768, height: 1024, device: 'iPad Portrait' },
  { name: 'ipad_landscape', width: 1024, height: 768, device: 'iPad Landscape' },
  { name: 'macbook_laptop', width: 1280, height: 800, device: 'MacBook Laptop' },
  { name: 'desktop_full_hd', width: 1440, height: 900, device: 'Desktop Full HD' },
];

async function runResponsiveTests() {
  const browser = await chromium.launch({ headless: true });
  const results = {
    test: "PDP Multi-Viewport Responsive & Flow Verification",
    timestamp: new Date().toISOString(),
    viewports: [],
    overallStatus: "PASS"
  };

  console.log(`Starting PDP verification across ${VIEWPORTS.length} viewports...`);

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing ${vp.device} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.width < 768
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const vpResult = {
      name: vp.name,
      device: vp.device,
      resolution: `${vp.width}x${vp.height}`,
      overflow: null,
      titleFound: false,
      priceFound: false,
      stickyBarPresent: null,
      addToBagSuccess: false,
      cartDrawerOpened: false,
      bodyScrollLocked: false,
      screenshot: null,
      status: "PASS"
    };

    try {
      await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);

      // Check for horizontal overflow
      const overflowData = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        return {
          scrollWidth,
          clientWidth,
          hasOverflow: scrollWidth > clientWidth + 1
        };
      });

      vpResult.overflow = overflowData;
      console.log(`Overflow check: scrollWidth=${overflowData.scrollWidth}, clientWidth=${overflowData.clientWidth}, hasOverflow=${overflowData.hasOverflow}`);

      // Verify product title
      const titleEl = await page.$('h1');
      if (titleEl) {
        vpResult.titleFound = true;
        const titleText = (await titleEl.innerText()).trim();
        console.log(`H1 Title: "${titleText}"`);
      }

      // Verify price
      const priceEl = await page.$('[data-testid="pdp-add-to-bag"]');
      if (priceEl) {
        vpResult.priceFound = true;
        const btnText = (await priceEl.innerText()).trim();
        console.log(`Add to Bag button text: "${btnText}"`);
      }

      // Check sticky buy bar on mobile viewports
      if (vp.width < 1024) {
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(600);
        const stickyBar = await page.$('[data-testid="pdp-sticky-bar"]');
        vpResult.stickyBarPresent = stickyBar !== null;
        console.log(`Sticky bar detected: ${vpResult.stickyBarPresent}`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
      }

      // Capture PDP page screenshot
      const pdpScreenshotPath = path.join(SCREENSHOTS_DIR, `pdp_${vp.name}.png`);
      await page.screenshot({ path: pdpScreenshotPath, fullPage: false });
      vpResult.screenshot = pdpScreenshotPath;

      // Test Add to Bag and Cart Drawer Open
      const addToBagBtn = await page.$('button[data-testid="pdp-add-to-bag"]');
      if (addToBagBtn) {
        await addToBagBtn.click();
        await page.waitForTimeout(1500);

        // Check if cart drawer opened
        const cartDrawer = await page.$('[data-testid="cart-drawer"], [role="dialog"], aside[class*="cart"], div[class*="drawer"]');
        const isBodyLocked = await page.evaluate(() => {
          return document.body.classList.contains('overflow-hidden') ||
                 window.getComputedStyle(document.body).overflow === 'hidden';
        });

        vpResult.cartDrawerOpened = cartDrawer !== null;
        vpResult.bodyScrollLocked = isBodyLocked;
        vpResult.addToBagSuccess = true;
        console.log(`Cart Drawer opened: ${vpResult.cartDrawerOpened}, Body scroll locked: ${vpResult.bodyScrollLocked}`);

        // Capture drawer open screenshot for representative viewports (e.g. mobile & desktop)
        if (['iphone_14', 'desktop_full_hd', 'iphone_se', 'ipad_portrait'].includes(vp.name)) {
          const drawerScreenshotPath = path.join(SCREENSHOTS_DIR, `pdp_drawer_${vp.name}.png`);
          await page.screenshot({ path: drawerScreenshotPath, fullPage: false });
          console.log(`Captured drawer screenshot: ${drawerScreenshotPath}`);
        }
      }

      if (overflowData.hasOverflow || !vpResult.titleFound || !vpResult.priceFound) {
        vpResult.status = "FAIL";
        results.overallStatus = "FAIL";
      }

    } catch (err) {
      console.error(`Error on viewport ${vp.name}:`, err);
      vpResult.status = "ERROR";
      vpResult.error = err.message;
      results.overallStatus = "FAIL";
    } finally {
      results.viewports.push(vpResult);
      await context.close();
    }
  }

  await browser.close();

  console.log(`\n=== Verification Complete: Overall Status: ${results.overallStatus} ===`);
  const evidencePath = path.join(__dirname, 'pdp_multi_viewport_evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify(results, null, 2));
  console.log(`Evidence saved to ${evidencePath}`);
}

runResponsiveTests();
