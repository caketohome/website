const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('#phone_input', '9876500001');
  await page.waitForTimeout(500);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  const digitInputs = await page.$$('input[maxlength="1"]');
  for (let i = 0; i < 6; i++) {
    await digitInputs[i].fill(String(i + 1));
  }
  await page.waitForTimeout(500);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3000/dashboard/shop', { waitUntil: 'networkidle' });
  const prodTab = page.locator('button:has-text("Product Availability")').first();
  await prodTab.click();
  await page.waitForTimeout(1500);

  const card = page.locator('div.rounded-xl', { has: page.locator('h4:has-text("Chocolate Fudge Cupcake")') }).first();
  console.log('Card found count:', await card.count());

  const outOfStockBtn = card.locator('button:has-text("Out of Stock")');
  const availableBtn = card.locator('button:has-text("Available")');
  console.log('Out of stock button visible:', await outOfStockBtn.isVisible());
  console.log('Available button visible:', await availableBtn.isVisible());

  // Click Out of Stock
  await outOfStockBtn.click();
  await page.waitForTimeout(1500);
  console.log('Class after clicking Out of Stock:', await outOfStockBtn.getAttribute('class'));

  // Click Available
  await availableBtn.click();
  await page.waitForTimeout(1500);
  console.log('Class after clicking Available:', await availableBtn.getAttribute('class'));

  await browser.close();
}

test().catch(console.error);
