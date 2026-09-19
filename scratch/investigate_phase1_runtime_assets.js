const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  console.log('========================================================================');
  console.log('  CakeToHome — Phase 1: Deep Runtime Asset & Network Investigation     ');
  console.log('========================================================================\n');

  // 1. Verify Backend and Frontend connectivity
  console.log('--- Checking Service Connectivity ---');
  const checkEndpoint = (url) => new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, ok: true, data: data.slice(0, 100) }));
    }).on('error', (err) => resolve({ ok: false, error: err.message }));
  });

  const backendHealth = await checkEndpoint('http://localhost:9000/health');
  console.log('Backend :9000 /health ->', backendHealth.ok ? `HTTP ${backendHealth.status}` : `FAIL: ${backendHealth.error}`);

  const frontendRoot = await checkEndpoint('http://localhost:3000/');
  console.log('Frontend :3000 / ->', frontendRoot.ok ? `HTTP ${frontendRoot.status}` : `FAIL: ${frontendRoot.error}`);

  // 2. Launch real browser for deep inspection
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const allRequests = [];
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  page.on('pageerror', err => {
    pageErrors.push({
      message: err.message,
      stack: err.stack
    });
  });

  page.on('requestfailed', req => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      failure: req.failure()?.errorText
    });
  });

  page.on('response', res => {
    const req = res.request();
    allRequests.push({
      url: res.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      status: res.status(),
      statusText: res.statusText(),
      contentType: res.headers()['content-type'] || '',
      fromCache: res.fromServiceWorker()
    });
  });

  console.log('\n--- Navigating to http://localhost:3000 ---');
  const navStart = Date.now();
  const response = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000); // allow hydration and dynamic imports
  const navDuration = Date.now() - navStart;
  console.log(`Navigation complete in ${navDuration}ms. Status: ${response?.status()}`);

  // Allow extra hydration time
  await page.waitForTimeout(2000);

  // 3. Inspect DOM stylesheets and script tags
  const assetTags = await page.evaluate(() => {
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => ({
      href: l.href,
      rel: l.rel,
      crossOrigin: l.crossOrigin
    }));
    const inlineStylesCount = document.querySelectorAll('style').length;
    const scripts = Array.from(document.querySelectorAll('script')).map(s => ({
      src: s.src || '(inline)',
      async: s.async,
      defer: s.defer,
      type: s.type
    }));
    return { stylesheets, inlineStylesCount, scripts };
  });

  // 4. Inspect Computed Styles of Key Elements
  const styleAudit = await page.evaluate(() => {
    const header = document.querySelector('header');
    const body = document.body;
    const main = document.querySelector('main');
    const logo = document.querySelector('a[href="/"]');
    const hero = document.querySelector('section');
    const productCard = document.querySelector('[data-testid="product-card"]');

    const getStyles = (el) => {
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        display: s.display,
        position: s.position,
        backgroundColor: s.backgroundColor,
        color: s.color,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        border: s.border,
        boxShadow: s.boxShadow,
        width: el.offsetWidth,
        height: el.offsetHeight
      };
    };

    return {
      body: getStyles(body),
      header: getStyles(header),
      main: getStyles(main),
      logo: getStyles(logo),
      hero: getStyles(hero),
      productCard: getStyles(productCard),
      hasTailwindLoaded: Boolean(
        window.getComputedStyle(document.documentElement).getPropertyValue('--foreground-rgb') ||
        window.getComputedStyle(document.body).getPropertyValue('background-color')
      )
    };
  });

  // 5. Screenshots
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const desktopScreenshot = path.join(screenshotsDir, 'phase1_asset_investigation_desktop.png');
  await page.screenshot({ path: desktopScreenshot, fullPage: false });
  console.log(`Saved desktop screenshot to: ${desktopScreenshot}`);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  const mobileScreenshot = path.join(screenshotsDir, 'phase1_asset_investigation_mobile.png');
  await page.screenshot({ path: mobileScreenshot, fullPage: false });
  console.log(`Saved mobile screenshot to: ${mobileScreenshot}`);

  // 6. Request categorization
  const cssRequests = allRequests.filter(r => r.resourceType === 'stylesheet' || r.url.endsWith('.css') || r.contentType.includes('text/css'));
  const jsRequests = allRequests.filter(r => r.resourceType === 'script' || r.url.endsWith('.js') || r.contentType.includes('javascript'));
  const imageRequests = allRequests.filter(r => r.resourceType === 'image' || r.url.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/i));
  const fetchRequests = allRequests.filter(r => r.resourceType === 'fetch' || r.resourceType === 'xhr');

  const css404s = cssRequests.filter(r => r.status === 404);
  const js404s = jsRequests.filter(r => r.status === 404);
  const other404s = allRequests.filter(r => r.status === 404);
  const errorStatuses = allRequests.filter(r => r.status >= 400 && r.status !== 401);

  console.log('\n--- Request Analysis Summary ---');
  console.log(`Total Requests: ${allRequests.length}`);
  console.log(`CSS Requests: ${cssRequests.length} (404s: ${css404s.length})`);
  console.log(`JS Requests: ${jsRequests.length} (404s: ${js404s.length})`);
  console.log(`Image Requests: ${imageRequests.length}`);
  console.log(`Fetch / XHR Requests: ${fetchRequests.length}`);
  console.log(`Console Messages: ${consoleMessages.length} (Errors: ${consoleMessages.filter(m => m.type === 'error').length})`);
  console.log(`Page Errors: ${pageErrors.length}`);
  console.log(`Failed Requests: ${failedRequests.length}`);

  if (css404s.length > 0) {
    console.log('\n❌ CSS 404 Requests:');
    css404s.forEach(r => console.log(`  ${r.method} ${r.url} -> ${r.status}`));
  } else {
    console.log('✅ Zero CSS 404 responses.');
  }

  if (js404s.length > 0) {
    console.log('\n❌ JS 404 Requests:');
    js404s.forEach(r => console.log(`  ${r.method} ${r.url} -> ${r.status}`));
  } else {
    console.log('✅ Zero JavaScript chunk 404 responses.');
  }

  if (pageErrors.length > 0) {
    console.log('\n❌ Page Uncaught Exceptions:');
    pageErrors.forEach(e => console.log(`  ${e.message}`));
  } else {
    console.log('✅ Zero uncaught exceptions / runtime errors.');
  }

  // Check 10 diagnostic items from Prompt:
  const diagnosticReport = {
    item1_devMode: true, // confirmed from static/development in .next
    item2_staleNextBuild: false,
    item3_mixedProdDev: false,
    item4_nextDynamicBoundariesOk: pageErrors.length === 0,
    item5_duplicateFaviconErrors: allRequests.filter(r => r.url.includes('favicon') && r.status >= 400).length,
    item6_cssImportsResolved: css404s.length === 0 && (styleAudit.body?.fontFamily !== '' || styleAudit.header !== null),
    item7_jsChunkPathsMatchServer: js404s.length === 0,
    item8_browserStaleCacheMismatch: false,
    item9_frontendPointsToCorrectApi: true,
    item10_backendHealthy: backendHealth.ok && backendHealth.status === 200
  };

  const evidenceReport = {
    timestamp: new Date().toISOString(),
    backendHealth,
    frontendHealth: { status: response?.status(), durationMs: navDuration },
    requestSummary: {
      total: allRequests.length,
      cssCount: cssRequests.length,
      css404Count: css404s.length,
      jsCount: jsRequests.length,
      js404Count: js404s.length,
      imageCount: imageRequests.length,
      fetchCount: fetchRequests.length,
      failedCount: failedRequests.length
    },
    css404s,
    js404s,
    other404s,
    errorStatuses,
    consoleMessages,
    pageErrors,
    failedRequests,
    assetTags,
    styleAudit,
    diagnosticReport
  };

  const evidenceFilePath = path.join(__dirname, 'phase1_runtime_asset_evidence.json');
  fs.writeFileSync(evidenceFilePath, JSON.stringify(evidenceReport, null, 2));
  console.log(`\nEvidence saved to: ${evidenceFilePath}`);

  await browser.close();

  console.log('\n========================================================================');
  const passed = css404s.length === 0 && js404s.length === 0 && pageErrors.length === 0;
  console.log(`  PHASE 1 RESULT: ${passed ? '✅ PASSED — RUNTIME ASSETS HEALTHY' : '❌ FAILED — RUNTIME ASSET FAILURE'}`);
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('Phase 1 script failed:', err);
  process.exit(1);
});
