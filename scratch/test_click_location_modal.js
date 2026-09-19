const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const res = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label="Select delivery location"]'));
    return btns.map(b => ({
      visible: b.offsetParent !== null,
      parent: b.parentElement ? b.parentElement.className : 'none',
      rect: b.getBoundingClientRect()
    }));
  });

  console.log('LOCATION BUTTONS:', res);

  // Click using real mouse pointer at center of visible button
  const visibleBtn = page.locator('button[aria-label="Select delivery location"]:visible').first();
  await visibleBtn.click();
  await page.waitForTimeout(1000);

  const panelFound = await page.evaluate(() => {
    const p = document.querySelector('.popover-solid-panel');
    return p ? { visible: p.offsetParent !== null, html: p.innerText.slice(0, 100) } : null;
  });
  console.log('PANEL AFTER CLICK:', panelFound);

  const outPath = path.join(__dirname, 'screenshots/final_verification/02_location_modal_search_area.png');
  await page.screenshot({ path: outPath });
  console.log('Screenshot saved to:', outPath);

  await browser.close();
}

main().catch(console.error);
