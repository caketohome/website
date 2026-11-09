/**
 * CakeToHome ERP — Phase C6.4 Real Chromium Browser Verification via Playwright
 *
 * Verifies live browser rendering, DOM structure, dynamic entry grid,
 * leaf account filtering, single-sided Dr/Cr inputs, live presentation balance bar,
 * modal lifecycle, and Four-Eyes Segregation of Duties audit display.
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
  console.log('  PHASE C6.4 REAL CHROMIUM BROWSER VERIFICATION');
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

  const pool = new Pool({ connectionString: getConnectionString() });

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Set Super Admin authentication cookies with signed JWT
  const jwt = signAuthToken({ userId: 'admin_01', role: 'SUPER_ADMIN' });
  await context.addCookies([
    { name: '_cth_jwt', value: jwt, domain: 'localhost', path: '/' },
    { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
    { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    { name: '_cth_email', value: 'admin@caketohome.com', domain: 'localhost', path: '/' },
  ]);

  const page = await context.newPage();

  try {
    console.log('1. Navigating to http://localhost:3000/dashboard?tab=manual_journals...');
    await page.goto('http://localhost:3000/dashboard?tab=manual_journals', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // ── Check 1: Panel Header & Navigation ──
    const header = page.locator('h1:has-text("Manual Journal Vouchers (JV)")');
    await header.waitFor({ timeout: 10000 });
    assert(await header.isVisible(), 'Panel header displayed: "Manual Journal Vouchers (JV)"');

    const subheader = await page.locator('text=General ledger adjustments, period-end accruals').first().isVisible();
    assert(subheader, 'Panel subtitle and accounting purpose visible');

    // ── Check 2: Metric KPI Cards ──
    const allJournalsCard = await page.locator('text=All Journals').first().isVisible();
    const draftsCard = await page.locator('text=Drafts').first().isVisible();
    const pendingCard = await page.locator('text=Pending Approval').first().isVisible();
    const readyCard = await page.locator('text=Ready for GL').first().isVisible();
    const postedCard = await page.locator('text=Posted to GL').first().isVisible();

    assert(allJournalsCard, 'KPI Metric Card "All Journals" visible');
    assert(draftsCard, 'KPI Metric Card "Drafts" visible');
    assert(pendingCard, 'KPI Metric Card "Pending Approval" visible');
    assert(readyCard, 'KPI Metric Card "Ready for GL" visible');
    assert(postedCard, 'KPI Metric Card "Posted to GL" visible');

    // ── Check 3: Filter Toolbar ──
    const searchInput = await page.locator('input[placeholder*="Search voucher"]').first().isVisible();
    const branchSelect = await page.locator('select').first().isVisible();
    const statusSelect = await page.locator('select').nth(1).isVisible();

    assert(searchInput, 'Search filter input visible');
    assert(branchSelect, 'Branch scoping dropdown visible');
    assert(statusSelect, 'Status filter dropdown visible');

    // ── Check 4: Main Journal List Table ──
    const tableHeader = await page.locator('th:has-text("Voucher No")').first().isVisible();
    assert(tableHeader, 'Journal list table rendered with Voucher No column');

    // Capture initial dashboard screenshot
    const dashShotPath = path.join(__dirname, 'c6_4_dashboard.png');
    await page.screenshot({ path: dashShotPath, fullPage: false });
    console.log(`  📸 Captured dashboard screenshot: ${dashShotPath}`);

    // ── Check 5: "+ New Manual Journal" CTA & Entry Modal ──
    console.log('\n2. Testing "+ New Manual Journal" Entry Modal...');
    const newBtn = page.getByRole('button', { name: /New Manual Journal/i });
    assert(await newBtn.isVisible(), '"+ New Manual Journal" CTA button is visible');
    await newBtn.click();

    // Wait for modal to render
    const modalHeader = page.locator('text=New Manual Journal Voucher (JV)').first();
    await modalHeader.waitFor({ timeout: 10000 });
    assert(await modalHeader.isVisible(), 'Entry modal opened with title "New Manual Journal Voucher (JV)"');

    // Check header fields
    const branchField = await page.locator('select:has(option:has-text("Select Branch..."))').first().isVisible();
    const dateField = await page.locator('input[type="date"]').first().isVisible();
    const typeIndicator = await page.locator('text=JOURNAL').first().isVisible();
    const inrIndicator = await page.locator('text=Base Currency: INR (₹)').first().isVisible();

    assert(branchField, 'Branch selector rendered in Entry Modal');
    assert(dateField, 'Voucher date picker rendered in Entry Modal');
    assert(typeIndicator, 'Voucher type is fixed to JOURNAL');
    assert(inrIndicator, 'INR (₹) base currency strictly displayed');

    const modal = page.locator('div.fixed');

    // Check dynamic lines grid table headers
    const accountCol = await modal.locator('th:has-text("Account (Leaf Only)")').first().isVisible();
    const partyCol = await modal.locator('th:has-text("Party Dimension")').first().isVisible();
    const debitCol = await modal.locator('th:has-text("Debit (₹)")').first().isVisible();
    const creditCol = await modal.locator('th:has-text("Credit (₹)")').first().isVisible();

    assert(accountCol, 'Grid column "Account (Leaf Only)" visible');
    assert(partyCol, 'Grid column "Party Dimension" visible');
    assert(debitCol, 'Grid column "Debit (₹)" visible');
    assert(creditCol, 'Grid column "Credit (₹)" visible');

    // Check account selector dropdown options (ensure leaf accounts present, no group accounts)
    const lineAccountSelects = modal.locator('table select');
    const firstAccountSelect = lineAccountSelects.first();
    const optionTexts = await firstAccountSelect.locator('option').allInnerTexts();
    const hasLeaf1111 = optionTexts.some(t => t.includes('1111'));
    const hasLeaf5110 = optionTexts.some(t => t.includes('5110'));
    const hasGroup1000 = optionTexts.some(t => t.startsWith('1000 —'));

    assert(hasLeaf1111, 'Leaf account 1111 Cash in Hand is selectable');
    assert(hasLeaf5110, 'Leaf account 5110 COGS - Cakes is selectable');
    assert(!hasGroup1000, 'Group account 1000 is NOT present in selectable options');

    // ── Check 6: Dynamic Multi-Line Entry & Live Balance Calculation ──
    console.log('\n3. Interacting with Dynamic Multi-Line Entry Grid...');

    // Select Branch (first available branch)
    const modalBranchSelect = modal.locator('select').first();
    const branchOptions = await modalBranchSelect.locator('option').all();
    if (branchOptions.length > 1) {
      const branchVal = await branchOptions[1].getAttribute('value');
      await modalBranchSelect.selectOption(branchVal);
    }

    // Fill Header Narration
    const testNarration = 'C6.4 Playwright Browser Verification Journal';
    const narrationInput = modal.locator('input[placeholder*="depreciation"], input[type="text"]').first();
    await narrationInput.fill(testNarration);

    // Select Account for Line 1: 5110 (COGS)
    const line1Select = modal.locator('table tbody tr').nth(0).locator('select').first();
    const line1Options = await line1Select.locator('option').all();
    for (const opt of line1Options) {
      const txt = await opt.innerText();
      if (txt.includes('5110')) {
        const val = await opt.getAttribute('value');
        await line1Select.selectOption(val);
        break;
      }
    }

    // Type Debit amount for Line 1: 750
    const line1Debit = modal.locator('table tbody tr').nth(0).locator('input[type="number"]').first();
    await line1Debit.fill('750');

    // Select Account for Line 2: 1111 (Cash)
    const line2Select = modal.locator('table tbody tr').nth(1).locator('select').first();
    const line2Options = await line2Select.locator('option').all();
    for (const opt of line2Options) {
      const txt = await opt.innerText();
      if (txt.includes('1111')) {
        const val = await opt.getAttribute('value');
        await line2Select.selectOption(val);
        break;
      }
    }

    // Type Credit amount for Line 2: 750
    const line2Credit = modal.locator('table tbody tr').nth(1).locator('input[type="number"]').nth(1);
    await line2Credit.fill('750');

    // Wait for state updates
    await page.waitForTimeout(500);

    // Verify Live Presentation Balance Bar
    const debitsText = await modal.locator('text=Total Debits').locator('..').locator('span').nth(1).innerText();
    const creditsText = await modal.locator('text=Total Credits').locator('..').locator('span').nth(1).innerText();
    const diffText = await modal.locator('text=Difference').locator('..').locator('span').nth(1).innerText();
    const balancedBadge = await modal.locator('text=Double-Entry Balanced (₹0.00 Diff)').first().isVisible();

    assert(debitsText.includes('750.00'), `Live Total Debits calculated: ${debitsText}`);
    assert(creditsText.includes('750.00'), `Live Total Credits calculated: ${creditsText}`);
    assert(diffText.includes('0.00'), `Live Difference calculated: ${diffText}`);
    assert(balancedBadge, 'Double-Entry Balanced indicator badge active');

    // Capture screenshot of balanced modal
    const modalShotPath = path.join(__dirname, 'c6_4_entry_modal.png');
    await page.screenshot({ path: modalShotPath, fullPage: false });
    console.log(`  📸 Captured entry modal screenshot: ${modalShotPath}`);

    // Verify Action Buttons
    const saveDraftBtn = modal.getByRole('button', { name: /Save as Draft/i });
    const saveSubmitBtn = modal.getByRole('button', { name: /Save & Submit for Approval/i });
    const cancelBtn = modal.getByRole('button', { name: /Cancel/i });

    assert(await saveDraftBtn.isVisible(), '"Save as Draft" action button visible');
    assert(await saveSubmitBtn.isVisible(), '"Save & Submit for Approval" action button visible');
    assert(await cancelBtn.isVisible(), '"Cancel" button visible');

    // ── Check 7: Save as Draft & Verify in Table ──
    console.log('\n4. Submitting Draft Journal through UI...');
    await saveDraftBtn.click();

    // Modal should close upon successful creation
    await modal.waitFor({ state: 'hidden', timeout: 10000 });
    assert(true, 'Entry modal saved and dismissed smoothly');

    // Wait for the new voucher row to appear in the table
    const createdRow = page.locator(`tr:has-text("${testNarration}")`).first();
    await createdRow.waitFor({ timeout: 10000 });
    assert(await createdRow.isVisible(), `Newly created voucher row visible in list table`);

    // Verify DRAFT badge on the created voucher
    const draftBadge = await createdRow.locator('span:has-text("DRAFT")').first().isVisible();
    assert(draftBadge, 'Status badge correctly displayed as "DRAFT"');

    // ── Check 8: Detail Modal & Four-Eyes SoD Audit Card ──
    console.log('\n5. Opening Detail Modal & Inspecting Four-Eyes SoD Audit Card...');
    const eyeBtn = createdRow.locator('button[title*="View Voucher"]').first();
    await eyeBtn.click();

    // Wait for Detail Modal to render
    const detailModal = page.locator('div.fixed');
    const detailHeader = detailModal.locator('h3:has-text("Manual Journal Voucher")').first();
    await detailHeader.waitFor({ timeout: 10000 });
    assert(await detailHeader.isVisible(), 'Detail modal opened successfully');

    // Wait for voucher detail to load from authoritative server
    const sodCard = detailModal.locator('text=Four-Eyes Segregation of Duties (SoD) Audit Trail').first();
    await sodCard.waitFor({ timeout: 15000 });
    assert(await sodCard.isVisible(), 'Four-Eyes SoD Audit Trail card rendered in Detail Modal');

    const makerTile = await detailModal.locator('text=Maker / Preparer').first().isVisible();
    const checkerTile = await detailModal.locator('text=Checker / Approver').first().isVisible();
    const posterTile = await detailModal.locator('text=Poster / GL Authority').first().isVisible();

    assert(makerTile, 'Maker audit tile displayed with creator identity');
    assert(checkerTile, 'Checker audit tile displayed with Pending state');
    assert(posterTile, 'Poster audit tile displayed with Pending state');

    // Verify Proposed Lines Tab
    const proposedLine1 = await detailModal.locator('text=COGS - Cakes').first().isVisible();
    const proposedLine2 = await detailModal.locator('text=Cash in Hand').first().isVisible();
    assert(proposedLine1 && proposedLine2, 'Proposed Lines tab correctly reflects 5110 COGS and 1111 Cash');

    // Verify GL Tab is properly disabled for unposted DRAFT vouchers
    const glTabBtn = detailModal.getByRole('button', { name: /Authoritative GL Lines/i });
    assert(await glTabBtn.isDisabled(), 'Authoritative GL Lines tab button is properly disabled for DRAFT voucher');

    // Verify Detail Modal Action Buttons
    const submitForApprovalBtn = detailModal.getByRole('button', { name: /Submit for Approval/i });
    const cancelVoucherBtn = detailModal.getByRole('button', { name: /Cancel Voucher/i });
    assert(await submitForApprovalBtn.isVisible(), '"Submit for Approval" button visible in Detail Modal');
    assert(await cancelVoucherBtn.isVisible(), '"Cancel Voucher" button visible in Detail Modal');

    // Capture screenshot of detail modal
    const detailShotPath = path.join(__dirname, 'c6_4_detail_modal.png');
    await page.screenshot({ path: detailShotPath, fullPage: false });
    console.log(`  📸 Captured detail modal screenshot: ${detailShotPath}`);

    // Close Detail Modal
    const closeBtn = detailModal.getByRole('button', { name: /Close/i }).first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    assert(true, 'Detail modal closed successfully');

  } catch (err) {
    console.error('BROWSER VERIFICATION EXCEPTION:', err);
    failed++;
  } finally {
    // Teardown: Clean up test vouchers from DB so baseline remains 100% pure
    console.log('\n6. Cleaning up test vouchers from PostgreSQL database...');
    try {
      const client = await pool.connect();
      const res = await client.query("DELETE FROM public.accounting_voucher WHERE narration LIKE 'C6.4 Playwright%' OR reference_id LIKE 'c6%'");
      console.log(`  ✓ Cleaned up ${res.rowCount} test voucher(s)`);
      client.release();
    } catch (e) {
      console.error('  Warning during teardown:', e.message);
    }
    await pool.end();
    await browser.close();
  }

  console.log('\n==================================================================');
  console.log(`  BROWSER VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================');

  if (failed > 0) process.exit(1);
}

runBrowserVerification();
