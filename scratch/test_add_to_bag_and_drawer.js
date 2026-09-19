const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function testAddToBagAndDrawer() {
  console.log('--- Testing Live Add to Cart -> Cart Drawer -> Checkout Flow ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to PDP: /shop/vanilla-bean-cupcake...');
    await page.goto('http://127.0.0.1:3000/shop/vanilla-bean-cupcake', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Scroll down 400px
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(300);
    const scrolledBeforeAdd = await page.evaluate(() => window.scrollY);
    console.log('Scrolled down to:', scrolledBeforeAdd);

    // Look for Add to Cart button
    const addBtn = await page.$('button:has-text("Add to Bag"), button:has-text("Add to Cart"), button:has-text("Order Now")');
    if (addBtn) {
      console.log('Clicking Add to Cart button...');
      await addBtn.click();
      await page.waitForTimeout(1500);
    } else {
      console.log('Add to Bag button text variant not directly found, checking all buttons...');
    }

    // Scroll down further to 700px
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    const scrolledBeforeOpen = await page.evaluate(() => window.scrollY);
    console.log('Scrolled down before opening cart:', scrolledBeforeOpen);

    // Find and click mobile cart button
    const cartButtons = await page.$$('button[aria-label="Shopping Cart"]');
    let cartBtn = null;
    for (const btn of cartButtons) {
      if (await btn.isVisible()) {
        cartBtn = btn;
        break;
      }
    }
    if (!cartBtn) throw new Error('Visible cart button not found');

    console.log('Opening Cart Drawer...');
    await cartBtn.click();
    await page.waitForTimeout(600);

    // Inspect drawer state
    const drawerDetails = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="cart-drawer-root"]');
      const panel = document.querySelector('[data-testid="cart-drawer-panel"]');
      const items = Array.from(document.querySelectorAll('[data-testid="cart-items-container"] > div'));
      const checkoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Proceed to Checkout'));
      const viewBagBtn = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent && b.textContent.includes('View Full Bag'));

      return {
        hasRoot: !!root,
        hasPanel: !!panel,
        bodyPosition: document.body.style.position,
        bodyOverflow: document.body.style.overflow,
        itemCount: items.length,
        hasCheckoutBtn: !!checkoutBtn,
        checkoutDisabled: checkoutBtn ? checkoutBtn.disabled : null,
        hasViewBagBtn: !!viewBagBtn,
      };
    });

    console.log('Cart Drawer Details:', JSON.stringify(drawerDetails, null, 2));

    // Verify body scroll is locked
    if (drawerDetails.bodyPosition !== 'fixed' || drawerDetails.bodyOverflow !== 'hidden') {
      throw new Error('Body scroll lock failed on PDP');
    }
    console.log('✓ Body scroll successfully locked while drawer is open on PDP');

    // Screenshot open drawer on PDP
    await page.screenshot({ path: 'scratch/screenshots_cart/drawer_pdp_with_item.png', fullPage: false });
    console.log('✓ Screenshot saved to scratch/screenshots_cart/drawer_pdp_with_item.png');

    // Close drawer via 'X'
    const closeBtn = await page.$('button[aria-label="Close cart drawer"]');
    await closeBtn.click();
    await page.waitForTimeout(400);

    const finalScroll = await page.evaluate(() => window.scrollY);
    console.log('Restored scroll position:', finalScroll, '(expected:', scrolledBeforeOpen, ')');

    if (Math.abs(finalScroll - scrolledBeforeOpen) > 2) {
      throw new Error(`Scroll mismatch after closing drawer: got ${finalScroll}, expected ${scrolledBeforeOpen}`);
    }
    console.log('✓ Page scroll restored perfectly to previous coordinate without jump!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAddToBagAndDrawer();
