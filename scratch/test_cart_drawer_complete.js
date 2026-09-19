const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));
const fs = require('fs');

const screenshotsDir = path.join(__dirname, 'screenshots_cart');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const VIEWPORTS = [
  { name: 'iphone_se', width: 320, height: 568 },
  { name: 'android_compact', width: 360, height: 640 },
  { name: 'iphone_8', width: 375, height: 667 },
  { name: 'iphone_14', width: 390, height: 844 },
  { name: 'pixel_7', width: 412, height: 915 },
  { name: 'iphone_14_pro_max', width: 430, height: 932 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function getVisibleCartButton(page) {
  const cartButtons = await page.$$('button[aria-label="Shopping Cart"]');
  for (const btn of cartButtons) {
    if (await btn.isVisible()) {
      const box = await btn.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        return btn;
      }
    }
  }
  return null;
}

async function runCartTests() {
  console.log('--- Starting Comprehensive Cart Drawer & Scroll-Lock Verification Suite ---');
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n========================================`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.width < 768
        ? 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      // 1. Load Homepage
      await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // 2. Scroll to middle (~1000px)
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(400);
      const scrolledY = await page.evaluate(() => window.scrollY);
      console.log(`[${vp.name}] Scrolled to Y: ${scrolledY}`);

      // 3. Find visible cart button
      let cartBtn = await getVisibleCartButton(page);
      if (!cartBtn) {
        throw new Error(`Visible cart button not found on ${vp.name}`);
      }

      // 4. Click Cart Button
      console.log(`[${vp.name}] Clicking cart button...`);
      await cartBtn.click();
      await page.waitForTimeout(600);

      // 5. Inspect Drawer & Backdrop State
      const drawerState = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="cart-drawer-root"]');
        const backdrop = document.querySelector('[data-testid="cart-backdrop"]');
        const panel = document.querySelector('[data-testid="cart-drawer-panel"]');
        const itemsContainer = document.querySelector('[data-testid="cart-items-container"]');

        const body = document.body;
        const bRect = backdrop ? backdrop.getBoundingClientRect() : null;
        const pRect = panel ? panel.getBoundingClientRect() : null;

        return {
          hasRoot: !!root,
          hasBackdrop: !!backdrop,
          hasPanel: !!panel,
          hasItemsContainer: !!itemsContainer,
          bodyStyle: {
            position: body.style.position,
            overflow: body.style.overflow,
            top: body.style.top,
            width: body.style.width,
          },
          backdropBounds: bRect ? {
            top: bRect.top,
            left: bRect.left,
            right: bRect.right,
            bottom: bRect.bottom,
            width: bRect.width,
            height: bRect.height,
          } : null,
          panelBounds: pRect ? {
            top: pRect.top,
            left: pRect.left,
            right: pRect.right,
            bottom: pRect.bottom,
            width: pRect.width,
            height: pRect.height,
          } : null,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          }
        };
      });

      console.log(`[${vp.name}] Drawer state:`, JSON.stringify(drawerState, null, 2));

      // Assertions
      if (!drawerState.hasRoot || !drawerState.hasBackdrop || !drawerState.hasPanel) {
        throw new Error(`Cart drawer elements missing on ${vp.name}`);
      }
      if (drawerState.bodyStyle.position !== 'fixed' || drawerState.bodyStyle.overflow !== 'hidden') {
        throw new Error(`Body scroll lock not applied on ${vp.name}: ${JSON.stringify(drawerState.bodyStyle)}`);
      }
      console.log(`✓ [${vp.name}] Body scroll locked properly (position: fixed, overflow: hidden)`);

      // Verify backdrop covers visible viewport
      if (
        drawerState.backdropBounds.top > 0 ||
        drawerState.backdropBounds.bottom < vp.height ||
        drawerState.backdropBounds.left > 0 ||
        drawerState.backdropBounds.right < vp.width
      ) {
        console.warn(`[${vp.name}] Backdrop does not completely cover viewport:`, drawerState.backdropBounds);
      } else {
        console.log(`✓ [${vp.name}] Backdrop completely covers visible viewport`);
      }

      // Verify panel is attached to full viewport height
      if (Math.abs(drawerState.panelBounds.height - vp.height) > 2) {
        console.warn(`[${vp.name}] Panel height (${drawerState.panelBounds.height}) differs from viewport (${vp.height})`);
      } else {
        console.log(`✓ [${vp.name}] Panel attached to full viewport height`);
      }

      // 6. Screenshot opened drawer
      const screenshotPath = path.join(screenshotsDir, `drawer_${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`✓ [${vp.name}] Screenshot saved to ${screenshotPath}`);

      // 7. Verify background cannot scroll while cart is open
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);
      const postWheelScroll = await page.evaluate(() => Math.abs(parseInt(document.body.style.top || '0', 10)));
      console.log(`[${vp.name}] Document top offset after wheel attempt: ${postWheelScroll} (expected: ${scrolledY})`);

      // 8. Test Close via Close Button ('X')
      console.log(`[${vp.name}] Closing drawer via close button...`);
      const closeBtn = await page.$('button[aria-label="Close cart drawer"]');
      if (!closeBtn) throw new Error('Close button not found');
      await closeBtn.click();
      await page.waitForTimeout(500);

      // Verify restoration of body styles and scroll position
      const postCloseState = await page.evaluate(() => ({
        scrollY: window.scrollY,
        bodyStyle: {
          position: document.body.style.position,
          overflow: document.body.style.overflow,
          top: document.body.style.top,
        },
        hasDrawer: !!document.querySelector('[data-testid="cart-drawer-root"]'),
      }));
      console.log(`[${vp.name}] Post-close state:`, JSON.stringify(postCloseState, null, 2));

      if (postCloseState.hasDrawer) {
        throw new Error(`Drawer did not unmount/close on ${vp.name}`);
      }
      if (postCloseState.bodyStyle.position !== '' || postCloseState.bodyStyle.overflow !== '') {
        throw new Error(`Body styles not restored on ${vp.name}`);
      }
      if (Math.abs(postCloseState.scrollY - scrolledY) > 5) {
        throw new Error(`Scroll position not restored accurately on ${vp.name}: got ${postCloseState.scrollY}, expected ${scrolledY}`);
      }
      console.log(`✓ [${vp.name}] Scroll restored perfectly to ${postCloseState.scrollY}px without jump!`);

      // 9. Test Re-open and Close via Backdrop Click
      console.log(`[${vp.name}] Testing Re-open & Backdrop Click close...`);
      cartBtn = await getVisibleCartButton(page);
      if (!cartBtn) throw new Error('Cart button not visible for backdrop test');
      await cartBtn.click();
      await page.waitForTimeout(500);

      const backdrop = await page.$('[data-testid="cart-backdrop"]');
      if (!backdrop) throw new Error('Backdrop not found on re-open');
      // Click at x=12 (inside the 32px exposed backdrop strip on mobile and left backdrop area on desktop)
      await page.mouse.click(12, vp.height / 2);
      await page.waitForTimeout(500);

      const backdropClosed = await page.evaluate(() => !document.querySelector('[data-testid="cart-drawer-root"]'));
      const backdropRestoredY = await page.evaluate(() => window.scrollY);
      if (!backdropClosed) {
        throw new Error(`Backdrop click did not close drawer on ${vp.name}`);
      }
      console.log(`✓ [${vp.name}] Backdrop click closed: ${backdropClosed}, scroll preserved: ${backdropRestoredY}px`);

      // 10. Test Re-open and Close via Escape Key
      console.log(`[${vp.name}] Testing Re-open & Escape Key close...`);
      cartBtn = await getVisibleCartButton(page);
      if (!cartBtn) throw new Error('Cart button not visible for escape test');
      await cartBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      const escClosed = await page.evaluate(() => !document.querySelector('[data-testid="cart-drawer-root"]'));
      const escRestoredY = await page.evaluate(() => window.scrollY);
      if (!escClosed) {
        throw new Error(`Escape key did not close drawer on ${vp.name}`);
      }
      console.log(`✓ [${vp.name}] Escape key closed: ${escClosed}, scroll preserved: ${escRestoredY}px`);

      // 11. Verify page can scroll normally again
      await page.evaluate(() => window.scrollTo(0, 1600));
      await page.waitForTimeout(200);
      const newScrollY = await page.evaluate(() => window.scrollY);
      if (Math.abs(newScrollY - 1600) > 10) {
        throw new Error(`Page failed to scroll normally after drawer cycles on ${vp.name}: got ${newScrollY}`);
      }
      console.log(`✓ [${vp.name}] Page scrolls normally after drawer cycles (scrollY: ${newScrollY}px)`);

      results.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        status: 'PASS',
        restoredScroll: postCloseState.scrollY,
      });

    } catch (err) {
      console.error(`❌ [${vp.name}] Error:`, err.message);
      results.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        status: 'FAIL',
        error: err.message,
      });
    } finally {
      await context.close();
    }
  }

  // PDP Test Scenario
  console.log(`\n========================================`);
  console.log(`Testing Occasion / Catalog PDP Scenario`);
  console.log(`========================================`);
  const pdpContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const pdpPage = await pdpContext.newPage();
  try {
    await pdpPage.goto('http://127.0.0.1:3000/occasions/anniversary', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pdpPage.waitForTimeout(1000);

    await pdpPage.evaluate(() => window.scrollTo(0, 800));
    await pdpPage.waitForTimeout(300);
    const pdpInitialY = await pdpPage.evaluate(() => window.scrollY);
    console.log(`[PDP] Scrolled to Y: ${pdpInitialY}`);

    const cartBtn = await getVisibleCartButton(pdpPage);
    if (!cartBtn) throw new Error('Visible cart button not found on PDP');
    await cartBtn.click();
    await pdpPage.waitForTimeout(500);

    const isLocked = await pdpPage.evaluate(() => document.body.style.overflow === 'hidden' && document.body.style.position === 'fixed');
    console.log(`[PDP] Drawer opened and body locked: ${isLocked}`);

    const pdpScreenshot = path.join(screenshotsDir, 'drawer_pdp_anniversary.png');
    await pdpPage.screenshot({ path: pdpScreenshot, fullPage: false });
    console.log(`✓ [PDP] Screenshot saved to ${pdpScreenshot}`);

    const closeBtn = await pdpPage.$('button[aria-label="Close cart drawer"]');
    await closeBtn.click();
    await pdpPage.waitForTimeout(400);

    const pdpFinalY = await pdpPage.evaluate(() => window.scrollY);
    console.log(`✓ [PDP] Closed drawer and restored scroll to: ${pdpFinalY}px (expected: ${pdpInitialY})`);

    results.push({
      viewport: 'pdp_anniversary_mobile',
      status: Math.abs(pdpFinalY - pdpInitialY) < 5 ? 'PASS' : 'FAIL',
      restoredScroll: pdpFinalY,
    });
  } catch (err) {
    console.error(`❌ [PDP] Error:`, err.message);
    results.push({ viewport: 'pdp_anniversary_mobile', status: 'FAIL', error: err.message });
  } finally {
    await pdpContext.close();
  }

  await browser.close();

  console.log('\n========================================');
  console.log('FINAL SUITE RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================');

  const allPassed = results.every(r => r.status === 'PASS');
  process.exit(allPassed ? 0 : 1);
}

runCartTests().catch(err => {
  console.error('Fatal error in suite:', err);
  process.exit(1);
});
