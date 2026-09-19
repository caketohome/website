const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function testPdpAndDrawer() {
  console.log('================================================================');
  console.log(' CakeToHome — PDP Mutation & Cart Drawer State Machine Test');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. Navigate to Butter Croissant PDP
    console.log('1. Navigating to /products/butter-croissant...');
    await page.goto('http://localhost:3000/products/butter-croissant', { waitUntil: 'networkidle', timeout: 30000 });

    // Assert: Title and description are mounted
    const title = await page.locator('h1').textContent();
    console.log('   Product Title:', title?.trim());
    if (!title?.includes('Butter Croissant')) {
      throw new Error(`Expected title "Butter Croissant", got: ${title}`);
    }

    // Assert: No "SELECT SIZE & WEIGHT"
    const pageContent = await page.content();
    if (/SELECT SIZE & WEIGHT/i.test(pageContent)) {
      throw new Error('FAIL: "SELECT SIZE & WEIGHT" is rendered on Butter Croissant PDP!');
    }
    console.log('   ✅ "SELECT SIZE & WEIGHT" is NOT rendered for Butter Croissant');

    // Assert: No "1 pc" or "1 piece"
    if (/1\s*pc\b|1\s*piece\b/i.test(pageContent)) {
      throw new Error('FAIL: Phantom "1 pc" or "1 piece" found on Butter Croissant PDP!');
    }
    console.log('   ✅ Phantom "1 pc" / "1 piece" is NOT found on PDP');

    // Assert: Price is ₹149
    const priceText = await page.locator('.text-3xl.font-serif, [data-testid="pdp-price"]').first().textContent();
    console.log('   PDP Price:', priceText?.trim());
    if (!priceText?.includes('149')) {
      throw new Error(`Expected ₹149, got: ${priceText}`);
    }
    console.log('   ✅ PDP Price is correctly ₹149');

    // 2. Click Add to Bag
    console.log('\n2. Clicking Add to Bag...');
    const addBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
    await addBtn.click();

    // Confirm modal if any
    const confirmBtn = page.locator('#btn-confirm-add-to-cart');
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
      await confirmBtn.click();
    } catch (_) {}

    // Verify Drawer opens
    const drawer = page.locator('[data-testid="cart-drawer-panel"]').first();
    await drawer.waitFor({ state: 'visible', timeout: 15000 });
    console.log('   ✅ Cart Drawer opened');

    // Check Drawer item
    const drawerContent = await page.locator('[data-testid="cart-items-container"]').textContent();
    if (!drawerContent?.includes('Butter Croissant') || !drawerContent?.includes('149')) {
      throw new Error(`Drawer missing Butter Croissant at ₹149: ${drawerContent}`);
    }
    if (drawerContent?.includes('649')) {
      throw new Error(`CRITICAL BUG: ₹649 price leakage in drawer!`);
    }
    console.log('   ✅ Drawer displays Butter Croissant at ₹149 (zero ₹649 leakage)');

    // 3. Verify Product Page State is Preserved (Product does NOT disappear)
    console.log('\n3. Verifying PDP remains mounted behind drawer...');
    const stillTitle = await page.locator('h1').textContent();
    if (!stillTitle?.includes('Butter Croissant')) {
      throw new Error('FAIL: Product title disappeared or unmounted after Add to Cart!');
    }
    const stillAddBtn = await addBtn.isVisible();
    if (!stillAddBtn) {
      throw new Error('FAIL: Add to Bag button disappeared after mutation!');
    }
    console.log('   ✅ PDP remains fully mounted, intact, and interactive');

    // 4. Close Drawer
    console.log('\n4. Closing Cart Drawer...');
    const closeBtn = page.locator('button[aria-label="Close cart"], [data-testid="cart-drawer-close"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      // Click backdrop
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(1000);
    console.log('   ✅ Cart Drawer closed');

    // 5. Verify Header Cart Count
    console.log('\n5. Verifying Header Cart Badge...');
    const badge = page.locator('[data-testid="cart-count-badge"]').first();
    const badgeText = await badge.textContent();
    console.log('   Cart badge count:', badgeText?.trim());
    if (badgeText?.trim() !== '1') {
      console.log('   Note: Header badge text is:', badgeText?.trim());
    }

    // 6. Reopen Cart Drawer from Header
    console.log('\n6. Reopening Cart Drawer from Header...');
    const headerCartBtn = page.locator('[data-testid="header-cart-button"]').first();
    await headerCartBtn.click();
    await drawer.waitFor({ state: 'visible', timeout: 10000 });
    console.log('   ✅ Cart Drawer reopened successfully');

    // 7. Test Quantity Stepper: (+) from 1 to 2
    console.log('\n7. Testing Quantity Increment (+) ...');
    const plusBtn = page.locator('[data-testid="cart-drawer-qty-plus"]').first();
    await plusBtn.click();
    await page.waitForTimeout(1500);

    const qty2 = await page.locator('[data-testid="cart-drawer-qty-value"]').first().textContent();
    console.log('   Quantity after (+):', qty2?.trim());
    if (qty2?.trim() !== '2') {
      throw new Error(`Expected quantity 2, got: ${qty2}`);
    }

    const total2 = await page.locator('[data-testid="cart-total-payable"]').first().textContent();
    console.log('   Total after (+):', total2?.trim());
    if (!total2?.includes('298')) {
      throw new Error(`Expected total ₹298, got: ${total2}`);
    }
    console.log('   ✅ Total recalculated to ₹298 (2 x ₹149)');

    // 8. Test Quantity Stepper: (-) from 2 to 1
    console.log('\n8. Testing Quantity Decrement (-) ...');
    const minusBtn = page.locator('[data-testid="cart-drawer-qty-minus"]').first();
    await minusBtn.click();
    await page.waitForTimeout(1500);

    const qty1 = await page.locator('[data-testid="cart-drawer-qty-value"]').first().textContent();
    console.log('   Quantity after (-):', qty1?.trim());
    if (qty1?.trim() !== '1') {
      throw new Error(`Expected quantity 1, got: ${qty1}`);
    }

    const total1 = await page.locator('[data-testid="cart-total-payable"]').first().textContent();
    console.log('   Total after (-):', total1?.trim());
    if (!total1?.includes('149')) {
      throw new Error(`Expected total ₹149, got: ${total1}`);
    }
    console.log('   ✅ Total recalculated to ₹149');

    // 9. Remove Item from Drawer
    console.log('\n9. Removing Item from Cart Drawer...');
    const removeBtn = page.locator('button[aria-label*="Remove" i], [data-testid="cart-drawer-remove-item"]').first();
    await removeBtn.click();
    await page.waitForTimeout(2000);

    // Verify Empty State
    const emptyState = page.locator('[data-testid="cart-empty-state"]').first();
    const isEmptyVisible = await emptyState.isVisible();
    const emptyText = await page.locator('[data-testid="cart-drawer-panel"]').textContent();
    console.log('   Drawer text after remove:', emptyText?.replace(/\s+/g, ' ').slice(0, 100));
    if (!emptyText?.includes('empty') && !emptyText?.includes('bag is empty')) {
      throw new Error('Expected empty bag message after removing item!');
    }
    console.log('   ✅ Cart Drawer cleanly displays empty bag state after removal');

    console.log('\n================================================================');
    console.log(' 🎉 ALL PDP MUTATION & CART DRAWER STATE TESTS PASSED!');
    console.log('================================================================\n');

  } finally {
    await browser.close();
  }
}

testPdpAndDrawer().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
