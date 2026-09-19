const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function inspectPoint() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const pointInfo = await page.evaluate(() => {
    const el = document.elementFromPoint(500, 300);
    if (!el) return 'No element at point';

    const getFullStyle = (target) => {
      const cs = window.getComputedStyle(target);
      const before = window.getComputedStyle(target, '::before');
      const after = window.getComputedStyle(target, '::after');
      return {
        tag: target.tagName,
        id: target.id,
        className: target.className,
        bgColor: cs.backgroundColor,
        bgImage: cs.backgroundImage,
        color: cs.color,
        filter: cs.filter,
        backdropFilter: cs.backdropFilter,
        beforeBg: before.backgroundColor,
        afterBg: after.backgroundColor
      };
    };

    const chain = [];
    let curr = el;
    while (curr) {
      chain.push(getFullStyle(curr));
      curr = curr.parentElement;
    }
    return chain;
  });

  console.log('Element chain at (500, 300):', JSON.stringify(pointInfo, null, 2));
  await browser.close();
}

inspectPoint().catch(console.error);
