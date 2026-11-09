const { chromium } = require('playwright');
(async () => {
  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  console.log('Browser launched!');
  await browser.close();
  console.log('Browser closed!');
  process.exit(0);
})().catch(e => {
  console.error('PW error:', e);
  process.exit(1);
});
