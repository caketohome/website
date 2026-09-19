const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const btsDetails = await page.evaluate(() => {
    const bts = document.querySelector('section:has(img[alt*="Behind"])') || document.querySelector('section:last-of-type');
    const btsRect = bts ? bts.getBoundingClientRect() : null;
    const btsParent = bts ? bts.parentElement : null;
    const btsParentRect = btsParent ? btsParent.getBoundingClientRect() : null;
    const btsParentStyle = btsParent ? window.getComputedStyle(btsParent) : null;
    
    const main = document.querySelector('main');
    const footer = document.querySelector('footer');

    // list all siblings or wrappers after bts
    const elementsAfter = [];
    if (bts) {
      let curr = bts;
      while (curr && curr !== document.body) {
        let sibling = curr.nextElementSibling;
        while (sibling) {
          const sStyle = window.getComputedStyle(sibling);
          elementsAfter.push({
            tag: sibling.tagName,
            class: sibling.className.slice(0, 80),
            rect: sibling.getBoundingClientRect(),
            height: sStyle.height,
            pb: sStyle.paddingBottom,
            mb: sStyle.marginBottom
          });
          sibling = sibling.nextElementSibling;
        }
        curr = curr.parentElement;
      }
    }

    return {
      btsRect,
      btsStyle: bts ? {
        margin: window.getComputedStyle(bts).margin,
        padding: window.getComputedStyle(bts).padding,
        className: bts.className
      } : null,
      btsParentStyle: btsParentStyle ? {
        margin: btsParentStyle.margin,
        padding: btsParentStyle.padding,
        gap: btsParentStyle.gap,
        className: btsParent.className
      } : null,
      elementsAfter,
      footerRect: footer ? footer.getBoundingClientRect() : null,
      footerStyle: footer ? {
        className: footer.className,
        bgColor: window.getComputedStyle(footer).backgroundColor,
        color: window.getComputedStyle(footer).color,
        height: window.getComputedStyle(footer).height,
        padding: window.getComputedStyle(footer).padding,
        margin: window.getComputedStyle(footer).margin
      } : null
    };
  });

  console.log('BTS Details:', JSON.stringify(btsDetails, null, 2));
  await browser.close();
})();
