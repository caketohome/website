const path = require('path');
const { chromium } = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/playwright'));

async function testChromium() {
  try {
    const browser = await chromium.launch({ headless: true });
    console.log('Chromium launched successfully!');
    await browser.close();
  } catch (err) {
    console.log('Chromium launch failed:', err.message);
  }
}

testChromium();
