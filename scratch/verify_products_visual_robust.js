const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/visual_recovery');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'Desktop_1440px', width: 1440, height: 900, isMobile: false },
  { name: 'Laptop_1024px', width: 1024, height: 768, isMobile: false },
  { name: 'Tablet_768px', width: 768, height: 1024, isMobile: false },
  { name: 'Mobile_375px', width: 375, height: 667, isMobile: true },
];

async function verifyProductsRoute() {
  console.log('========================================================================');
  console.log('  CakeToHome — Visual & Style Verification: /products                   ');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let allPassed = true;

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`Testing /products @ ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------------------`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    const consoleErrors = [];
    const asset404s = [];
    const cssRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('dynamic font')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    page.on('response', res => {
      const url = res.url();
      const status = res.status();
      const ct = res.headers()['content-type'] || '';

      if (url.includes('.css') || ct.includes('text/css')) {
        cssRequests.push({ url, status, contentType: ct });
      }

      if (status === 404) {
        asset404s.push(url);
      }
    });

    const start = Date.now();
    const navRes = await page.goto(`${BASE_URL}/products`, { waitUntil: 'load', timeout: 35000 });
    const loadTime = Date.now() - start;
    const httpStatus = navRes ? navRes.status() : 0;

    // Wait for hydration
    await page.waitForTimeout(1500);

    // Take screenshot
    const screenshotFile = path.join(SCREENSHOT_DIR, `products_${vp.name}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: false });

    // Inspect computed styles and elements
    const inspection = await page.evaluate((isMobile) => {
      const body = document.body;
      const bodyComputed = window.getComputedStyle(body);
      const isTimesNewRoman = bodyComputed.fontFamily.toLowerCase().includes('times');

      // Check header
      const headers = document.querySelectorAll('header');
      const desktopNav = document.querySelector('header nav.hidden.md\\:flex, header nav.md\\:flex');
      const mobileNav = document.querySelector('header .md\\:hidden');

      const desktopNavVisible = desktopNav ? window.getComputedStyle(desktopNav).display !== 'none' : false;
      const mobileNavVisible = mobileNav ? window.getComputedStyle(mobileNav).display !== 'none' : false;

      // Product cards & images
      const productCards = document.querySelectorAll('[data-testid="product-card"]');
      const productImages = document.querySelectorAll('[data-testid="product-card"] img, .product-card img, article img');
      const loadedImages = Array.from(productImages).filter(img => img.naturalWidth > 0);

      // Search and Filter controls
      const searchInput = document.querySelector('input[type="search"]');
      const searchComputed = searchInput ? window.getComputedStyle(searchInput) : null;

      // Check horizontal overflow
      const docScroll = document.documentElement.scrollWidth;
      const docClient = document.documentElement.clientWidth;
      const bodyScroll = document.body.scrollWidth;
      const bodyClient = document.body.clientWidth;
      const hasOverflow = (docScroll > docClient + 1) || (bodyScroll > bodyClient + 1);

      return {
        fontFamily: bodyComputed.fontFamily,
        backgroundColor: bodyComputed.backgroundColor,
        isTimesNewRoman,
        headersCount: headers.length,
        desktopNavVisible,
        mobileNavVisible,
        productCardsCount: productCards.length,
        totalImagesCount: productImages.length,
        loadedImagesCount: loadedImages.length,
        hasSearchInput: Boolean(searchInput),
        searchBorderRadius: searchComputed ? searchComputed.borderRadius : null,
        hasOverflow,
        // Header duplicate check:
        // On desktop/laptop (>=768px): desktop should be visible, mobile should be hidden
        // On mobile (<768px): mobile should be visible, desktop should be hidden
        headerCorrect: isMobile
          ? (mobileNavVisible && !desktopNavVisible)
          : (desktopNavVisible && !mobileNavVisible),
      };
    }, vp.isMobile);

    const cssLoaded = cssRequests.some(r => r.status === 200 && r.contentType.includes('text/css'));
    const cssFailed = cssRequests.some(r => r.status >= 400);

    const vpPassed =
      httpStatus === 200 &&
      cssLoaded &&
      !cssFailed &&
      !inspection.isTimesNewRoman &&
      inspection.headerCorrect &&
      inspection.productCardsCount > 0 &&
      !inspection.hasOverflow &&
      consoleErrors.length === 0 &&
      asset404s.length === 0;

    if (!vpPassed) allPassed = false;

    console.log(`  HTTP Status:       ${httpStatus} (Expected: 200)`);
    console.log(`  CSS Loaded:        ${cssLoaded ? 'YES ✓' : 'NO ✗ (FAIL)'} (Status: ${cssRequests.map(r => r.status).join(', ') || 'None'})`);
    console.log(`  Font Family:       ${inspection.fontFamily} (Default Times New Roman: ${inspection.isTimesNewRoman ? 'FAIL' : 'NO ✓'})`);
    console.log(`  Header Behavior:   Desktop Nav: ${inspection.desktopNavVisible ? 'Visible' : 'Hidden'}, Mobile Nav: ${inspection.mobileNavVisible ? 'Visible' : 'Hidden'} | Correct: ${inspection.headerCorrect ? 'YES ✓' : 'NO ✗ (DUPLICATE)'}`);
    console.log(`  Product Cards:     ${inspection.productCardsCount} rendered (Expected > 0)`);
    console.log(`  Product Images:    ${inspection.loadedImagesCount}/${inspection.totalImagesCount} loaded`);
    console.log(`  Horizontal Overflow: ${inspection.hasOverflow ? 'DETECTED ✗' : 'NONE ✓'}`);
    console.log(`  Console Errors:    ${consoleErrors.length === 0 ? '0 ✓' : consoleErrors.join(' | ')}`);
    console.log(`  Asset 404s:        ${asset404s.length === 0 ? '0 ✓' : asset404s.join(' | ')}`);
    console.log(`  Verdict:           ${vpPassed ? '✅ PASS' : '❌ FAIL'}`);

    results.push({
      viewport: vp.name,
      passed: vpPassed,
      httpStatus,
      cssLoaded,
      font: inspection.fontFamily,
      productCards: inspection.productCardsCount,
      headerCorrect: inspection.headerCorrect,
      overflow: inspection.hasOverflow,
      errors: consoleErrors.length,
      screenshot: screenshotFile,
    });

    await context.close();
  }

  await browser.close();

  console.log(`\n========================================================================`);
  console.log(`  VERIFICATION FINISHED: ${allPassed ? '✅ ALL 4 VIEWPORTS PASSED' : '❌ FAILURES DETECTED'}`);
  console.log(`========================================================================`);

  return { allPassed, results };
}

verifyProductsRoute().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
