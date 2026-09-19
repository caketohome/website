const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const PORT = 3001; // active primary dev server port
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/phase1_2');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ROUTES_TO_VERIFY = [
  { name: 'Homepage', route: '/' },
  { name: 'Products Catalog', route: '/products' },
  { name: 'Product Detail (PDP)', route: '/products/chocolate-truffle' },
  { name: 'Compare', route: '/compare' },
  { name: 'Cart', route: '/cart' },
  { name: 'Checkout Form', route: '/checkout' },
  { name: 'Login Page', route: '/login' },
  { name: 'Account Dashboard', route: '/account' },
  { name: 'Admin Dashboard Entry', route: '/dashboard' },
  { name: 'CMS Page Builder', route: '/dashboard?tab=cms' }
];

async function runVerification() {
  console.log('========================================================================');
  console.log(`  CakeToHome — Phase 1 & 2: Full Browser & Brand Verification (${BASE_URL}) `);
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let totalFailures = 0;

  for (const item of ROUTES_TO_VERIFY) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`  Testing: ${item.name} (${item.route})`);
    console.log(`------------------------------------------------------------------------`);

    // Create desktop context
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    if (item.route.startsWith('/dashboard') || item.route.startsWith('/account')) {
      const cookies = [
        { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
        { name: '_cth_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' },
        { name: '_medusa_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' }
      ];
      await desktopContext.addCookies(cookies);
    }

    const page = await desktopContext.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const networkRequests = [];
    const asset404s = [];
    const apiErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
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

      networkRequests.push({ url: reqUrl, resourceType, status });

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
    let title = '';
    let desktopScreenshot = '';
    let mobileScreenshot = '';
    let colorAudit = null;
    let domMetrics = null;

    try {
      const url = `${BASE_URL}${item.route}`;
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      navStatus = resp?.status() || 0;
      await page.waitForTimeout(3000); // hydration wait

      title = await page.title();

      // Capture desktop screenshot
      const baseFilename = item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      desktopScreenshot = `scratch/screenshots/phase1_2/${baseFilename}_desktop.png`;
      await page.screenshot({ path: path.join(__dirname, `screenshots/phase1_2/${baseFilename}_desktop.png`), fullPage: false });

      // Check DOM metrics and brand colors in DOM
      domMetrics = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const allElements = Array.from(document.querySelectorAll('*'));
        let roguePinkFound = 0;
        const rogueElements = [];

        // Sample check for pink/rose colors like #FF4D6D or rgb(255, 77, 109)
        for (const el of allElements.slice(0, 500)) {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          const col = style.color;
          if (bg.includes('255, 77, 109') || col.includes('255, 77, 109') || bg.includes('244, 63, 94') || col.includes('244, 63, 94')) {
            roguePinkFound++;
            rogueElements.push({ tag: el.tagName, className: el.className, color: col, bg });
          }
        }

        return {
          bodyBg: bodyStyle.backgroundColor,
          bodyColor: bodyStyle.color,
          bodyFont: bodyStyle.fontFamily,
          linkCount: document.querySelectorAll('a').length,
          buttonCount: document.querySelectorAll('button').length,
          inputCount: document.querySelectorAll('input').length,
          cardCount: document.querySelectorAll('[data-product-card], .product-card, article').length,
          bodyHeight: document.body.offsetHeight,
          bodyScrollWidth: document.body.scrollWidth,
          roguePinkFound,
          sampleRogue: rogueElements.slice(0, 3)
        };
      });

      // Mobile check at 375px
      const mobilePage = await desktopContext.newPage();
      await mobilePage.setViewportSize({ width: 375, height: 812 });
      await mobilePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await mobilePage.waitForTimeout(2000);
      mobileScreenshot = `scratch/screenshots/phase1_2/${baseFilename}_mobile.png`;
      await mobilePage.screenshot({ path: path.join(__dirname, `screenshots/phase1_2/${baseFilename}_mobile.png`), fullPage: false });

      const mobileOverflow = await mobilePage.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });

      await mobilePage.close();

      const hydrationErrors = consoleErrors.filter(e =>
        e.toLowerCase().includes('hydration') || e.toLowerCase().includes('did not match')
      );

      const pass = navStatus === 200 && asset404s.length === 0 && pageErrors.length === 0 && hydrationErrors.length === 0;
      if (!pass) totalFailures++;

      console.log(`  HTTP: ${navStatus} | Title: "${title}"`);
      console.log(`  Total Requests: ${networkRequests.length} | Asset 404s: ${asset404s.length}`);
      console.log(`  API Errors (>=500): ${apiErrors.length} | Page Errors: ${pageErrors.length}`);
      console.log(`  Hydration Errors: ${hydrationErrors.length}`);
      console.log(`  Mobile Overflow (375px): ${mobileOverflow.hasOverflow ? 'DETECTED (' + mobileOverflow.scrollWidth + 'px)' : 'NONE (0px)'}`);
      console.log(`  Rogue Pink Elements: ${domMetrics.roguePinkFound}`);
      console.log(`  Desktop Screenshot: ${desktopScreenshot}`);
      console.log(`  Mobile Screenshot: ${mobileScreenshot}`);
      console.log(`  Verdict: ${pass ? 'PASS' : 'FAIL'}`);

      results.push({
        route: item.route,
        name: item.name,
        navStatus,
        pass,
        title,
        desktopScreenshot,
        mobileScreenshot,
        mobileOverflow,
        domMetrics,
        counts: {
          totalRequests: networkRequests.length,
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
      console.error(`  Error verifying ${item.route}:`, err.message);
      results.push({
        route: item.route,
        name: item.name,
        navStatus: 0,
        pass: false,
        error: err.message
      });
    } finally {
      await page.close();
      await desktopContext.close();
    }
  }

  await browser.close();

  console.log('\n========================================================================');
  console.log(`  Summary: ${results.length - totalFailures} / ${results.length} Routes PASSED (100% Target)`);
  console.log('========================================================================\n');

  const evidence = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRoutesTested: results.length,
    passedCount: results.length - totalFailures,
    failedCount: totalFailures,
    overallResult: totalFailures === 0 ? 'PASS — FRONTEND RUNTIME & STOREFRONT ROUTES VERIFIED' : 'PARTIAL / FAIL',
    routes: results
  };

  fs.writeFileSync(path.join(__dirname, 'phase1_2_evidence.json'), JSON.stringify(evidence, null, 2));
  console.log('Saved evidence to scratch/phase1_2_evidence.json');
}

runVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
