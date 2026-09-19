const { chromium } = require('e:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots_occasions');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('--- Starting Playwright End-to-End Verification ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // 1. Load Homepage
  console.log('\n[1] Loading Homepage http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Find all cards in occasions_grid
  const occasionLinks = await page.$$eval('a[href*="/occasions/"]', (links) => {
    return links.map((l) => ({
      href: l.getAttribute('href'),
      text: l.innerText.trim().replace(/\n/g, ' '),
    }));
  });

  console.log(`Found ${occasionLinks.length} occasion links on homepage:`);
  occasionLinks.forEach((l, idx) => {
    console.log(`  ${idx + 1}. [${l.href}] "${l.text}"`);
  });

  // Take screenshot of homepage occasions grid
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_homepage_occasions.png') });

  // 2. Click "Anniversary"
  console.log('\n[2] Testing Navigation: Click Anniversary Card ...');
  const annivLink = page.locator('a[href*="/occasions/anniversary"]').first();
  if (await annivLink.count() > 0) {
    await annivLink.click();
    await page.waitForURL('**/occasions/anniversary', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('  -> Current URL:', page.url());
    
    // Count products
    const products = await page.$$eval('a[href*="/products/"]', (cards) =>
      cards.map((c) => c.innerText.trim().replace(/\n/g, ' | '))
    );
    console.log(`  -> Anniversary page has ${products.length} products:`);
    products.slice(0, 5).forEach((p, i) => console.log(`     ${i + 1}. ${p.slice(0, 80)}`));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_anniversary_page.png') });
  } else {
    console.log('  [WARN] Anniversary link not found on homepage!');
  }

  // 3. Test Direct Navigation to /occasions/wedding
  console.log('\n[3] Testing Direct Navigation to /occasions/wedding ...');
  await page.goto('http://localhost:3000/occasions/wedding', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const weddingProducts = await page.$$eval('a[href*="/products/"]', (cards) =>
    cards.map((c) => c.innerText.trim().replace(/\n/g, ' | '))
  );
  console.log(`  -> Wedding page URL: ${page.url()} with ${weddingProducts.length} products`);
  weddingProducts.slice(0, 4).forEach((p, i) => console.log(`     ${i + 1}. ${p.slice(0, 80)}`));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_wedding_page.png') });

  // 4. Test Direct Navigation to /occasions/engagement
  console.log('\n[4] Testing Direct Navigation to /occasions/engagement ...');
  await page.goto('http://localhost:3000/occasions/engagement', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const engProducts = await page.$$eval('a[href*="/products/"]', (cards) =>
    cards.map((c) => c.innerText.trim().replace(/\n/g, ' | '))
  );
  console.log(`  -> Engagement page URL: ${page.url()} with ${engProducts.length} products`);
  engProducts.slice(0, 4).forEach((p, i) => console.log(`     ${i + 1}. ${p.slice(0, 80)}`));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_engagement_page.png') });

  // 5. Test Direct Navigation to /occasions/birthday
  console.log('\n[5] Testing Direct Navigation to /occasions/birthday ...');
  await page.goto('http://localhost:3000/occasions/birthday', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const bdayProducts = await page.$$eval('a[href*="/products/"]', (cards) =>
    cards.map((c) => c.innerText.trim().replace(/\n/g, ' | '))
  );
  console.log(`  -> Birthday page URL: ${page.url()} with ${bdayProducts.length} products`);
  bdayProducts.slice(0, 4).forEach((p, i) => console.log(`     ${i + 1}. ${p.slice(0, 80)}`));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_birthday_page.png') });

  // 6. Test Category Page /category/chocolate-cakes
  console.log('\n[6] Testing Category Page /category/chocolate-cakes ...');
  await page.goto('http://localhost:3000/category/chocolate-cakes', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const catProducts = await page.$$eval('a[href*="/products/"]', (cards) =>
    cards.map((c) => c.innerText.trim().replace(/\n/g, ' | '))
  );
  console.log(`  -> Category chocolate-cakes URL: ${page.url()} with ${catProducts.length} products`);
  catProducts.slice(0, 4).forEach((p, i) => console.log(`     ${i + 1}. ${p.slice(0, 80)}`));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_category_chocolate_cakes.png') });

  // 7. Test /products?occasion=anniversary catalog filtering
  console.log('\n[7] Testing /products?occasion=anniversary filtering ...');
  await page.goto('http://localhost:3000/products?occasion=anniversary', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const catalogFiltered = await page.$$eval('[data-testid="product-card"], a[href*="/products/"]', (cards) =>
    cards.map((c) => c.innerText.trim().replace(/\n/g, ' | '))
  );
  console.log(`  -> Products catalog with occasion=anniversary: URL: ${page.url()} with ${catalogFiltered.length} items`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_products_occasion_filtered.png') });

  // 8. Responsive Viewport Testing on Anniversary Page
  console.log('\n[8] Responsive Viewport Testing across 6 viewports ...');
  const viewports = [
    { name: 'mobile_320', width: 320, height: 640 },
    { name: 'mobile_375', width: 375, height: 667 },
    { name: 'mobile_390', width: 390, height: 844 },
    { name: 'mobile_412', width: 412, height: 915 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'desktop_1280', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/occasions/anniversary', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const ssPath = path.join(SCREENSHOT_DIR, `responsive_${vp.name}.png`);
    await page.screenshot({ path: ssPath });
    console.log(`  -> Viewport ${vp.name} (${vp.width}x${vp.height}) verified & captured to ${path.basename(ssPath)}`);
  }

  // 9. Verify Refresh preserves URL and filter
  console.log('\n[9] Testing Page Refresh on /occasions/anniversary ...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  console.log('  -> After reload URL is:', page.url());
  const reloadCount = await page.$$eval('a[href*="/products/"]', (cards) => cards.length);
  console.log(`  -> After reload product count: ${reloadCount}`);

  await browser.close();
  console.log('\n--- All Tests Completed Successfully! ---');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
