const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function inspectCupcakeMobile() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  
  await page.goto('http://localhost:3000/products/chocolate-fudge-cupcake', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: path.join(__dirname, 'screenshots/debug_cupcake_before_click.png') });
  
  const addBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(1500);
  
  await page.screenshot({ path: path.join(__dirname, 'screenshots/debug_cupcake_after_click.png') });
  
  // Check if any error/validation message or modal appeared
  const bodyText = await page.locator('body').textContent();
  console.log('Validation Error visible?:', bodyText.includes('Please select'));
  console.log('Confirm modal visible?:', bodyText.includes('Add cake without a message'));
  console.log('Cart drawer visible?:', bodyText.includes('Your Bag') || bodyText.includes('Total Payable'));

  await browser.close();
}

inspectCupcakeMobile().catch(console.error);
