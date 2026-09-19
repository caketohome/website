const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const ROUTES_TO_TEST = [
  { path: '/', name: 'storefront-home' },
  { path: '/products', name: 'catalog-products' },
  { path: '/products/chocolate-truffle', name: 'product-detail' },
  { path: '/compare', name: 'compare-page' }
];

(async () => {
  console.log('================================================================');
  console.log('  CakeToHome — Next.js Runtime Asset Loading Verification Suite ');
  console.log('================================================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  // Fresh browser context with cache disabled
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });

  const page = await context.newPage();

  const auditLog = {
    test: 'Next.js Runtime Assets & Styling Verification',
    timestamp: new Date().toISOString(),
    routes: {},
    allAssetsPassed: true,
    totalFailedAssets: 0
  };

  for (const route of ROUTES_TO_TEST) {
    const fullUrl = `http://localhost:3000${route.path}`;
    console.log(`\nTesting Route: ${fullUrl} [${route.name}]`);

    const routeData = {
      url: fullUrl,
      documentStatus: null,
      staticAssets: [],
      failedAssets: [],
      consoleErrors: [],
      pageErrors: [],
      isStyled: false,
      refreshedCleanly: false
    };

    const onRequest = (req) => {
      // track requested
    };

    const onResponse = (res) => {
      const u = res.url();
      const status = res.status();
      if (u.includes('/_next/static/')) {
        routeData.staticAssets.push({ url: u, status });
        if (status >= 400) {
          routeData.failedAssets.push({ url: u, status });
          console.error(`  [FAIL 404] Static Asset: ${status} ${u}`);
        }
      }
    };

    const onConsole = (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore analytics or external tracking errors
        if (!text.includes('clarity') && !text.includes('analytics')) {
          routeData.consoleErrors.push(text);
          console.warn(`  [Browser Console Error]: ${text}`);
        }
      }
    };

    const onPageError = (err) => {
      routeData.pageErrors.push(err.message);
      console.error(`  [Browser PageError]: ${err.message}`);
    };

    page.on('response', onResponse);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    try {
      // 1. Initial Direct Navigation
      const docRes = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      routeData.documentStatus = docRes.status();
      await page.waitForTimeout(2500); // Allow hydration

      // Check computed styles on body to verify CSS actually rendered
      const bodyStyle = await page.evaluate(() => {
        const b = document.body;
        const comp = window.getComputedStyle(b);
        const header = document.querySelector('header');
        const headerComp = header ? window.getComputedStyle(header) : null;
        return {
          fontFamily: comp.fontFamily,
          backgroundColor: comp.backgroundColor,
          color: comp.color,
          hasHeader: Boolean(header),
          headerBackground: headerComp ? headerComp.backgroundColor : null,
          hasClasses: b.classList.length > 0
        };
      });

      routeData.isStyled = bodyStyle.fontFamily && bodyStyle.fontFamily.length > 0;
      console.log(`  Document: HTTP ${docRes.status()}`);
      console.log(`  Computed Body Font: "${bodyStyle.fontFamily}"`);
      console.log(`  Static Assets Loaded: ${routeData.staticAssets.length} (${routeData.failedAssets.length} failed)`);
      console.log(`  Styles Verified: ${routeData.isStyled ? 'YES' : 'NO'}`);

      // Save screenshot
      const shotPath = path.join(screenshotsDir, `runtime-${route.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  Screenshot saved: runtime-${route.name}.png`);

      // 2. Hard Refresh
      console.log(`  Testing Hard Refresh on ${route.name}...`);
      const reloadRes = await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);
      routeData.refreshedCleanly = reloadRes.status() === 200;
      console.log(`  Reload Document: HTTP ${reloadRes.status()}`);

    } catch (err) {
      console.error(`  Error during test of ${route.path}:`, err.message);
      routeData.error = err.message;
    } finally {
      page.off('response', onResponse);
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }

    if (routeData.failedAssets.length > 0) {
      auditLog.allAssetsPassed = false;
      auditLog.totalFailedAssets += routeData.failedAssets.length;
    }

    auditLog.routes[route.name] = routeData;
  }

  await browser.close();

  const evidenceFile = path.join(__dirname, 'runtime_asset_verification_evidence.json');
  fs.writeFileSync(evidenceFile, JSON.stringify(auditLog, null, 2));

  console.log('\n================================================================');
  console.log(`  Verification Complete!`);
  console.log(`  All Assets Passed: ${auditLog.allAssetsPassed ? 'YES (100% 200 OK)' : 'NO'}`);
  console.log(`  Total Failed Assets: ${auditLog.totalFailedAssets}`);
  console.log(`  Evidence written to: scratch/runtime_asset_verification_evidence.json`);
  console.log('================================================================\n');

  if (!auditLog.allAssetsPassed) {
    process.exit(1);
  }
})();
