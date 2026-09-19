const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/phase1');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ROUTES_TO_TEST = [
  { name: 'Homepage', route: '/' },
  { name: 'Products Catalog', route: '/products' },
  { name: 'Product Detail (PDP)', route: '/products/chocolate-truffle' },
  { name: 'Compare', route: '/compare' },
  { name: 'Cart', route: '/cart' },
  { name: 'Checkout Form', route: '/checkout' },
  { name: 'CMS Page Builder', route: '/dashboard?tab=cms' }
];

async function runVerification() {
  console.log('================================================================');
  console.log(`  CakeToHome — Phase 1: Real Browser Verification (${BASE_URL}) `);
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const results = [];
  let totalFailures = 0;

  for (const item of ROUTES_TO_TEST) {
    // Configure session per route: admin routes get admin cookies, storefront routes are clean guest
    if (item.route.startsWith('/dashboard')) {
      await context.addCookies([
        { name: '_cth_role', value: 'SUPER_ADMIN', domain: '127.0.0.1', path: '/' },
        { name: '_cth_user_id', value: 'admin_01', domain: '127.0.0.1', path: '/' },
        { name: '_cth_jwt', value: 'admin_session_token', domain: '127.0.0.1', path: '/' },
        { name: '_medusa_jwt', value: 'admin_session_token', domain: '127.0.0.1', path: '/' },
        { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
        { name: '_cth_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' },
        { name: '_medusa_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' }
      ]);
    } else {
      await context.clearCookies();
    }

    const page = await context.newPage();
    const url = `${BASE_URL}${item.route}`;
    console.log(`\n--- Testing ${item.name} (${url}) ---`);

    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];
    const networkRequests = [];
    const asset404s = [];
    const apiErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    page.on('response', res => {
      const req = res.request();
      const reqUrl = res.url();
      const status = res.status();
      const resourceType = req.resourceType();

      networkRequests.push({
        url: reqUrl,
        resourceType,
        status,
        statusText: res.statusText()
      });

      if (status === 404) {
        const isAsset = ['image', 'stylesheet', 'font', 'media', 'script'].includes(resourceType) || 
                        Boolean(reqUrl.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|css|js|woff2|woff|ttf)(\?.*)?$/i));
        if (isAsset) {
          asset404s.push({ url: reqUrl, resourceType });
        }
      }

      if (reqUrl.includes('/api/') && status >= 500) {
        apiErrors.push({ url: reqUrl, status });
      }
    });

    let navStatus = 0;
    let isRendered = false;
    let title = '';
    let hasStyles = false;
    let cssCount = 0;
    let jsCount = 0;

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      navStatus = resp?.status() || 0;
      await page.waitForTimeout(3000); // allow hydration

      title = await page.title();

      // Check styles and interactivity
      const domAudit = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const links = document.querySelectorAll('a').length;
        const buttons = document.querySelectorAll('button').length;
        const inputs = document.querySelectorAll('input').length;
        const main = document.querySelector('main');
        const header = document.querySelector('header');
        return {
          bg: bodyStyle.backgroundColor,
          color: bodyStyle.color,
          font: bodyStyle.fontFamily,
          links,
          buttons,
          inputs,
          hasMain: !!main,
          hasHeader: !!header,
          bodyHeight: document.body.offsetHeight
        };
      });

      // Save screenshot for evidence
      const screenshotFilename = `${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      cssCount = networkRequests.filter(r => r.resourceType === 'stylesheet' || r.url.endsWith('.css')).length;
      jsCount = networkRequests.filter(r => r.resourceType === 'script' || r.url.endsWith('.js')).length;
      hasStyles = domAudit.bodyHeight > 0 && (domAudit.hasHeader || domAudit.hasMain);
      isRendered = navStatus === 200 && pageErrors.length === 0;

      // Check for hydration error strings in console
      const hydrationErrors = consoleErrors.filter(e => 
        e.toLowerCase().includes('hydration') || e.toLowerCase().includes('did not match')
      );

      const pass = navStatus === 200 && asset404s.length === 0 && pageErrors.length === 0 && hydrationErrors.length === 0;
      if (!pass) totalFailures++;

      console.log(`  Status: HTTP ${navStatus} | Title: "${title}"`);
      console.log(`  Requests: ${networkRequests.length} total (${cssCount} CSS, ${jsCount} JS)`);
      console.log(`  Asset 404s: ${asset404s.length}`);
      console.log(`  API Errors (>=500): ${apiErrors.length}`);
      console.log(`  Page Errors: ${pageErrors.length}`);
      console.log(`  Hydration Errors: ${hydrationErrors.length}`);
      console.log(`  Screenshot: scratch/screenshots/phase1/${screenshotFilename}`);
      console.log(`  Result: ${pass ? 'PASS' : 'FAIL'}`);

      results.push({
        route: item.route,
        name: item.name,
        url,
        navStatus,
        pass,
        title,
        screenshot: `scratch/screenshots/phase1/${screenshotFilename}`,
        domAudit,
        counts: {
          totalRequests: networkRequests.length,
          cssCount,
          jsCount,
          asset404Count: asset404s.length,
          apiErrorCount: apiErrors.length,
          pageErrorCount: pageErrors.length,
          consoleErrorCount: consoleErrors.length,
          hydrationErrorCount: hydrationErrors.length
        },
        asset404s,
        apiErrors,
        pageErrors,
        consoleErrors: consoleErrors.slice(0, 5)
      });
    } catch (err) {
      totalFailures++;
      console.error(`  Failed to load ${url}:`, err.message);
      results.push({
        route: item.route,
        name: item.name,
        url,
        navStatus: 0,
        pass: false,
        error: err.message
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n================================================================');
  console.log(`  Verification Completed: ${results.length - totalFailures}/${results.length} Routes Passed`);
  console.log('================================================================\n');

  const evidence = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRoutesTested: results.length,
    passedCount: results.length - totalFailures,
    failedCount: totalFailures,
    overallResult: totalFailures === 0 ? 'PASS — FRONTEND VERIFIED' : 'FAIL',
    routes: results
  };

  fs.writeFileSync('scratch/phase1_browser_verification_evidence.json', JSON.stringify(evidence, null, 2));
  console.log('Saved evidence to scratch/phase1_browser_verification_evidence.json');
}

runVerification().catch(err => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
