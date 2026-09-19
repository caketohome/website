const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('================================================================');
  console.log('--- STARTING OCCASIONS GRID MANUAL CHOOSER E2E TEST ---');
  console.log('================================================================');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: '_cth_jwt', value: 'mock_jwt_session', domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_1', domain: 'localhost', path: '/' },
    { name: '_cth_phone', value: '+91 98765 00000', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const screenshotsDir = path.join(__dirname, 'test-results');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  async function takeScreenshot(name, fullPage = false) {
    try {
      await page.screenshot({ path: path.join(screenshotsDir, name), timeout: 8000, animations: 'disabled', fullPage });
      console.log('  [Screenshot Captured]:', name);
    } catch (e) {
      console.warn('  [Screenshot Warning]:', name, e.message);
    }
  }

  // Step 1: Navigate to CMS page configurator
  console.log('\nStep 1: Navigating to CMS page configurator /dashboard?tab=cms ...');
  await page.goto('http://localhost:3000/dashboard?tab=cms', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  await takeScreenshot('01-cms-dashboard.png');

  // Step 2: Ensure Occasions Grid section exists and select it
  console.log('\nStep 2: Locating or adding Occasions Grid section in layers...');
  let occasionsLayer = page.locator('[data-testid="section-item-occasions_grid"]').or(page.locator('div[data-section-type="occasions_grid"]')).first();
  const hasOccasionsLayer = (await occasionsLayer.count() > 0) && (await occasionsLayer.isVisible().catch(() => false));

  if (!hasOccasionsLayer) {
    console.log('  Occasions Grid section not in layers list yet. Adding section via modal...');
    const addSectionBtn = page.locator('button[title="Add Section"]').or(page.locator('button:has-text("Add")')).first();
    await addSectionBtn.click();
    await page.waitForTimeout(1000);

    const occasionOption = page.locator('button:has-text("Occasions Grid")').first();
    await occasionOption.waitFor({ state: 'visible', timeout: 5000 });
    await occasionOption.click();
    await page.waitForTimeout(1500);
    console.log('  Occasions Grid section successfully added.');
  } else {
    console.log('  Occasions Grid section found in layers list. Selecting it...');
    await occasionsLayer.scrollIntoViewIfNeeded();
    await occasionsLayer.click();
    await page.waitForTimeout(1500);
  }

  // Ensure inspector is open for section
  const backToPageSettings = page.locator('button:has-text("← Page Settings")').first();
  if (await backToPageSettings.count() === 0) {
    console.log('  Re-clicking layer item to ensure inspector activates...');
    await occasionsLayer.click();
    await page.waitForTimeout(1200);
  }

  await takeScreenshot('02-occasions-grid-selected.png');

  // Step 3: Switch Data Source to "Manual Occasion Cards"
  console.log('\nStep 3: Switching Occasion Data Source to "manual"...');
  const isAlreadyManual = await page.locator('[data-testid="choose-from-pim-btn"]').or(page.locator('button:has-text("Choose from PIM")')).count() > 0;
  if (!isAlreadyManual) {
    const trigger = page.locator('[data-testid="occasion-data-source-trigger"]').or(page.locator('button[role="combobox"]:has-text("PIM Database Occasions")')).first();
    if (await trigger.count() > 0) {
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await page.waitForTimeout(600);
      const manualOption = page.locator('div[role="option"]:has-text("Manual Occasion Cards")').first();
      await manualOption.click();
      await page.waitForTimeout(1000);
    }
  }
  await takeScreenshot('03-manual-mode-active.png');

  // Step 4: Open Occasion Chooser Modal
  console.log('\nStep 4: Opening Occasion Chooser Modal via "Choose from PIM"...');
  const chooseBtn = page.locator('[data-testid="choose-from-pim-btn"]').or(page.locator('button:has-text("Choose from PIM")')).first();
  await chooseBtn.scrollIntoViewIfNeeded();
  await chooseBtn.waitFor({ state: 'visible', timeout: 8000 });
  await chooseBtn.click();
  await page.waitForTimeout(1200);

  await takeScreenshot('04-chooser-modal-open.png');

  // Step 5: Test Search / Filter in modal
  console.log('\nStep 5: Testing Search & Filtering in Chooser Modal...');
  const searchInput = page.locator('input[placeholder*="Search occasions"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('Birth');
    await page.waitForTimeout(600);
    await takeScreenshot('05-chooser-search-filtered.png');
    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(600);
  }

  // Step 6: Select 3 occasions
  console.log('\nStep 6: Selecting occasion cards in chooser modal...');
  const modalCards = page.locator('div.fixed div.cursor-pointer').filter({ hasText: /Birthday|Anniversary|Valentine|Wedding|Engagement|Mother|Celebration|Love/i });
  const count = await modalCards.count();
  console.log(`  Found ${count} occasion cards in modal.`);

  // Click first 3 options
  for (let i = 0; i < Math.min(count, 3); i++) {
    await modalCards.nth(i).click();
    await page.waitForTimeout(300);
  }

  await takeScreenshot('06-chooser-selected-3.png');

  // Step 7: Apply Selection
  console.log('\nStep 7: Applying selection...');
  const applyBtn = page.locator('button:has-text("Apply Selection")').first();
  await applyBtn.click();
  await page.waitForTimeout(1500);

  await takeScreenshot('07-selection-applied-in-editor.png');

  // Step 8: Verify cards are in the editor list
  console.log('\nStep 8: Checking selected cards in editor...');
  const card0 = page.locator('[data-testid="manual-occasion-card-0"]').first();
  await card0.scrollIntoViewIfNeeded();
  await card0.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  Manual occasion card #0 rendered in editor.');

  // Step 9: Edit the first card's title to "Bespoke Celebration Delights"
  console.log('\nStep 9: Expanding and editing Card #0 title to "Bespoke Celebration Delights"...');
  const expand0 = page.locator('[data-testid="manual-occasion-expand-0"]').first();
  await expand0.scrollIntoViewIfNeeded();
  await expand0.click();
  await page.waitForTimeout(800);

  const titleInput = page.locator('[data-testid="manual-occasion-title-input-0"]').first();
  await titleInput.scrollIntoViewIfNeeded();
  await titleInput.waitFor({ state: 'visible', timeout: 5000 });
  await titleInput.fill('Bespoke Celebration Delights');
  await page.waitForTimeout(600);

  await takeScreenshot('08-card-edited.png');

  // Step 10: Reorder cards - click Move Down on the first card
  console.log('\nStep 10: Testing card reordering (Move Down)...');
  const moveDownBtn = page.locator('[data-testid="manual-occasion-move-down-0"]').first();
  if (await moveDownBtn.count() > 0 && !(await moveDownBtn.isDisabled())) {
    await moveDownBtn.click();
    await page.waitForTimeout(600);
    console.log('  Move Down clicked.');
  }

  // Step 11: Verify center preview canvas renders the cards
  console.log('\nStep 11: Checking preview canvas...');
  await takeScreenshot('09-canvas-preview.png');

  // Step 12: Click "Save Draft"
  console.log('\nStep 12: Saving draft to PostgreSQL...');
  const saveDraftBtn = page.locator('button[data-testid="cms-save-draft-btn"]').or(page.locator('button:has-text("Save Draft")')).first();
  await saveDraftBtn.click();
  await page.waitForTimeout(3500);

  // Step 13: Reload editor to verify persistence through database
  console.log('\nStep 13: Reloading editor to verify draft persistence...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Reselect Occasions Grid layer
  const occasionsLayerAfterReload = page.locator('div[data-section-type="occasions_grid"], div:has-text("Occasions Grid")').filter({ hasNotText: 'All Sections' }).first();
  await occasionsLayerAfterReload.click();
  await page.waitForTimeout(1500);
  await takeScreenshot('10-after-reload-persistence.png');

  // Check if "Bespoke Celebration Delights" still exists in the editor
  const hasCustomTitleInEditor = await page.locator('text=Bespoke Celebration Delights').count() > 0;
  console.log('  [PERSISTENCE VERIFICATION]: "Bespoke Celebration Delights" in editor after reload:', hasCustomTitleInEditor);

  // Step 14: Publish Changes
  console.log('\nStep 14: Publishing changes to PostgreSQL...');
  const publishBtn = page.locator('button[data-testid="cms-publish-btn"]').first();
  await publishBtn.scrollIntoViewIfNeeded();
  await publishBtn.waitFor({ state: 'visible', timeout: 5000 });
  await publishBtn.click();
  await page.waitForTimeout(5000);

  // Step 15: Navigate to public storefront
  console.log('\nStep 15: Navigating to public storefront homepage (http://localhost:3000/)...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  await takeScreenshot('11-public-storefront.png', true);

  const publicPageHasCustom = await page.locator('text=Bespoke Celebration Delights').count() > 0;
  console.log('  [PUBLIC STOREFRONT VERIFICATION]: "Bespoke Celebration Delights" on public page:', publicPageHasCustom);

  console.log('\nTotal Console errors encountered:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('  Console errors:', consoleErrors.slice(0, 5));
  }

  await browser.close();

  if (!hasCustomTitleInEditor) {
    throw new Error('FAILED: "Bespoke Celebration Delights" was not preserved in editor after reload!');
  }
  if (!publicPageHasCustom) {
    throw new Error('FAILED: "Bespoke Celebration Delights" was not found on public storefront homepage!');
  }

  console.log('\n================================================================');
  console.log('--- ALL OCCASIONS GRID MANUAL CHOOSER VERIFICATIONS PASSED ---');
  console.log('================================================================');
})().catch(err => {
  console.error('\nE2E TEST FAILED WITH ERROR:', err);
  process.exit(1);
});
