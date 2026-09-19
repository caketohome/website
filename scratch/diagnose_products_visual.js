const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const networkRequests = [];
  const networkErrors = [];
  const consoleMessages = [];

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    consoleMessages.push({ type: 'pageerror', text: err.message, stack: err.stack });
  });

  page.on('requestfailed', req => {
    networkErrors.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  page.on('response', res => {
    networkRequests.push({
      url: res.url(),
      status: res.status(),
      contentType: res.headers()['content-type']
    });
  });

  console.log('Navigating to http://localhost:3000/products...');
  await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle', timeout: 30000 });

  // Take screenshot
  const screenshotPath = path.join(__dirname, 'screenshots/products_diagnostic.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);

  // Check CSS links in HTML
  const cssLinks = await page.$$eval('link[rel="stylesheet"]', links => links.map(l => ({
    href: l.href,
    rel: l.rel,
    media: l.media
  })));
  console.log('\n--- CSS Links in DOM ---');
  console.log(JSON.stringify(cssLinks, null, 2));

  // Check <style> tags in DOM
  const styleTagsCount = await page.$$eval('style', styles => styles.length);
  console.log(`\n--- Style tags in DOM: ${styleTagsCount} ---`);

  // Inspect computed styles
  const computed = await page.evaluate(() => {
    const body = document.body;
    const header = document.querySelector('header');
    const firstButton = document.querySelector('button');
    const firstProductCard = document.querySelector('[data-testid="product-card"]') || document.querySelector('.product-card') || document.querySelector('article');
    const productGrid = document.querySelector('.grid') || document.querySelector('[class*="grid"]');

    return {
      body: {
        fontFamily: window.getComputedStyle(body).fontFamily,
        backgroundColor: window.getComputedStyle(body).backgroundColor,
        color: window.getComputedStyle(body).color,
      },
      header: header ? {
        display: window.getComputedStyle(header).display,
        position: window.getComputedStyle(header).position,
        backgroundColor: window.getComputedStyle(header).backgroundColor,
        classes: header.className,
      } : null,
      firstButton: firstButton ? {
        display: window.getComputedStyle(firstButton).display,
        backgroundColor: window.getComputedStyle(firstButton).backgroundColor,
        classes: firstButton.className,
      } : null,
      productGrid: productGrid ? {
        display: window.getComputedStyle(productGrid).display,
        classes: productGrid.className,
      } : null,
      headersCount: document.querySelectorAll('header').length,
      productsCount: document.querySelectorAll('[data-testid="product-card"]').length,
      allImagesCount: document.querySelectorAll('img').length,
      htmlSnippet: document.body.innerHTML.substring(0, 1500)
    };
  });

  console.log('\n--- Computed Styles & Elements ---');
  console.log(JSON.stringify(computed, null, 2));

  console.log('\n--- Network CSS Requests ---');
  const cssReqs = networkRequests.filter(r => r.url.includes('.css') || (r.contentType && r.contentType.includes('text/css')));
  console.log(JSON.stringify(cssReqs, null, 2));

  console.log('\n--- Network Errors ---');
  console.log(JSON.stringify(networkErrors, null, 2));

  console.log('\n--- Console Messages ---');
  console.log(JSON.stringify(consoleMessages.filter(m => m.type !== 'log'), null, 2));

  await browser.close();
}

diagnose().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
