const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function inspectDarkElements() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const darkElements = await page.evaluate(() => {
    const results = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const cs = window.getComputedStyle(el);
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        // Parse rgb
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          // If very dark (r < 50, g < 50, b < 50)
          if (r < 50 && g < 50 && b < 50) {
            results.push({
              tag: el.tagName,
              id: el.id,
              className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
              bgColor: bg,
              width: el.offsetWidth,
              height: el.offsetHeight
            });
          }
        }
      }
    }
    return results;
  });

  console.log('Dark elements found:', JSON.stringify(darkElements, null, 2));
  await browser.close();
}

inspectDarkElements().catch(console.error);
