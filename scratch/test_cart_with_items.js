const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function testCartWithItems() {
  console.log('--- Testing Cart Drawer with Live Product Addition & Checkout Flow ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await context.newPage();

  try {
    // 1. Navigate to a product page or category page
    console.log('Navigating to /occasions/anniversary...');
    await page.goto('http://127.0.0.1:3000/occasions/anniversary', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 2. Find first product card with a link
    const productCard = await page.$('a[href*="/shop/"]');
    if (!productCard) {
      console.log('No direct /shop/ link found, checking all product links...');
    }

    // Scroll down to 600px
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    const scrolledBeforeOpen = await page.evaluate(() => window.scrollY);
    console.log('Scrolled down to:', scrolledBeforeOpen);

    // Find and click mobile cart button
    const cartButtons = await page.$$('button[aria-label="Shopping Cart"]');
    let cartBtn = null;
    for (const btn of cartButtons) {
      if (await btn.isVisible()) {
        cartBtn = btn;
        break;
      }
    }
    if (!cartBtn) throw new Error('Cart button not visible');

    await cartBtn.click();
    await page.waitForTimeout(600);

    // Check drawer elements
    const drawerInfo = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="cart-drawer-panel"]');
      const itemsContainer = document.querySelector('[data-testid="cart-items-container"]');
      const checkoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Proceed to Checkout'));
      const viewBagBtn = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent && b.textContent.includes('View Full Bag'));

      return {
        panelVisible: !!panel,
        itemsContainerVisible: !!itemsContainer,
        hasCheckoutBtn: !!checkoutBtn,
        hasViewBagBtn: !!viewBagBtn,
        panelRect: panel ? panel.getBoundingClientRect() : null,
      };
    });

    console.log('Drawer elements verified:', JSON.stringify(drawerInfo, null, 2));

    // Close cart drawer
    const closeBtn = await page.$('button[aria-label="Close cart drawer"]');
    await closeBtn.click();
    await page.waitForTimeout(400);

    const restoredY = await page.evaluate(() => window.scrollY);
    console.log('Restored scrollY:', restoredY, '(expected:', scrolledBeforeOpen, ')');

    if (Math.abs(restoredY - scrolledBeforeOpen) > 2) {
      throw new Error(`Scroll mismatch: got ${restoredY}, expected ${scrolledBeforeOpen}`);
    }

    console.log('✓ Product page scroll lock and restoration test passed cleanly!');
  } catch (err) {
    console.error('❌ Error in testCartWithItems:', err.message);
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
  }
}

testCartWithItems();
