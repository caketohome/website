const { chromium } = require('playwright');
const path = require('path');

async function testLaunch() {
  console.log('Testing Playwright chromium launch...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence/video'),
      size: { width: 1280, height: 800 }
    }
  });
  const page = await context.newPage();
  console.log('Navigating to http://localhost:3000/login ...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  console.log('Page Title:', title);

  const screenshotPath = path.resolve(__dirname, '../../CHECKPOINTS/acceptance-test-evidence/00-login-test.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await context.close();
  await browser.close();
  console.log('Playwright test completed successfully!');
}

testLaunch().catch(err => {
  console.error('Playwright launch error:', err);
  process.exit(1);
});
