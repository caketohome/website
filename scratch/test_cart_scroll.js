const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log('Navigating to homepage...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Initial State
  const initialScrollY = await page.evaluate(() => window.scrollY);
  console.log('Initial scrollY:', initialScrollY);

  // 2. Scroll down 1200px
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(500);
  const scrolledY = await page.evaluate(() => window.scrollY);
  console.log('Scrolled scrollY:', scrolledY);

  // Inspect header element position
  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const rect = header.getBoundingClientRect();
    const style = window.getComputedStyle(header);
    return {
      rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
      position: style.position,
      zIndex: style.zIndex,
      top: style.top
    };
  });
  console.log('Header info when scrolled:', JSON.stringify(headerInfo, null, 2));

  // Find visible cart button
  const cartButtons = await page.$$('button[aria-label="Shopping Cart"]');
  let cartBtn = null;
  for (const btn of cartButtons) {
    const isVisible = await btn.isVisible();
    if (isVisible) {
      cartBtn = btn;
      break;
    }
  }
  if (!cartBtn) {
    console.error('Visible cart button not found!');
    await browser.close();
    return;
  }
  const btnRect = await page.evaluate(el => el.getBoundingClientRect(), cartBtn);
  console.log('Cart button rect when scrolled:', JSON.stringify(btnRect, null, 2));

  // Click cart button
  console.log('Clicking cart button...');
  await cartBtn.click();
  await page.waitForTimeout(800);

  // Inspect state after opening cart
  const postOpenInfo = await page.evaluate(() => {
    const main = document.querySelector('main');
    const body = document.body;
    const html = document.documentElement;

    // Find cart modal / dropdown content
    // Check all radix popper / portal contents or elements containing "Your Bag"
    const bagHeading = Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.includes('Your Bag') && el.tagName.match(/^H[1-6]$/));
    const bagContainer = bagHeading ? bagHeading.closest('[class*="rounded"]') : null;

    let bagContainerInfo = null;
    if (bagContainer) {
      const rect = bagContainer.getBoundingClientRect();
      const style = window.getComputedStyle(bagContainer);
      const parent = bagContainer.parentElement;
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      bagContainerInfo = {
        tagName: bagContainer.tagName,
        className: bagContainer.className,
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
        style: {
          position: style.position,
          maxHeight: style.maxHeight,
          overflowY: style.overflowY,
          transform: style.transform
        },
        parent: parent ? {
          tagName: parent.tagName,
          className: parent.className,
          stylePosition: parentStyle?.position,
          styleTop: parentStyle?.top,
          styleLeft: parentStyle?.left,
          styleTransform: parentStyle?.transform,
          rect: parent.getBoundingClientRect()
        } : null
      };
    }

    return {
      windowScrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      mainFilter: main ? main.style.filter : null,
      bodyStyle: {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        pointerEvents: body.style.pointerEvents,
        dataScrollLocked: body.getAttribute('data-scroll-locked')
      },
      htmlStyle: {
        overflow: html.style.overflow
      },
      bagContainerInfo
    };
  });

  console.log('Post-open info:', JSON.stringify(postOpenInfo, null, 2));

  await page.screenshot({ path: 'scratch/cart_opened_scrolled.png', fullPage: false });
  console.log('Screenshot saved to scratch/cart_opened_scrolled.png');

  await browser.close();
})();
