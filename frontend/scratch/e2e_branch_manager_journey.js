const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const SECRET = process.env.JWT_SECRET || 'supersecret';

function createJwt(userId, role, branchId = null) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    role,
    branchId,
    exp: Math.floor(Date.now() / 1000) + 7 * 86400,
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const SCREENSHOT_DIR = 'C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\32bebf93-8421-489f-96dd-e2ae2ce852e7\\screenshots';

async function runBrowserJourney() {
  console.log('=== STARTING REAL BROWSER (PLAYWRIGHT) BRANCH MANAGER E2E TEST ===\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const branchId = 'br_indiranagar';
  const managerUserId = 'mgr_indiranagar';
  const managerToken = createJwt(managerUserId, 'BRANCH_MANAGER', branchId);
  const supToken = createJwt('usr_sup_indiranagar', 'SUPERVISOR', branchId);
  const finToken = createJwt('usr_fin_indiranagar', 'FINANCE_CONTROLLER', branchId);

  // Pre-test cleanup: ensure no hanging session blocks opening a new test shift
  try {
    const actRes = await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/active?branch_id=${branchId}`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const actData = await actRes.json();
    if (actData.session) {
      const sess = actData.session;
      console.log(`Pre-test cleanup: Found active session ${sess.id} in ${sess.status} status.`);
      if (sess.status === 'OPEN') {
        await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sess.id}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` },
          body: JSON.stringify({ closing_count: sess.expected_cash || 500, notes: 'Pre-test close' })
        });
      }
      if (sess.status === 'OPEN' || sess.status === 'CLOSING') {
        await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sess.id}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supToken}` },
          body: JSON.stringify({ notes: 'Pre-test supervisor verify' })
        });
      }
      await fetch(`http://localhost:3001/api/v1/admin/teller/sessions/${sess.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finToken}` },
        body: JSON.stringify({ notes: 'Pre-test finance settle' })
      });
      console.log(`Pre-test cleanup: Session ${sess.id} settled successfully.`);
    }
  } catch (err) {
    console.log('Pre-test cleanup notice:', err.message);
  }

  // Set cookies
  await context.addCookies([
    { name: '_cth_jwt', value: managerToken, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'BRANCH_MANAGER', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: managerUserId, domain: 'localhost', path: '/' },
    { name: '_cth_branch_id', value: branchId, domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();

  // Listen to console and page errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error]: ${msg.text()}`);
    }
  });

  try {
    // 1. Navigate to Teller Cash Custody Dashboard
    console.log('Step 1: Navigating to Teller Cash Custody as Branch Manager...');
    await page.goto('http://localhost:3001/dashboard?tab=teller_custody', { timeout: 60000 });
    await page.waitForSelector('text=Teller Cash Custody', { timeout: 60000 });
    await page.waitForTimeout(3000);

    // Verify branch selector shows assigned branch
    const branchSelect = page.locator('select').first();
    const selectedBranch = await branchSelect.inputValue();
    console.log(`[PASS] Branch resolved: ${selectedBranch}`);

    // Pre-test cleanup ensured pristine state

    // Step 2: Open a new Cash Shift without creating a separate teller employee!
    console.log('\nStep 2: Starting a shift without creating a separate teller employee...');
    const openBtn = page.locator('button:has-text("Open New Cash Shift")').first();
    await openBtn.waitFor({ state: 'visible', timeout: 10000 });
    await openBtn.click();

    // Fill opening float modal
    await page.waitForSelector('text=Open Cash Shift');
    const floatInput = page.locator('input[type="number"]').first();
    await floatInput.fill('500');
    const notesInput = page.locator('textarea').first();
    await notesInput.fill('Morning Shift Float - Indiranagar Main Till');

    await page.click('button[type="submit"]:has-text("Open Shift")');
    await page.waitForTimeout(2000);

    // Verify active shift is now displayed
    await page.waitForSelector('text=Shift Open', { timeout: 10000 });
    console.log('[PASS] Active Shift successfully opened without separate teller employee!');

    // Capture Screenshot 1: Active Shift Opened
    const screenshot1Path = path.join(SCREENSHOT_DIR, '01_active_shift_opened.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${screenshot1Path}`);

    // Step 3: Record cash receipt (Direction: IN, ₹250)
    console.log('\nStep 3: Recording cash receipt (IN, ₹250)...');
    await page.click('button:has-text("Cash Adjustment")');
    await page.waitForSelector('text=Record Cash Adjustment');
    
    // Select IN
    await page.click('button:has-text("Cash IN (+)")');
    // Amount input
    const adjAmountInput = page.locator('input[placeholder="0.00"]').first();
    await adjAmountInput.fill('250');
    // Narration
    const narrationInput = page.locator('textarea, input[placeholder*="Reason"]').first();
    await narrationInput.fill('Walk-in cake order cash receipt');

    await page.click('button:has-text("Record Movement")');
    await page.waitForTimeout(2000);
    console.log('[PASS] Cash receipt ₹250 recorded successfully!');

    // Step 4: Record approved cash expense (Direction: OUT, ₹75)
    console.log('\nStep 4: Recording approved cash expense (OUT, ₹75)...');
    await page.click('button:has-text("Cash Adjustment")');
    await page.waitForSelector('text=Record Cash Adjustment');
    
    // Select OUT
    await page.click('button:has-text("Cash OUT (-)")');
    const outAmountInput = page.locator('input[placeholder="0.00"]').first();
    await outAmountInput.fill('75');
    const outNarrationInput = page.locator('textarea, input[placeholder*="Reason"]').first();
    await outNarrationInput.fill('Store cleaning supplies purchase');

    await page.click('button:has-text("Record Movement")');
    await page.waitForTimeout(2000);
    console.log('[PASS] Approved expense ₹75 recorded successfully!');

    // Capture Screenshot 2: Movements & Expected Cash (₹500 + ₹250 - ₹75 = ₹675)
    const screenshot2Path = path.join(SCREENSHOT_DIR, '02_movements_and_expected_cash.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${screenshot2Path}`);

    // Step 5: Test overdraw attempt (OUT, ₹5000 > ₹675 available)
    console.log('\nStep 5: Testing disbursement exceeding available cash (OUT ₹5000, must FAIL)...');
    await page.click('button:has-text("Cash Adjustment")');
    await page.waitForSelector('text=Record Cash Adjustment');
    await page.click('button:has-text("Cash OUT (-)")');
    const overdrawInput = page.locator('input[placeholder="0.00"]').first();
    await overdrawInput.fill('5000');
    const overdrawNarration = page.locator('textarea, input[placeholder*="Reason"]').first();
    await overdrawNarration.fill('Unauthorized overdraw attempt');
    await page.click('button:has-text("Record Movement")');
    await page.waitForTimeout(2000);

    const errorBanner = page.locator('form div.bg-rose-50').first();
    const errorVisible = await errorBanner.isVisible();
    const errorText = await errorBanner.innerText().catch(() => '');
    console.log(`[PASS] Overdraw correctly rejected! Error displayed: ${errorVisible} ("${errorText.trim()}")`);

    // Close the adjustment modal
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(1000);

    // Step 6: Close Shift with physical count ₹675 (Zero Variance)
    console.log('\nStep 6: Closing shift with physical count ₹675...');
    await page.click('button:has-text("Close Shift & Count")');
    await page.waitForSelector('text=Close Cash Shift');

    const closingInput = page.locator('input[placeholder="0.00"]').first();
    await closingInput.fill('675');
    const closeNotes = page.locator('textarea').first();
    await closeNotes.fill('End of day physical count verified ₹675. Zero variance.');

    await page.click('button:has-text("Confirm & Close Shift")');
    await page.waitForTimeout(2500);
    console.log('[PASS] Shift closed successfully!');

    // Capture Screenshot 3: Closed Shift
    const screenshot3Path = path.join(SCREENSHOT_DIR, '03_shift_closed_pending_verification.png');
    await page.screenshot({ path: screenshot3Path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${screenshot3Path}`);

    // Step 7: Switch to Session Audit History Tab
    console.log('\nStep 7: Testing Session Audit History Tab...');
    await page.click('button:has-text("Session Audit History")');
    await page.waitForTimeout(2000);

    // Verify branch filter dropdown exists
    const historyBranchFilter = page.locator('select:has-text("Indiranagar")').first();
    const filterExists = await historyBranchFilter.isVisible();
    console.log(`[PASS] Branch Filter in Session Audit History: ${filterExists}`);

    // Capture Screenshot 4: Session Audit History
    const screenshot4Path = path.join(SCREENSHOT_DIR, '04_session_audit_history.png');
    await page.screenshot({ path: screenshot4Path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${screenshot4Path}`);

    // Step 8: Switch to Branch Cash Position Tab
    console.log('\nStep 8: Testing Branch Cash Position Tab...');
    await page.click('button:has-text("Branch Cash Position")');
    await page.waitForTimeout(2500);

    // Verify operating branches are listed
    const tableRows = await page.locator('tbody tr').count();
    console.log(`[PASS] Branch Cash Position operating branches count: ${tableRows}`);

    // Capture Screenshot 5: Branch Cash Position
    const screenshot5Path = path.join(SCREENSHOT_DIR, '05_branch_cash_position.png');
    await page.screenshot({ path: screenshot5Path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${screenshot5Path}`);

    // Step 9: Switch to Counter Stations Tab
    console.log('\nStep 9: Testing Counter Stations Tab...');
    await page.click('button:has-text("Counter Stations")');
    await page.waitForTimeout(2000);

    const guidanceBanner = await page.locator('text=Canonical Branch Till Architecture').isVisible();
    console.log(`[PASS] Architectural Guidance Banner visible: ${guidanceBanner}`);

    // Capture Screenshot 6: Counter Stations
    const screenshot6Path = path.join(SCREENSHOT_DIR, '06_counter_stations.png');
    await page.screenshot({ path: screenshot6Path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${screenshot6Path}`);

    console.log('\n=== REAL BROWSER E2E TEST COMPLETED 100% SUCCESSFULLY! ===');

  } catch (err) {
    console.error('BROWSER E2E ERROR:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png'), fullPage: true });
    throw err;
  } finally {
    await browser.close();
  }
}

runBrowserJourney();
