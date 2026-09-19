const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));
const fs = require('fs');

async function runBrowserVerification() {
  console.log('====================================================');
  console.log(' CakeToHome E2E Browser & Cart Drawer Verification');
  console.log('====================================================\n');
  
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // ── 1. Desktop Viewport (1280x800) ──
  console.log('[1/3] Testing Desktop Viewport (1280x800)...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await desktopContext.newPage();

  // Navigate to Chocolate Fudge Cupcake PDP
  console.log('  Navigating to /products/chocolate-fudge-cupcake...');
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(screenshotsDir, '1_pdp_initial_desktop.png'), fullPage: false });
  console.log('  Captured: 1_pdp_initial_desktop.png');

  // Locate and click "Add to Bag" button
  const addToBagBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  await addToBagBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('  Clicking "Add to Bag"...');
  await addToBagBtn.click({ force: true });

  // Wait for confirmation modal or drawer
  const confirmBtn = page.locator('#btn-confirm-add-to-cart');
  const cartDrawer = page.locator('[data-testid="cart-drawer-panel"]').first();

  try {
    await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  Confirmation modal appeared, clicking continue...');
    await confirmBtn.click({ force: true });
  } catch (_) {
    // modal didn't appear
  }

  // Wait for drawer to appear
  await cartDrawer.waitFor({ state: 'visible', timeout: 40000 });
  console.log('  ✅ Cart drawer opened successfully on desktop!');

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '2_cart_drawer_added_desktop.png'), fullPage: false });
  console.log('  Captured: 2_cart_drawer_added_desktop.png');

  // Verify Header Count
  const headerCount = page.locator('[data-testid="cart-header-count"]').first();
  const countText = await headerCount.textContent();
  console.log('  Cart Header Count in Drawer:', countText?.trim());

  // Verify Item in Drawer
  const itemsContainer = page.locator('[data-testid="cart-items-container"]').first();
  const itemText = await itemsContainer.textContent();
  console.log('  Item Container Content Preview:', itemText?.slice(0, 150));

  if (!itemText || !itemText.includes('Chocolate Fudge Cupcake') || !itemText.includes('499')) {
    throw new Error('Cart drawer does not display Chocolate Fudge Cupcake with price 499!');
  }
  console.log('  ✅ Verified "Chocolate Fudge Cupcake" with price ₹499 in drawer!');

  // Verify Total Payable
  const totalPayable = page.locator('[data-testid="cart-total-payable"]').first();
  const totalText = await totalPayable.textContent();
  console.log('  Total Payable in Drawer:', totalText?.trim());
  if (!totalText || !totalText.includes('499')) {
    throw new Error('Total payable is not 499, got ' + totalText);
  }
  console.log('  ✅ Verified Total Payable is ₹499');

  // Test Quantity Stepper (+)
  console.log('  Testing Quantity Increase (+)...');
  const plusBtn = page.locator('[data-testid="cart-drawer-qty-plus"]').first();
  await plusBtn.click({ force: true });
  await page.waitForTimeout(2500);

  const updatedTotalText = await totalPayable.textContent();
  console.log('  Total Payable after (+):', updatedTotalText?.trim());
  if (!updatedTotalText || !updatedTotalText.includes('998')) {
    throw new Error('Expected 998 after quantity increase, got ' + updatedTotalText);
  }
  console.log('  ✅ Verified Quantity Stepper updated total to ₹998!');

  await page.screenshot({ path: path.join(screenshotsDir, '3_cart_drawer_stepper_desktop.png'), fullPage: false });
  console.log('  Captured: 3_cart_drawer_stepper_desktop.png');

  // Close drawer via close button
  console.log('  Closing drawer via close button...');
  const closeBtn = page.locator('[data-testid="cart-close-button"]').first();
  await closeBtn.click({ force: true });
  await cartDrawer.waitFor({ state: 'hidden', timeout: 5000 });
  console.log('  ✅ Drawer closed cleanly!');

  // Verify header cart badge
  const cartBadge = page.locator('[data-testid="cart-count-badge"]').first();
  const badgeText = await cartBadge.textContent();
  console.log('  Header Cart Badge Count:', badgeText?.trim());
  if (badgeText?.trim() !== '2') {
    throw new Error('Header badge does not reflect 2 items, got ' + badgeText);
  }
  console.log('  ✅ Header Cart Badge is synchronized to 2 items!');

  // Re-open drawer via header button
  console.log('  Re-opening drawer via header cart button...');
  const headerCartBtn = page.locator('[data-testid="header-cart-button"]').first();
  await headerCartBtn.click({ force: true });
  await cartDrawer.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  ✅ Drawer re-opened from header icon!');

  // ── 2. Mobile Viewport (375x812 iPhone / Android) ──
  console.log('\n[2/3] Testing Mobile Viewport (375x812)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mobilePage.waitForTimeout(2000);

  // First: verify empty state on mobile when clicking header cart button
  console.log('  Testing Mobile Empty State...');
  const mobileHeaderBtn = mobilePage.locator('[data-testid="header-cart-button"]').last();
  await mobileHeaderBtn.click({ force: true });
  const mobileCartDrawer = mobilePage.locator('[data-testid="cart-drawer-panel"]').first();
  await mobileCartDrawer.waitFor({ state: 'visible', timeout: 10000 });
  const emptyState = mobilePage.locator('[data-testid="cart-empty-state"]').first();
  await emptyState.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  ✅ Mobile Empty State verified with luxury artisan design!');
  await mobilePage.screenshot({ path: path.join(screenshotsDir, '4_cart_drawer_mobile_empty.png'), fullPage: false });

  // Close drawer
  const mobileCloseBtn = mobilePage.locator('[data-testid="cart-close-button"]').first();
  await mobileCloseBtn.click({ force: true });
  await mobileCartDrawer.waitFor({ state: 'hidden', timeout: 5000 });

  // Add to Bag on Mobile
  console.log('  Testing Mobile Add to Bag...');
  const mobileAddBtn = mobilePage.locator('[data-testid="pdp-add-to-bag"]').first();
  await mobileAddBtn.click({ force: true });
  const mobileConfirm = mobilePage.locator('#btn-confirm-add-to-cart');
  try {
    await mobileConfirm.waitFor({ state: 'visible', timeout: 3000 });
    await mobileConfirm.click({ force: true });
  } catch (_) {}

  await mobileCartDrawer.waitFor({ state: 'visible', timeout: 15000 });
  console.log('  ✅ Mobile Cart Drawer opened after Add to Bag!');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(screenshotsDir, '4_cart_drawer_mobile_added.png'), fullPage: false });

  // Verify checkout button reachable on mobile
  const checkoutBtn = mobilePage.locator('[data-testid="cart-checkout-button"]').first();
  await checkoutBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  ✅ Mobile checkout button is visible and reachable in viewport!');

  // ── 3. Tablet Viewport (768x1024) ──
  console.log('\n[3/3] Testing Tablet Viewport (768x1024)...');
  const desktopState = await desktopContext.storageState();
  const tabletContext = await browser.newContext({
    storageState: desktopState,
    viewport: { width: 768, height: 1024 }
  });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await tabletPage.waitForTimeout(2000);

  const tabletHeaderBtn = tabletPage.locator('[data-testid="header-cart-button"]').first();
  await tabletHeaderBtn.click({ force: true });
  const tabletCartDrawer = tabletPage.locator('[data-testid="cart-drawer-panel"]').first();
  await tabletCartDrawer.waitFor({ state: 'visible', timeout: 10000 });
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: path.join(screenshotsDir, '5_cart_drawer_tablet.png'), fullPage: false });
  console.log('  Captured: 5_cart_drawer_tablet.png');
  const tabletCheckoutBtn = tabletPage.locator('[data-testid="cart-checkout-button"]').first();
  await tabletCheckoutBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  ✅ Tablet cart drawer and checkout button verified!');

  await browser.close();
  console.log('\n====================================================');
  console.log(' 🎉 PLAYWRIGHT E2E BROWSER VALIDATION PASSED 100%!');
  console.log('====================================================\n');
}

runBrowserVerification().catch((err) => {
  console.error('\n❌ Playwright Error:', err);
  process.exit(1);
});
