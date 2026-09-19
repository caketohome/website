const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'frontend/node_modules/playwright'));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/cart', { waitUntil: 'domcontentloaded' });
  const cartTheme = await page.evaluate(() => {
    return {
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
      mainBg: document.querySelector('main') ? window.getComputedStyle(document.querySelector('main')).backgroundColor : 'no main'
    };
  });
  console.log('Cart theme:', cartTheme);

  await page.goto('http://localhost:3000/products/chocolate-truffle', { waitUntil: 'domcontentloaded' });
  const pdpTheme = await page.evaluate(() => {
    const mainOrDiv = document.querySelector('.min-h-screen') || document.querySelector('main') || document.body.firstElementChild;
    return {
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
      containerClasses: mainOrDiv ? mainOrDiv.className : '',
      containerBg: mainOrDiv ? window.getComputedStyle(mainOrDiv).backgroundColor : ''
    };
  });
  console.log('PDP theme:', pdpTheme);

  await browser.close();
}

run().catch(console.error);
