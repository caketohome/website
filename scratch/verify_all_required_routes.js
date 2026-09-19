const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const ROUTES = [
  { name: 'Storefront Homepage', route: '/', requiresAuth: false },
  { name: 'Products Catalog', route: '/products', requiresAuth: false },
  { name: 'Product Detail (Chocolate Truffle)', route: '/products/chocolate-truffle', requiresAuth: false },
  { name: 'Categories Store', route: '/categories', requiresAuth: false },
  { name: 'Checkout Page', route: '/checkout', requiresAuth: false },
  { name: 'Admin Dashboard', route: '/dashboard', requiresAuth: true },
];

async function verifyAllRoutes() {
  console.log('========================================================================');
  console.log('  CakeToHome — Verification of All Core Routes                          ');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
  ]);

  let allPassed = true;

  for (const r of ROUTES) {
    const page = await context.newPage();
    const cssRequests = [];
    const errors = [];
    const asset404s = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('dynamic font')) {
          errors.push(text);
        }
      }
    });

    page.on('pageerror', err => errors.push(err.message));

    page.on('response', res => {
      const url = res.url();
      const ct = res.headers()['content-type'] || '';
      if (url.includes('.css') || ct.includes('text/css')) {
        cssRequests.push({ url, status: res.status() });
      }
      if (res.status() === 404) {
        asset404s.push(url);
      }
    });

    try {
      const res = await page.goto(`${BASE_URL}${r.route}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(1000);

      const status = res ? res.status() : 0;
      const css200 = cssRequests.some(c => c.status === 200);
      const css404 = cssRequests.some(c => c.status === 404);

      const isStyled = await page.evaluate(() => {
        const bodyFont = window.getComputedStyle(document.body).fontFamily.toLowerCase();
        return !bodyFont.includes('times');
      });

      const passed = status === 200 && css200 && !css404 && isStyled && errors.length === 0 && asset404s.length === 0;
      if (!passed) allPassed = false;

      console.log(`Route [${r.route.padEnd(30)}] | HTTP ${status} | CSS Loaded: ${css200} | Styled: ${isStyled} | Errors: ${errors.length} | 404s: ${asset404s.length} | ${passed ? '✅ PASS' : '❌ FAIL'}`);
    } catch (err) {
      allPassed = false;
      console.log(`Route [${r.route.padEnd(30)}] | ERROR: ${err.message} | ❌ FAIL`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\n========================================================================`);
  console.log(`  ALL ROUTES VERDICT: ${allPassed ? '✅ 100% ALL 6 ROUTES PASSED' : '❌ SOME ROUTES FAILED'}`);
  console.log(`========================================================================`);
}

verifyAllRoutes().catch(console.error);
