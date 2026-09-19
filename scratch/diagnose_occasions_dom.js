const { chromium } = require('../frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: '_cth_jwt', value: 'mock_jwt_session', domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_1', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  await page.goto('http://localhost:3000/dashboard?tab=cms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  let occasionsLayer = page.locator('div[data-section-type="occasions_grid"], div:has-text("Occasions Grid")').filter({ hasNotText: 'All Sections' }).first();
  if (await occasionsLayer.count() === 0) {
    const addSectionBtn = page.locator('button[title="Add Section"]').or(page.locator('button:has-text("Add")')).first();
    await addSectionBtn.click();
    await page.waitForTimeout(1000);
    const occasionOption = page.locator('button:has-text("Occasions Grid")').first();
    await occasionOption.click();
    await page.waitForTimeout(1500);
  } else {
    await occasionsLayer.click();
    await page.waitForTimeout(1000);
  }

  const trigger = page.locator('button[role="combobox"]:has-text("PIM Database Occasions")').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForTimeout(600);

  const manualOption = page.locator('div[role="option"]:has-text("Manual Occasion Cards")').first();
  await manualOption.click();
  await page.waitForTimeout(1000);

  console.log('Step 4: Clicking Choose from PIM button...');
  const chooseBtn = page.locator('button:has-text("Choose from PIM")').first();
  await chooseBtn.scrollIntoViewIfNeeded();
  await chooseBtn.click();
  await page.waitForTimeout(1000);

  console.log('Step 5: Selecting occasions in modal...');
  const modalCards = page.locator('div.fixed div.cursor-pointer').filter({ hasText: /Birthday|Anniversary|Valentine|Wedding|Engagement|Mother|Celebration|Love/i });
  const count = await modalCards.count();
  console.log(`Found ${count} modal cards.`);
  for (let i = 0; i < Math.min(count, 3); i++) {
    await modalCards.nth(i).click();
    await page.waitForTimeout(200);
  }

  console.log('Step 6: Applying selection...');
  const applyBtn = page.locator('button:has-text("Apply Selection")').first();
  await applyBtn.click();
  await page.waitForTimeout(1000);

  console.log('Step 7: Checking cards list in inspector...');
  const cardCount = await page.locator('div[class*="rounded-xl border"]:has-text("1")').count();
  console.log('Found card #1:', cardCount > 0);

  // Expand card #1
  console.log('Step 8: Expanding card #1...');
  const firstCard = page.locator('div[class*="rounded-xl border"]:has-text("1")').first();
  await firstCard.scrollIntoViewIfNeeded();
  
  // Click header row
  const headerRow = firstCard.locator('.cursor-pointer').first();
  await headerRow.click();
  await page.waitForTimeout(1000);

  // Inspect HTML of firstCard after click
  const cardHTML = await firstCard.evaluate(el => el.outerHTML);
  console.log('Card #1 HTML after click (first 1000 chars):', cardHTML.slice(0, 1000));
  console.log('Has Card Title label?', cardHTML.includes('Card Title'));

  const inputs = await firstCard.locator('input').all();
  console.log('Inputs found in card #1:', inputs.length);
  for (let inp of inputs) {
    const val = await inp.inputValue();
    console.log('Input value:', val);
  }

  await browser.close();
})();
