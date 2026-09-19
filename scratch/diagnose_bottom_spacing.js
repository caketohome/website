const { chromium } = require(require('path').resolve(__dirname, '../frontend/node_modules/playwright'));
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const viewports = [
    { name: 'mobile_390x844', width: 390, height: 844 },
    { name: 'desktop_1440x900', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // Inspect layout structure and elements near the bottom
    const layoutDetails = await page.evaluate(() => {
      const results = [];
      const body = document.body;
      const html = document.documentElement;

      const main = document.querySelector('main');
      const footer = document.querySelector('footer');

      results.push({
        tag: 'body',
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
        computedPaddingBottom: window.getComputedStyle(body).paddingBottom,
        computedMarginBottom: window.getComputedStyle(body).marginBottom
      });

      if (main) {
        results.push({
          tag: 'main',
          className: main.className,
          offsetHeight: main.offsetHeight,
          scrollHeight: main.scrollHeight,
          computedHeight: window.getComputedStyle(main).height,
          computedMinHeight: window.getComputedStyle(main).minHeight,
          computedPaddingBottom: window.getComputedStyle(main).paddingBottom,
          computedMarginBottom: window.getComputedStyle(main).marginBottom,
          childrenCount: main.children.length
        });

        // inspect children of main, especially the last few children
        const children = Array.from(main.children);
        children.forEach((child, idx) => {
          const style = window.getComputedStyle(child);
          const rect = child.getBoundingClientRect();
          results.push({
            parent: 'main',
            index: idx,
            tag: child.tagName,
            id: child.id,
            className: child.className.slice(0, 100),
            rect: { top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width },
            computedPaddingBottom: style.paddingBottom,
            computedMarginBottom: style.marginBottom,
            textPreview: child.textContent.slice(0, 60).replace(/\s+/g, ' ')
          });
        });
      }

      if (footer) {
        const style = window.getComputedStyle(footer);
        const rect = footer.getBoundingClientRect();
        results.push({
          tag: 'footer',
          className: footer.className,
          rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
          computedPaddingBottom: style.paddingBottom,
          computedMarginBottom: style.marginBottom,
          computedDisplay: style.display,
          computedVisibility: style.visibility,
          computedBgColor: style.backgroundColor,
          computedColor: style.color,
          text: footer.textContent.slice(0, 100)
        });
      }

      // Check all elements in document that have huge padding-bottom or margin-bottom
      const allElements = document.querySelectorAll('*');
      const highSpacing = [];
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const pb = parseFloat(style.paddingBottom) || 0;
        const mb = parseFloat(style.marginBottom) || 0;
        const h = parseFloat(style.height) || 0;
        const minH = style.minHeight;
        if (pb > 50 || mb > 50 || minH.includes('vh')) {
          highSpacing.push({
            tag: el.tagName,
            id: el.id,
            class: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
            pb,
            mb,
            minH,
            text: el.textContent.slice(0, 50).replace(/\s+/g, ' ')
          });
        }
      });

      return { results, highSpacing: highSpacing.slice(0, 20) };
    });

    console.log('Layout Details:');
    console.log(JSON.stringify(layoutDetails, null, 2));

    // Scroll to bottom and take screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const outDir = path.join(__dirname, 'screenshots_repaired');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, `bottom_${vp.name}.png`), fullPage: false });
    await page.screenshot({ path: path.join(outDir, `full_${vp.name}.png`), fullPage: true });
    console.log(`Saved screenshot to screenshots_repaired/bottom_${vp.name}.png`);

    await page.close();
  }

  await browser.close();
})();
