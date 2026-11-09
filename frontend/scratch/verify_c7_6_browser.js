/**
 * CakeToHome ERP — Phase C7.6 Step 4E Real Chromium Browser Verification via Playwright
 *
 * Verifies live browser rendering, DOM structure, Cost Allocation panel,
 * KPI summary metrics (Active Rules, Awaiting Checker, Posted to GL, Reversed Runs),
 * Subtabs (Allocation Rules, Dry-Run Preview, Runs & Workflow),
 * "Create Rule" modal with fixed-percentage 100.00% validation,
 * Dry-Run Preview workbench with zero-sum Hamilton-Hare rounding checks,
 * and Execute Run modal with Maker-Checker 4-Eyes SoD warning notice.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

function signAuthToken(payload, secret = 'supersecret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    userId: payload.userId || 'admin_01',
    role: payload.role || 'SUPER_ADMIN',
    email: payload.email || 'admin@caketohome.com',
    iat: now,
    exp: now + 7 * 86400,
    ...payload,
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${sig}`;
}

async function runBrowserVerification() {
  console.log('==================================================================');
  console.log('  PHASE C7.6 STEP 4E REAL CHROMIUM BROWSER VERIFICATION VIA PLAYWRIGHT');
  console.log('==================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  let browser = null;

  try {
    console.log('[Browser] Launching Chromium browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    // Inject super-admin JWT token
    const jwt = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
    await context.addCookies([
      { name: '_cth_jwt', value: jwt, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('Download the React DevTools') && !text.includes('Fast Refresh')) {
        console.log(`[Browser Console] ${msg.type()}: ${text}`);
      }
    });
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    const appUrl = 'http://localhost:3000/dashboard?tab=cost_allocations';
    console.log(`[Browser] Navigating to ${appUrl}...`);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(5000);

    // ── 1. Verify Top Header & Module Identity ──
    console.log('\n[Flow 1] Verifying Cost Allocation Header & Module Identity...');
    const content = await page.content();
    assert(content.includes('Cost Allocation Governance'), 'Header: "Cost Allocation Governance" rendered');
    assert(content.includes('Phase C7.6'), 'Subtitle: Phase C7.6 identifier rendered');
    assert(content.includes('Hamilton-Hare'), 'Deterministic rounding description rendered');

    // ── 2. Verify KPI Summary Cards ──
    console.log('\n[Flow 2] Verifying Summary KPI Cards...');
    assert(content.includes('Active Rules'), 'KPI Card 1: Active Rules rendered');
    assert(content.includes('Awaiting Checker'), 'KPI Card 2: Awaiting Checker (4-Eyes) rendered');
    assert(content.includes('Posted to GL'), 'KPI Card 3: Posted to GL rendered');
    assert(content.includes('Reversed Runs'), 'KPI Card 4: Reversed Runs rendered');

    // ── 3. Verify Sub-Tab Navigation Bar ──
    console.log('\n[Flow 3] Verifying Sub-Tab Navigation Bar...');
    const rulesTabBtn = page.locator('button:has-text("Allocation Rules")');
    const previewTabBtn = page.locator('button:has-text("Dry-Run Preview")');
    const runsTabBtn = page.locator('button:has-text("Runs & Workflow")');

    assert(await rulesTabBtn.isVisible(), 'Tab: "Allocation Rules" button is visible');
    assert(await previewTabBtn.isVisible(), 'Tab: "Dry-Run Preview" button is visible');
    assert(await runsTabBtn.isVisible(), 'Tab: "Runs & Workflow" button is visible');

    // Screenshot 1: Overview Dashboard
    const shot1Path = path.join(__dirname, 'c7_6_step4e_overview.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot1Path}`);
    assert(fs.existsSync(shot1Path), 'Screenshot 1 captured: c7_6_step4e_overview.png');

    // ── 4. Verify Create Rule Modal ──
    console.log('\n[Flow 4] Verifying Create Allocation Rule Modal...');
    const createRuleBtn = page.locator('button:has-text("Create Rule")').first();
    assert(await createRuleBtn.isVisible(), '"Create Rule" header button is visible');
    await createRuleBtn.click();
    await page.waitForTimeout(1000);

    const createRuleModal = page.locator('text=Create Fixed-Percentage Allocation Rule');
    assert(await createRuleModal.isVisible(), 'Create Rule Modal opened with correct title');
    assert(await page.locator('text=Rule Code *').isVisible(), 'Field: Rule Code present');
    assert(await page.locator('text=Source Cost Centre *').isVisible(), 'Field: Source Cost Centre present');
    assert(await page.locator('text=Target Distribution').isVisible(), 'Target Distribution section present');

    // Screenshot 2: Create Rule Modal
    const shot2Path = path.join(__dirname, 'c7_6_step4e_create_rule_modal.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot2Path}`);
    assert(fs.existsSync(shot2Path), 'Screenshot 2 captured: c7_6_step4e_create_rule_modal.png');

    // Close Modal
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    await cancelBtn.click();
    await page.waitForTimeout(1000);
    assert(!(await createRuleModal.isVisible()), 'Create Rule Modal closed successfully');

    // ── 5. Verify Dry-Run Preview Tab ──
    console.log('\n[Flow 5] Testing Dry-Run Preview Workbench...');
    await previewTabBtn.click();
    await page.waitForTimeout(1500);

    const calcHeader = page.locator('text=Dry-Run Preview Calculator');
    assert(await calcHeader.isVisible(), 'Preview Workbench: Calculator header rendered');
    assert(await page.locator('text=0 Database Mutations').isVisible(), 'Safe dry-run guarantee badge rendered');
    assert(await page.locator('text=Allocation Rule *').isVisible(), 'Preview: Rule selector field present');
    assert(await page.locator('text=Allocation Date *').isVisible(), 'Preview: Date selector field present');

    // Screenshot 3: Dry-Run Preview Tab
    const shot3Path = path.join(__dirname, 'c7_6_step4e_preview_tab.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot3Path}`);
    assert(fs.existsSync(shot3Path), 'Screenshot 3 captured: c7_6_step4e_preview_tab.png');

    // ── 6. Verify Runs & Workflow Tab ──
    console.log('\n[Flow 6] Testing Runs & Maker-Checker Workflow Tab...');
    await runsTabBtn.click();
    await page.waitForTimeout(1500);

    assert(await page.locator('text=Filter Status:').isVisible(), 'Runs Tab: Status filter dropdown present');

    // Open Execute Run Modal
    const execRunBtn = page.locator('button:has-text("Execute Run")').first();
    assert(await execRunBtn.isVisible(), '"Execute Run" button is visible');
    await execRunBtn.click();
    await page.waitForTimeout(1000);

    const execModal = page.locator('text=Execute Cost Allocation Run');
    assert(await execModal.isVisible(), 'Execute Run Modal opened');
    assert(await page.locator('text=Maker-Checker Notice').isVisible(), '4-Eyes SoD Maker-Checker notice displayed');
    assert(await page.locator('text=Active Allocation Rule *').isVisible(), 'Field: Active Rule selector present');

    // Screenshot 4: Execute Run Modal
    const shot4Path = path.join(__dirname, 'c7_6_step4e_execute_run_modal.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot4Path}`);
    assert(fs.existsSync(shot4Path), 'Screenshot 4 captured: c7_6_step4e_execute_run_modal.png');

    // Close Execute Modal
    const cancelExecBtn = page.locator('button:has-text("Cancel")').first();
    await cancelExecBtn.click();
    await page.waitForTimeout(1000);
    assert(!(await execModal.isVisible()), 'Execute Run Modal closed successfully');

  } catch (err) {
    console.error(`[Browser Error] Unexpected error during verification: ${err.message}`);
    failed++;
  } finally {
    if (browser) {
      await browser.close();
      console.log('[Browser] Chromium browser closed.');
    }
  }

  console.log('\n==================================================================');
  console.log(`  BROWSER VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBrowserVerification();
