const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('================================================================');
  console.log('--- STARTING COMPLETE CAKETOHOME BOTTOM SPACING VERIFICATION ---');
  console.log('================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Add cookies for authenticated routes
  await context.addCookies([
    { name: '_cth_jwt', value: 'mock_jwt_session', domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_1', domain: 'localhost', path: '/' },
    { name: '_cth_phone', value: '+91 98765 00000', domain: 'localhost', path: '/' },
  ]);

  const outDir = path.join(__dirname, 'screenshots_final_verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ── PART 1: RESPONSIVE VIEWPORT TESTING (12 VIEWPORTS) ──
  const viewports = [
    { name: '320x568_iPhoneSE_old', width: 320, height: 568 },
    { name: '360x640_GalaxyS5', width: 360, height: 640 },
    { name: '375x667_iPhone8', width: 375, height: 667 },
    { name: '390x844_iPhone12_13_14', width: 390, height: 844 },
    { name: '412x915_Pixel7', width: 412, height: 915 },
    { name: '430x932_iPhone14ProMax', width: 430, height: 932 },
    { name: '768x1024_iPadPortrait', width: 768, height: 1024 },
    { name: '820x1180_iPadAir', width: 820, height: 1180 },
    { name: '1024x768_iPadLandscape', width: 1024, height: 768 },
    { name: '1280x720_HDDesktop', width: 1280, height: 720 },
    { name: '1440x900_MacBook', width: 1440, height: 900 },
    { name: '1920x1080_FHDDesktop', width: 1920, height: 1080 },
  ];

  console.log('\n--- PART 1: TESTING ALL 12 REQUIRED VIEWPORTS ON HOMEPAGE ---');
  const viewportResults = [];

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    try {
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);

      const metrics = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;
        const footer = document.querySelector('footer');
        const main = document.querySelector('main');
        const sommelier = document.querySelector('button[aria-label="Open AI Bakery Concierge"]');
        const whatsapp = document.querySelector('button[aria-label="Contact CakeToHome on WhatsApp"]');

        const fStyle = footer ? window.getComputedStyle(footer) : null;
        const fRect = footer ? footer.getBoundingClientRect() : null;

        return {
          scrollWidth: html.scrollWidth,
          clientWidth: html.clientWidth,
          hasHorizontalOverflow: html.scrollWidth > html.clientWidth,
          footerFound: Boolean(footer),
          footerBg: fStyle ? fStyle.backgroundColor : null,
          footerColor: fStyle ? fStyle.color : null,
          footerHeight: footer ? footer.offsetHeight : 0,
          mainHeight: main ? main.offsetHeight : 0,
          hasSommelier: Boolean(sommelier),
          hasWhatsApp: Boolean(whatsapp),
          pageHeight: body.scrollHeight
        };
      });

      // Scroll to bottom to inspect footer & floating buttons
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      const screenshotName = `vp_${vp.name}.png`;
      await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: false });

      const pass = !metrics.hasHorizontalOverflow && metrics.footerFound && metrics.footerBg !== 'rgba(0, 0, 0, 0)';
      console.log(`  [${vp.name}] Pass: ${pass} | Overflow: ${metrics.hasHorizontalOverflow} | FooterBg: ${metrics.footerBg} | Screenshot: ${screenshotName}`);

      viewportResults.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        pass,
        ...metrics
      });
    } catch (e) {
      console.error(`  [${vp.name}] Error:`, e.message);
      viewportResults.push({ viewport: vp.name, error: e.message, pass: false });
    } finally {
      await page.close();
    }
  }

  // ── PART 2: TESTING MULTIPLE ROUTE TYPES ──
  console.log('\n--- PART 2: TESTING MULTIPLE STORE & CHECKOUT ROUTES ---');
  const routes = [
    { name: 'homepage', url: 'http://localhost:3000/' },
    { name: 'pdp_chocolate_truffle', url: 'http://localhost:3000/products/chocolate-truffle' },
    { name: 'search_page', url: 'http://localhost:3000/search' },
    { name: 'categories_page', url: 'http://localhost:3000/categories' },
    { name: 'occasion_page', url: 'http://localhost:3000/occasions/birthday' },
    { name: 'cart_page', url: 'http://localhost:3000/cart' },
    { name: 'checkout_page', url: 'http://localhost:3000/checkout' },
    { name: 'account_hub', url: 'http://localhost:3000/account' }
  ];

  const routeResults = [];

  for (const r of routes) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });

    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);

      const pageMetrics = await page.evaluate(() => {
        const footer = document.querySelector('footer');
        const main = document.querySelector('main');
        const html = document.documentElement;

        const fStyle = footer ? window.getComputedStyle(footer) : null;

        return {
          hasHorizontalOverflow: html.scrollWidth > html.clientWidth,
          footerFound: Boolean(footer),
          footerBg: fStyle ? fStyle.backgroundColor : null,
          footerColor: fStyle ? fStyle.color : null,
          mainMinHeight: main ? window.getComputedStyle(main).minHeight : null,
          mainHeight: main ? main.offsetHeight : null
        };
      });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      const screenshotName = `route_${r.name}_mobile.png`;
      await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: false });

      console.log(`  [${r.name}] URL: ${r.url} | FooterBg: ${pageMetrics.footerBg} | Overflow: ${pageMetrics.hasHorizontalOverflow}`);
      routeResults.push({ name: r.name, url: r.url, ...pageMetrics });
    } catch (e) {
      console.warn(`  [${r.name}] Warning: ${e.message}`);
      routeResults.push({ name: r.name, url: r.url, error: e.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const report = {
    timestamp: new Date().toISOString(),
    viewportsTotal: viewportResults.length,
    viewportsPassed: viewportResults.filter(v => v.pass).length,
    routesTested: routeResults.length,
    viewportResults,
    routeResults
  };

  fs.writeFileSync(path.join(outDir, 'verification_summary.json'), JSON.stringify(report, null, 2));
  console.log('\n================================================================');
  console.log(`--- COMPLETE VERIFICATION FINISHED: ${report.viewportsPassed}/${report.viewportsTotal} VIEWPORTS PASSED ---`);
  console.log('================================================================');
})();
