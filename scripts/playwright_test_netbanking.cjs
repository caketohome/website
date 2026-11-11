const path = require('path');
const fs = require('fs');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const PG_CONFIG = {
  connectionString: 'postgresql://cth_test_user:8b58f6cb35e64015459917243b77e2794c57K9!@127.0.0.1:5433/cth_rehearsal_phase5'
};

const RAZORPAY_KEY_ID = 'rzp_test_TxymYPGydaHJBL';
const RAZORPAY_KEY_SECRET = 'sekOj7zSZFkBoRB2op7tgQBE';
const BASE_URL = 'http://127.0.0.1:3000';
const ARTIFACT_DIR = path.resolve(__dirname, '../artifacts/phase-9-browser-verification');

async function run() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const client = new Client(PG_CONFIG);
  await client.connect();
  console.log('[DB] Connected to PostgreSQL on 5433');

  // 1. Get sample valid branch, customer, product to create clean test order
  const branchRes = await client.query(`SELECT id, name FROM public.branch LIMIT 1`);
  const branch = branchRes.rows[0];

  const custRes = await client.query(`SELECT id, email, first_name, last_name, phone FROM public.customer LIMIT 1`);
  const customer = custRes.rows[0];

  const prodRes = await client.query(`SELECT id, title FROM public.product WHERE deleted_at IS NULL LIMIT 1`);
  const product = prodRes.rows[0];

  console.log('[DB] Reference data loaded:', {
    branch_id: branch.id,
    customer_id: customer.id,
    product_id: product.id
  });

  const now = Date.now();
  const orderId = `ord_live_nb_${now}`;
  const displayId = Math.floor(now / 1000) % 1000000;
  const taxableValue = 750.00;
  const gstRate = 5.00;
  const taxAmount = 37.50;
  const grandTotal = 787.50; // exactly 787.50 INR = 78750 paise

  console.log(`[DB] Creating pending test order: ${orderId} (display_id: ${displayId}, total: ₹${grandTotal})...`);

  // Insert order
  await client.query(`
    INSERT INTO public."order" (
      id, display_id, order_number, customer_id, branch_id, status, payment_status,
      currency_code, payment_method, subtotal, tax_total, grand_total,
      customer_name, customer_phone, email, metadata, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, 'pending', 'pending',
      'INR', 'razorpay', $6, $7, $8,
      $9, $10, $11, $12, NOW(), NOW()
    )
  `, [
    orderId,
    displayId,
    `ORD-${displayId}`,
    customer.id,
    branch.id,
    taxableValue,
    taxAmount,
    grandTotal,
    `${customer.first_name || 'Anita'} ${customer.last_name || 'Sharma'}`,
    customer.phone || '9847012345',
    customer.email || 'customer@cakestohome.com',
    JSON.stringify({ note: "Playwright genuine netbanking test order" })
  ]);

  // Insert order_item
  await client.query(`
    INSERT INTO public.order_item (
      id, order_id, product_id, title, quantity, unit_price,
      taxable_value, gst_rate_pct, tax_amount, total, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 1, $5,
      $6, $7, $8, $9, NOW(), NOW()
    )
  `, [
    `item_${orderId}`,
    orderId,
    product.id,
    product.title,
    grandTotal,
    taxableValue,
    gstRate,
    taxAmount,
    grandTotal
  ]);

  console.log('[DB] Order and order item inserted successfully with status: pending');

  // Launch Playwright Chromium
  console.log('[Playwright] Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Track any popups (Razorpay test bank simulator often opens in a popup)
  let popupPage = null;
  context.on('page', p => {
    console.log('[Playwright Context] New page/popup detected:', p.url());
    popupPage = p;
  });

  try {
    const checkoutUrl = `${BASE_URL}/checkout/razorpay?order_id=${encodeURIComponent(orderId)}&amount=${grandTotal}`;
    console.log(`[Playwright] Navigating to: ${checkoutUrl}`);
    await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(3000);
    const checkoutReadyShot = path.join(ARTIFACT_DIR, '02-razorpay-checkout-portal-ready.png');
    await page.screenshot({ path: checkoutReadyShot, fullPage: true });
    console.log('[Playwright] Saved screenshot:', checkoutReadyShot);

    // Wait for the Razorpay iframe
    console.log('[Playwright] Waiting for Razorpay checkout iframe...');
    const iframeElement = await page.waitForSelector('iframe.razorpay-checkout-frame', { timeout: 45000 });
    const frame = await iframeElement.contentFrame();
    if (!frame) throw new Error('Could not access Razorpay iframe content frame');

    console.log('[Playwright] Razorpay iframe loaded successfully.');
    await page.waitForTimeout(2000);
    const modalShot = path.join(ARTIFACT_DIR, '03-razorpay-modal-loaded.png');
    await page.screenshot({ path: modalShot, fullPage: true });
    console.log('[Playwright] Saved screenshot:', modalShot);

    // Step A: Check for contact drawer overlay
    console.log('[Playwright] Inspecting inputs and buttons in iframe...');
    const allInputs = await frame.locator('input').all();
    for (let i = 0; i < allInputs.length; i++) {
      const inp = allInputs[i];
      const name = await inp.getAttribute('name');
      const type = await inp.getAttribute('type');
      const testid = await inp.getAttribute('data-testid');
      const isVis = await inp.isVisible();
      console.log(`[Input #${i}] name="${name}" type="${type}" testid="${testid}" visible=${isVis}`);
    }

    const allButtons = await frame.locator('button').all();
    for (let i = 0; i < allButtons.length; i++) {
      const btn = allButtons[i];
      const text = (await btn.innerText()).trim();
      const testid = await btn.getAttribute('data-testid') || await btn.getAttribute('data-test-id');
      const isVis = await btn.isVisible();
      console.log(`[Button #${i}] text="${text}" testid="${testid}" visible=${isVis}`);
    }

    // Step A: Fill all contact inputs and email inputs
    console.log('[Playwright] Filling all contact & email inputs...');
    const allContactInputs = await frame.locator('input[data-testid="contactNumber"], input[name="contact"], input[type="tel"]').all();
    for (let i = 0; i < allContactInputs.length; i++) {
      try {
        if (await allContactInputs[i].isVisible()) {
          console.log(`[Playwright] Filling contact input #${i}...`);
          await allContactInputs[i].fill('9847012345');
        }
      } catch (e) {}
    }

    const allEmailInputs = await frame.locator('input[data-testid="email"], input[name="email"]').all();
    for (let i = 0; i < allEmailInputs.length; i++) {
      try {
        if (await allEmailInputs[i].isVisible()) {
          console.log(`[Playwright] Filling email input #${i}...`);
          await allEmailInputs[i].fill('customer@cakestohome.com');
        }
      } catch (e) {}
    }

    // Click the Contact drawer Continue button
    const drawerContinueBtn = frame.locator('button').filter({ hasText: /Continue/i });
    const btnCount = await drawerContinueBtn.count();
    console.log(`[Playwright] Total Continue buttons: ${btnCount}`);
    for (let i = btnCount - 1; i >= 0; i--) {
      try {
        const btn = drawerContinueBtn.nth(i);
        const testid = await btn.getAttribute('data-test-id') || await btn.getAttribute('data-testid');
        if (testid !== 'add-card-cta') {
          console.log(`[Playwright] Clicking drawer continue button #${i}...`);
          await btn.click({ force: true });
          break;
        }
      } catch (e) {}
    }

    await page.waitForTimeout(2000);
    const afterContactShot = path.join(ARTIFACT_DIR, '03b-after-contact-submit.png');
    await page.screenshot({ path: afterContactShot, fullPage: true });
    console.log('[Playwright] Saved screenshot:', afterContactShot);

    // Step B: Select Netbanking payment option
    console.log('[Playwright] Selecting Netbanking payment option...');
    const nbOption = frame.locator('[data-testid="netbanking"], div[data-value="netbanking"]');
    if (await nbOption.count() > 0) {
      console.log('[Playwright] Clicking Netbanking option directly with force: true...');
      await nbOption.first().click({ force: true });
    } else {
      const radios = await frame.locator('input[type="radio"]').all();
      if (radios.length > 1) {
        await radios[1].click({ force: true });
      }
    }
    await page.waitForTimeout(2000);

    const nbScreenShot = path.join(ARTIFACT_DIR, '04-razorpay-netbanking-selection.png');
    await page.screenshot({ path: nbScreenShot, fullPage: true });
    console.log('[Playwright] Saved screenshot:', nbScreenShot);

    const nbText = await frame.locator('body').innerText();
    console.log('[Playwright] Frame text on Netbanking view:\n', nbText.substring(0, 700));

    // Step C: Select a bank from Suggested Banks or Bank List
    console.log('[Playwright] Selecting test bank...');
    const bankCandidates = [
      frame.locator('text="Canara Bank"'),
      frame.locator('text="IDBI"'),
      frame.locator('text="Bank of Baroda"'),
      frame.locator('text="State Bank of India"'),
      frame.locator('text="HDFC Bank"'),
      frame.locator('text="ICICI Bank"'),
      frame.locator('div[data-testid="suggested-bank-item"]'),
      frame.locator('.bank-item')
    ];

    let bankClicked = false;
    for (const candidate of bankCandidates) {
      if (await candidate.count() > 0 && await candidate.first().isVisible()) {
        console.log('[Playwright] Found bank selector. Clicking with force: true...');
        await candidate.first().click({ force: true });
        bankClicked = true;
        break;
      }
    }

    if (!bankClicked) {
      console.log('[Playwright] Trying first available clickable bank card in frame...');
      const firstBank = frame.locator('label, div[role="button"], button').filter({ hasText: /Canara|IDBI|Baroda|SBI|HDFC|ICICI/i }).first();
      if (await firstBank.count() > 0) {
        await firstBank.click({ force: true });
        bankClicked = true;
      }
    }

    await page.waitForTimeout(1500);

    // Step D: Click Pay CTA button
    console.log('[Playwright] Looking for Pay CTA button...');
    const payBtn = frame.locator('button').filter({ hasText: /Pay ₹|Pay/i });
    if (await payBtn.count() > 0 && await payBtn.first().isVisible()) {
      console.log('[Playwright] Clicking Pay CTA button with force: true...');
      await payBtn.first().click({ force: true });
    } else {
      console.log('[Playwright] Pay button not found separately, bank click may have initiated redirect.');
    }

    // Step E: Wait for Bank Simulator (either in popupPage or main frame or redirection)
    console.log('[Playwright] Waiting for Razorpay Bank Simulator...');
    let simulatorPage = null;

    // Check for popup or navigation for up to 20 seconds
    for (let i = 0; i < 40; i++) {
      if (popupPage) {
        simulatorPage = popupPage;
        console.log('[Playwright] Found bank simulator in popup page:', simulatorPage.url());
        break;
      }

      // Check if page navigated or frame navigated to mock bank
      const currentUrl = page.url();
      if (currentUrl.includes('mock') || currentUrl.includes('payments')) {
        simulatorPage = page;
        console.log('[Playwright] Found bank simulator in main page:', currentUrl);
        break;
      }

      await page.waitForTimeout(500);
    }

    if (!simulatorPage && popupPage) {
      simulatorPage = popupPage;
    }

    // Prepare to intercept verify API call on the main page
    const verifyResponsePromise = page.waitForResponse(res => res.url().includes('/api/v1/payments/razorpay/verify'), { timeout: 45000 });

    if (simulatorPage) {
      await simulatorPage.waitForLoadState('domcontentloaded');
      console.log('[Playwright] Simulator page loaded:', simulatorPage.url());
      const simShot = path.join(ARTIFACT_DIR, '05-razorpay-bank-simulator.png');
      await simulatorPage.screenshot({ path: simShot });
      console.log('[Playwright] Saved screenshot:', simShot);

      // In the mock bank simulator, there is a "Success" button
      console.log('[Playwright] Clicking "Success" button in test bank simulator...');
      const successBtn = simulatorPage.locator('button:has-text("Success"), input[value="Success"], a:has-text("Success")');
      await successBtn.first().waitFor({ state: 'visible', timeout: 15000 });
      await successBtn.first().click();
      console.log('[Playwright] Clicked Success button in simulator. Waiting for simulator popup to finish/close...');

      try {
        await simulatorPage.waitForEvent('close', { timeout: 15000 });
        console.log('[Playwright] Simulator popup closed automatically.');
      } catch (closeErr) {
        console.log('[Playwright] Simulator page did not close automatically; current simulator url:', simulatorPage.url());
      }
    } else {
      console.log('[Playwright] Checking inside frame for mock bank success button...');
      const frameSuccess = frame.locator('button:has-text("Success"), input[value="Success"]');
      if (await frameSuccess.count() > 0 && await frameSuccess.first().isVisible()) {
        console.log('[Playwright] Clicking Success button in iframe...');
        await frameSuccess.first().click();
      } else {
        console.warn('[Playwright] Could not detect mock bank simulator page/button directly.');
      }
    }

    // Step F: Wait for backend payment verification
    console.log('[Playwright] Waiting for /api/v1/payments/razorpay/verify response...');
    try {
      const verifyRes = await verifyResponsePromise;
      const verifyJson = await verifyRes.json();
      console.log('[Playwright] /api/v1/payments/razorpay/verify HTTP Status:', verifyRes.status());
      console.log('[Playwright] /api/v1/payments/razorpay/verify Body:', verifyJson);
    } catch (verifyWaitErr) {
      console.warn('[Playwright] Timed out waiting for /api/v1/payments/razorpay/verify response:', verifyWaitErr.message);
    }

    // Step G: Wait for redirect to order confirmation (/your-order)
    console.log('[Playwright] Waiting for redirect to order confirmation (/your-order)...');
    try {
      await page.waitForURL(url => url.pathname.includes('/your-order'), { timeout: 30000 });
      console.log('[Playwright] Successfully redirected to confirmation page:', page.url());
    } catch (waitErr) {
      console.warn('[Playwright] Timed out waiting for /your-order URL change, current URL:', page.url());
    }

    await page.waitForTimeout(3000);
    const successShot = path.join(ARTIFACT_DIR, '06-order-confirmed-success.png');
    await page.screenshot({ path: successShot, fullPage: true });
    console.log('[Playwright] Saved screenshot:', successShot);

  } finally {
    await browser.close();
    console.log('[Playwright] Browser closed.');
  }

  // 4. Verify Database State
  console.log('[DB] Verifying database records for order:', orderId);
  const dbOrderRes = await client.query(`
    SELECT id, display_id, status, payment_status, grand_total, updated_at 
    FROM public."order" 
    WHERE id = $1
  `, [orderId]);

  console.log('[DB] Order state:', dbOrderRes.rows[0]);

  const dbTxRes = await client.query(`
    SELECT id, order_id, provider, gateway_order_id, gateway_payment_id, status, amount, currency, failure_reason, updated_at
    FROM public.payment_transaction
    WHERE order_id = $1
  `, [orderId]);

  console.log('[DB] Payment Transaction records:', dbTxRes.rows);

  // 5. Verify Accounting Vouchers and Lines
  const voucherRes = await client.query(`
    SELECT v.id, v.voucher_number, v.voucher_type, v.narration, v.total_amount
    FROM public.accounting_voucher v
    WHERE v.reference_id = $1 OR v.narration ILIKE $2
  `, [orderId, `%${orderId}%`]);

  console.log('[DB] Accounting Vouchers:', voucherRes.rows);

  if (voucherRes.rows.length > 0) {
    const linesRes = await client.query(`
      SELECT l.id, l.account_code, l.account_name, l.debit_amount, l.credit_amount, l.line_description
      FROM public.accounting_journal_line l
      WHERE l.voucher_id = $1
    `, [voucherRes.rows[0].id]);
    console.log('[DB] Journal Lines:', linesRes.rows);
  }

  // 6. Upstream Razorpay Verification via API
  if (dbTxRes.rows.length > 0 && dbTxRes.rows[0].gateway_payment_id) {
    const razorpayPaymentId = dbTxRes.rows[0].gateway_payment_id;
    console.log('[Razorpay API] Fetching upstream payment details for:', razorpayPaymentId);

    const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
      headers: { 'Authorization': authHeader }
    });
    const payJson = await payRes.json();
    console.log('[Razorpay API] Payment details:', {
      id: payJson.id,
      order_id: payJson.order_id,
      status: payJson.status,
      amount: payJson.amount,
      currency: payJson.currency,
      method: payJson.method,
      bank: payJson.bank,
      captured: payJson.captured
    });

    if (payJson.order_id) {
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${payJson.order_id}`, {
        headers: { 'Authorization': authHeader }
      });
      const orderJson = await orderRes.json();
      console.log('[Razorpay API] Order details:', {
        id: orderJson.id,
        status: orderJson.status,
        amount: orderJson.amount,
        amount_paid: orderJson.amount_paid,
        amount_due: orderJson.amount_due,
        currency: orderJson.currency,
        attempts: orderJson.attempts
      });
    }
  }

  await client.end();
  console.log('[DB] PostgreSQL connection closed. Run complete!');
}

run().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
