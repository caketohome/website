const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const VIEWPORTS = [
  { width: 320, height: 600, name: '320px-mobile-compact' },
  { width: 360, height: 740, name: '360px-mobile-standard' },
  { width: 375, height: 667, name: '375px-iphone-se' },
  { width: 390, height: 844, name: '390px-iphone-14-15' },
  { width: 430, height: 932, name: '430px-iphone-pro-max' },
  { width: 768, height: 1024, name: '768px-tablet-portrait' },
  { width: 1024, height: 768, name: '1024px-tablet-landscape' },
  { width: 1280, height: 800, name: '1280px-desktop' },
  { width: 1440, height: 900, name: '1440px-desktop-wide' },
];

async function runVerification() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = {
    viewports: {},
    consoleErrors: [],
    consoleWarnings: [],
    duplicateKeyWarnings: [],
    network4xx5xx: [],
    failedNetworkRequests: [],
    routes: {},
    interactions: {},
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Attach console and network listeners
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      results.consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      results.consoleWarnings.push(text);
      if (text.includes('occ_birthday') || text.includes('same key')) {
        results.duplicateKeyWarnings.push(text);
      }
    }
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400 && !res.url().includes('/api/customer/address')) {
      results.network4xx5xx.push({
        status,
        url: res.url(),
        method: res.request().method(),
      });
    }
  });

  page.on('requestfailed', (req) => {
    results.failedNetworkRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText,
    });
  });

  console.log("==================================================");
  console.log("1. HOMEPAGE VIEWPORT AUDIT & HEADER RESPONSIVENESS (9 VIEWPORTS)");
  console.log("==================================================");

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const metrics = await page.evaluate((isMobile) => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const overflow = scrollW > clientW;

      let logoRect = null;
      let locRect = null;
      let searchRect = null;
      let wishlist = null;
      let cart = null;
      let profile = null;

      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;

      if (isMobile) {
        const logo = document.querySelector('.flex.md\\:hidden a span.text-xl') || document.querySelector('header a');
        logoRect = logo ? logo.getBoundingClientRect() : null;

        const locBtn = document.querySelector('header button[aria-label="Select delivery location"]');
        locRect = locBtn ? locBtn.getBoundingClientRect() : null;

        const searchTrigger = document.querySelector('header button[aria-label*="search" i]');
        searchRect = searchTrigger ? searchTrigger.getBoundingClientRect() : null;

        wishlist = document.querySelector('header a[href*="fav"]');
        cart = document.querySelector('header a[href*="cart"]');
        profile = document.querySelector('header [data-testid="profile-menu-container"]');
      } else {
        const logo = document.querySelector('header a img') || document.querySelector('header a span');
        logoRect = logo ? logo.getBoundingClientRect() : null;

        const locBtn = document.querySelector('header button[aria-label="Select delivery location"]');
        locRect = locBtn ? locBtn.getBoundingClientRect() : null;

        const searchInput = document.querySelector('header input[type="search"]') || document.querySelector('header input[placeholder*="Search"]');
        searchRect = searchInput ? searchInput.getBoundingClientRect() : null;

        wishlist = document.querySelector('header a[href*="fav"]');
        cart = document.querySelector('header a[href*="cart"]');
        profile = document.querySelector('header [data-testid="profile-menu-container"]');
      }

      let overlap = false;
      if (locRect && searchRect && locRect.width > 0 && searchRect.width > 0) {
        overlap = !(
          locRect.right <= searchRect.left ||
          locRect.left >= searchRect.right ||
          locRect.bottom <= searchRect.top ||
          locRect.top >= searchRect.bottom
        );
      }

      return {
        viewportWidth: clientW,
        scrollWidth: scrollW,
        overflow,
        logoVisible: !!logoRect && logoRect.width > 0,
        logoWidth: logoRect ? Math.round(logoRect.width) : 0,
        locationVisible: !!locRect && locRect.width > 0,
        searchVisible: !!searchRect && searchRect.width > 0,
        searchLocationOverlap: overlap,
        wishlistVisible: !!wishlist,
        cartVisible: !!cart,
        profileVisible: !!profile,
        headerHeight: headerRect ? Math.round(headerRect.height) : 0,
      };
    }, vp.width < 768);

    results.viewports[vp.name] = metrics;
    console.log(`[${vp.name}] Overflow: ${metrics.overflow ? 'FAIL' : 'PASS'} | Overlap: ${metrics.searchLocationOverlap ? 'FAIL' : 'PASS'} | Logo: ${metrics.logoWidth}px | HeaderHeight: ${metrics.headerHeight}px`);

    await page.screenshot({ path: path.join(screenshotsDir, `header_${vp.name}.png`) });
  }

  console.log("\n==================================================");
  console.log("2. MOBILE HEADER MODAL INTERACTIONS (375px)");
  console.log("==================================================");
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);

  // Test location modal
  const locBtn = page.locator('header button[aria-label="Select delivery location"]:visible');
  if (await locBtn.count() > 0) {
    await locBtn.first().click();
    await page.waitForTimeout(400);
    const modalVisible = await page.locator('h3:has-text("Select Delivery Location")').isVisible();
    console.log(`Location Modal Opened: ${modalVisible}`);
    results.interactions.locationModalOpen = modalVisible;

    const closeBtn = page.locator('button[aria-label="Close location selector"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
      const modalClosed = !(await page.locator('h3:has-text("Select Delivery Location")').isVisible());
      console.log(`Location Modal Closed: ${modalClosed}`);
      results.interactions.locationModalClose = modalClosed;
    }
  }

  // Test search trigger modal
  const searchTrigger = page.locator('header button[aria-label*="search" i]:visible');
  if (await searchTrigger.count() > 0) {
    await searchTrigger.first().click();
    await page.waitForTimeout(400);
    const searchModalVisible = await page.locator('input[placeholder*="Search" i]:visible').isVisible();
    console.log(`Search Overlay Opened: ${searchModalVisible}`);
    results.interactions.searchModalOpen = searchModalVisible;

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  console.log("\n==================================================");
  console.log("3. PRODUCT CARD CLICKABILITY & WISHLIST ISOLATION");
  console.log("==================================================");
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const productLinks = page.locator('a[href*="/products/"]');
  const count = await productLinks.count();
  console.log(`Found ${count} clickable product links`);

  if (count > 0) {
    const firstLink = productLinks.first();
    const targetHref = await firstLink.getAttribute('href');
    console.log(`Clicking product card targeting: ${targetHref}`);
    await firstLink.click();
    await page.waitForTimeout(2000);
    const landedUrl = page.url();
    const navigated = landedUrl.includes('/products/');
    console.log(`Product Card Navigation: ${navigated ? 'PASS' : 'FAIL'} (Landed on: ${landedUrl})`);
    results.interactions.productCardNavigation = navigated;
  }

  console.log("\n==================================================");
  console.log("4. PUBLIC ROUTES, CHECKOUT & ADMIN PAGES AUDIT");
  console.log("==================================================");
  const testRoutes = [
    { path: '/', name: 'Homepage' },
    { path: '/products', name: 'Product Listing' },
    { path: '/products?category=chocolate-cakes', name: 'Category Destination' },
    { path: '/products/chocolate-truffle', name: 'PDP 1 (Chocolate Truffle)' },
    { path: '/products/pistachio-gateau', name: 'PDP 2 (Pistachio Gateau)' },
    { path: '/products/choco-red', name: 'PDP 3 (Choco Red)' },
    { path: '/compare', name: 'Compare Page' },
    { path: '/search?q=chocolate', name: 'Search Results Page' },
    { path: '/checkout', name: 'Checkout Page' },
    { path: '/dashboard?tab=orders', name: 'Admin Orders' },
    { path: '/dashboard?tab=catalog', name: 'Admin Catalog' },
    { path: '/dashboard?tab=delivery', name: 'Admin Delivery Partners' },
    { path: '/dashboard?tab=branches', name: 'Admin Branches & Operations' },
    { path: '/dashboard?tab=crm', name: 'Admin Customers/CRM' },
    { path: '/dashboard?tab=cms', name: 'Admin CMS Visual Editor' },
  ];

  for (const r of testRoutes) {
    const fullUrl = `http://localhost:3000${r.path}`;
    try {
      const res = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const status = res?.status() || 0;
      await page.waitForTimeout(1000);
      const title = await page.title();
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      const overflow = scrollW > clientW;
      results.routes[r.name] = { url: fullUrl, status, title, overflow };
      console.log(`Route [${r.name}] ${r.path}: status=${status} | Overflow=${overflow ? 'FAIL' : 'PASS'} | title="${title.slice(0, 50)}"`);
    } catch (err) {
      results.routes[r.name] = { url: fullUrl, error: err.message };
      console.error(`Route [${r.name}] ${r.path}: ERROR ${err.message}`);
    }
  }

  console.log("\n==================================================");
  console.log("5. DUPLICATE REACT KEY VERIFICATION");
  console.log("==================================================");
  console.log(`Duplicate key warnings found: ${results.duplicateKeyWarnings.length}`);
  if (results.duplicateKeyWarnings.length > 0) {
    results.duplicateKeyWarnings.forEach(w => console.log(` - ${w}`));
  } else {
    console.log("PASS: Zero duplicate key warnings detected!");
  }

  // Save audit report
  fs.writeFileSync(
    path.join(__dirname, 'e2e_verification_results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );
  console.log("\nAudit results saved to scratch/e2e_verification_results.json");

  await browser.close();
}

runVerification().catch(err => {
  console.error("FATAL in runVerification:", err);
  process.exit(1);
});
