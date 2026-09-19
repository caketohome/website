const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/comprehensive_audit');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const REQUIRED_ROUTES = [
  { name: 'Storefront Homepage', route: '/', requiresAuth: false },
  { name: 'Product Listing', route: '/products', requiresAuth: false },
  { name: 'Product Detail (PDP)', route: '/products/chocolate-truffle', requiresAuth: false },
  { name: 'Categories (Store)', route: '/categories', requiresAuth: false },
  { name: 'Checkout Page', route: '/checkout', requiresAuth: false },
  { name: 'Admin Shell (Dashboard root)', route: '/dashboard', requiresAuth: true },
  { name: 'Admin: Orders', route: '/dashboard?tab=orders', requiresAuth: true },
  { name: 'Admin: Catalog', route: '/dashboard?tab=catalog', requiresAuth: true },
  { name: 'Admin: Branches', route: '/dashboard?tab=branches', requiresAuth: true },
  { name: 'Admin: Delivery', route: '/dashboard?tab=delivery', requiresAuth: true },
  { name: 'Admin: Operations', route: '/dashboard?tab=fulfillment', requiresAuth: true },
  { name: 'Admin: Tax Master', route: '/dashboard?tab=tax_master', requiresAuth: true },
  { name: 'Admin: SEO & Digital', route: '/dashboard?tab=seo', requiresAuth: true },
  { name: 'Admin: Content (CMS)', route: '/dashboard?tab=cms', requiresAuth: true },
  { name: 'Admin: Media Library', route: '/dashboard?tab=media', requiresAuth: true },
  { name: 'Local SEO City Landing', route: '/city/bengaluru', requiresAuth: false },
];

const VIEWPORTS = [
  { name: 'Desktop (1440px)', width: 1440, height: 900 },
  { name: 'Laptop (1024px)', width: 1024, height: 768 },
  { name: 'Tablet (768px)', width: 768, height: 1024 },
  { name: 'Mobile (375px)', width: 375, height: 667 },
];

async function runAudit() {
  console.log('========================================================================');
  console.log(`  CakeToHome — Comprehensive Browser Verification Suite                  `);
  console.log(`  Base URL: ${BASE_URL}                                                  `);
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let allPassed = true;

  for (const item of REQUIRED_ROUTES) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`Testing Route: ${item.name} (${item.route})`);
    console.log(`------------------------------------------------------------------------`);

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      if (item.requiresAuth) {
        await context.addCookies([
          { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
          { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
          { name: '_cth_jwt', value: 'admin_session_token', domain: 'localhost', path: '/' },
        ]);
      }

      const page = await context.newPage();
      const consoleErrors = [];
      const asset404s = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter known benign noise like font downloads, favicon, or guest 401 probe
          if (!text.includes('favicon') && !text.includes('dynamic font') && !text.includes('status of 401')) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('response', (res) => {
        if (res.status() === 404 && (res.url().includes('.png') || res.url().includes('.jpg') || res.url().includes('.webp') || res.url().includes('.js'))) {
          asset404s.push(res.url());
        }
      });

      let status = 0;
      let loadTime = 0;
      let overflow = false;
      const start = Date.now();

      try {
        const res = await page.goto(`${BASE_URL}${item.route}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
        status = res ? res.status() : 0;
        await page.waitForTimeout(1000); // Allow client hydration
        loadTime = Date.now() - start;

        // Check horizontal overflow
        overflow = await page.evaluate(() => {
          const docScroll = document.documentElement.scrollWidth;
          const docClient = document.documentElement.clientWidth;
          const bodyScroll = document.body.scrollWidth;
          const bodyClient = document.body.clientWidth;
          return (docScroll > docClient + 1) || (bodyScroll > bodyClient + 1);
        });

        // Screenshot on desktop
        if (vp.width === 1440) {
          const safeName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${safeName}_desktop.png`), fullPage: false });
        }
      } catch (err) {
        status = 500;
        consoleErrors.push(`Navigation error: ${err.message}`);
      }

      const passed = status === 200 && !overflow && consoleErrors.length === 0 && asset404s.length === 0;
      if (!passed) allPassed = false;

      const resObj = {
        route: item.route,
        name: item.name,
        viewport: vp.name,
        status,
        loadTimeMs: loadTime,
        overflow,
        consoleErrorsCount: consoleErrors.length,
        asset404Count: asset404s.length,
        passed,
      };

      results.push(resObj);

      console.log(
        `  [${vp.name.padEnd(16)}] HTTP ${status} | Load: ${loadTime}ms | Overflow: ${overflow ? 'FAIL ❌' : 'PASS ✓'} | Errors: ${consoleErrors.length} | 404s: ${asset404s.length} | ${passed ? '✅ PASS' : '❌ FAIL'}`
      );

      if (consoleErrors.length > 0) {
        console.log(`     Console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);
      }
      if (asset404s.length > 0) {
        console.log(`     Asset 404s: ${asset404s.slice(0, 2).join(' | ')}`);
      }

      await context.close();
    }
  }

  await browser.close();

  fs.writeFileSync(
    path.join(__dirname, 'comprehensive_browser_audit_results.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('\n========================================================================');
  console.log(`  AUDIT FINISHED: ${allPassed ? '✅ 100% ALL CHECKS PASSED' : '⚠️ COMPLETED WITH ISSUES'}`);
  console.log(`  Results saved to: scratch/comprehensive_browser_audit_results.json`);
  console.log('========================================================================\n');
}

runAudit().catch(console.error);
