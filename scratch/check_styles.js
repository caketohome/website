const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function checkStyles() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/products", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const styles = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector('main');
    const root = document.querySelector('[data-testid="products-catalog-root"]');
    const h1 = document.querySelector('h1');

    return {
      htmlClass: html.className,
      bodyClass: body.className,
      htmlBg: window.getComputedStyle(html).backgroundColor,
      bodyBg: window.getComputedStyle(body).backgroundColor,
      mainBg: main ? window.getComputedStyle(main).backgroundColor : null,
      rootBg: root ? window.getComputedStyle(root).backgroundColor : null,
      h1Color: h1 ? window.getComputedStyle(h1).color : null,
      h1Text: h1 ? h1.innerText : null,
    };
  });

  console.log("COMPUTED STYLES:", JSON.stringify(styles, null, 2));
  await browser.close();
}

checkStyles().catch(console.error);
