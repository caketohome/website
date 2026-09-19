const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function inspectCroissant() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/products/butter-croissant...');
  await page.goto('http://localhost:3000/products/butter-croissant', { waitUntil: 'networkidle', timeout: 60000 });

  // Evaluate displayed price on PDP
  const prices = await page.evaluate(() => {
    const texts = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent && el.textContent.includes('₹')) {
        texts.push(el.textContent.trim());
      }
    });
    return texts;
  });

  console.log('DOM Leaf Nodes with ₹ on Butter Croissant PDP:', prices);

  const addToBagBtn = page.locator('[data-testid="pdp-add-to-bag"]').first();
  const btnText = await addToBagBtn.textContent();
  console.log('Add to Bag Button Text:', btnText?.trim());

  await browser.close();
}

inspectCroissant().catch(console.error);
