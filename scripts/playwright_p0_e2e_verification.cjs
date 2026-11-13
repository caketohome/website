/**
 * CakeToHome — P0 Genuine Browser E2E Verification (Razorpay TEST MODE)
 * 1. Re-captures repaired confirmation page for ord_live_nb_1794401032340 (Desktop & Mobile)
 * 2. Executes a fresh end-to-end order + official Razorpay Test Mode Netbanking Success flow (Desktop & Mobile)
 * 3. Executes a fresh order + official Razorpay Test Mode Netbanking Failure flow and verifies order is NOT confirmed
 */

const path = require("path");
const fs = require("fs");
const { chromium } = require(path.resolve(__dirname, "../frontend/node_modules/playwright"));
const { Client } = require(path.resolve(__dirname, "../frontend/node_modules/pg"));

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://cth_test_user:8b58f6cb35e64015459917243b77e2794c57K9!@127.0.0.1:5433/cth_rehearsal_phase5";
const BASE_URL = "http://127.0.0.1:3000";
const RZP_KEY_ID = "rzp_test_TxymYPGydaHJBL";
const RZP_KEY_SECRET = "sekOj7zSZFkBoRB2op7tgQBE";
const ARTIFACTS_DIR = path.resolve(__dirname, "../artifacts/phase-9-browser-verification");

async function interactWithRazorpayModal(context, page, phone, email, action = "Success") {
  let popupPage = null;
  context.on("page", (p) => {
    console.log("[Playwright Context] New popup page detected:", p.url());
    popupPage = p;
  });

  const iframeElement = await page.waitForSelector("iframe.razorpay-checkout-frame", { timeout: 45000 });
  const frame = await iframeElement.contentFrame();
  if (!frame) throw new Error("Could not access Razorpay iframe contentFrame");

  await page.waitForTimeout(2500);

  // Fill contact & email if contact drawer is shown
  const allContactInputs = await frame
    .locator('input[data-testid="contactNumber"], input[name="contact"], input[type="tel"]')
    .all();
  for (const inp of allContactInputs) {
    try {
      if (await inp.isVisible()) {
        await inp.fill(phone);
      }
    } catch (_) {}
  }

  const allEmailInputs = await frame.locator('input[data-testid="email"], input[name="email"]').all();
  for (const inp of allEmailInputs) {
    try {
      if (await inp.isVisible()) {
        await inp.fill(email);
      }
    } catch (_) {}
  }

  const drawerContinueBtn = frame.locator("button").filter({ hasText: /Continue|Proceed/i });
  const btnCount = await drawerContinueBtn.count();
  for (let i = btnCount - 1; i >= 0; i--) {
    try {
      const btn = drawerContinueBtn.nth(i);
      const testid = (await btn.getAttribute("data-test-id")) || (await btn.getAttribute("data-testid"));
      if (testid !== "add-card-cta" && (await btn.isVisible())) {
        await btn.click({ force: true });
        break;
      }
    } catch (_) {}
  }

  await page.waitForTimeout(2000);

  // Select Netbanking
  const nbOption = frame.locator('[data-testid="netbanking"], div[data-value="netbanking"], button:has-text("Netbanking")');
  if ((await nbOption.count()) > 0) {
    await nbOption.first().click({ force: true });
  } else {
    const radios = await frame.locator('input[type="radio"]').all();
    if (radios.length > 1) {
      await radios[1].click({ force: true });
    }
  }

  await page.waitForTimeout(2000);

  // Select bank
  const bankCandidates = [
    frame.locator('text="Canara Bank"'),
    frame.locator('text="IDBI"'),
    frame.locator('text="Bank of Baroda"'),
    frame.locator('text="State Bank of India"'),
    frame.locator('text="HDFC Bank"'),
    frame.locator('text="ICICI Bank"'),
    frame.locator('div[data-testid="suggested-bank-item"]'),
    frame.locator(".bank-item"),
  ];

  let bankClicked = false;
  for (const candidate of bankCandidates) {
    if ((await candidate.count()) > 0 && (await candidate.first().isVisible())) {
      await candidate.first().click({ force: true });
      bankClicked = true;
      break;
    }
  }

  if (!bankClicked) {
    const firstBank = frame
      .locator('label, div[role="button"], button')
      .filter({ hasText: /Canara|IDBI|Baroda|SBI|HDFC|ICICI/i })
      .first();
    if ((await firstBank.count()) > 0) {
      await firstBank.click({ force: true });
    }
  }

  await page.waitForTimeout(1500);

  const payBtn = frame.locator("button").filter({ hasText: /Pay ₹|Pay Now|Pay/i });
  if ((await payBtn.count()) > 0 && (await payBtn.first().isVisible())) {
    await payBtn.first().click({ force: true });
  }

  // Wait for simulator popup
  let simulatorPage = null;
  for (let i = 0; i < 40; i++) {
    if (popupPage) {
      simulatorPage = popupPage;
      break;
    }
    const currentUrl = page.url();
    if (currentUrl.includes("mock") || currentUrl.includes("payments")) {
      simulatorPage = page;
      break;
    }
    await page.waitForTimeout(500);
  }

  if (!simulatorPage && popupPage) {
    simulatorPage = popupPage;
  }

  if (!simulatorPage) {
    throw new Error("Could not detect Razorpay Test Mode Bank Simulator popup.");
  }

  await simulatorPage.waitForLoadState("domcontentloaded");
  await simulatorPage.waitForTimeout(1000);
  console.log(`[Playwright] Bank Simulator loaded (${simulatorPage.url()}), clicking "${action}"...`);

  const targetBtn =
    action === "Success"
      ? simulatorPage.locator('button.success, button:has-text("Success"), input[value="Success"], [data-val="S"]')
      : simulatorPage.locator('button.danger, button:has-text("Failure"), input[value="Failure"], [data-val="F"]');

  await targetBtn.first().waitFor({ state: "visible", timeout: 15000 });
  await targetBtn.first().click();

  try {
    await simulatorPage.waitForEvent("close", { timeout: 15000 });
  } catch (_) {}
}

async function main() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const db = new Client({ connectionString: DB_URL });
  await db.connect();

  // Clean up any partial order from interrupted run
  await db.query(`DELETE FROM public.payment_transaction WHERE order_id = 'ord_p0_verified_1794469909355'`).catch(() => {});
  await db.query(`DELETE FROM public.order_item WHERE order_id = 'ord_p0_verified_1794469909355'`).catch(() => {});
  await db.query(`DELETE FROM public."order" WHERE id = 'ord_p0_verified_1794469909355'`).catch(() => {});

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const summary = {
    timestamp: new Date().toISOString(),
    repaired_historical_order: null,
    fresh_paid_order: null,
    failed_payment_order: null,
  };

  try {
    // =========================================================================
    // PART 1: Verify & Screenshot Repaired ord_live_nb_1794401032340 (Desktop & Mobile)
    // =========================================================================
    console.log("\n=== PART 1: Verifying repaired /your-order for ord_live_nb_1794401032340 ===");
    const page1 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page1.goto(`${BASE_URL}/your-order?order_id=ord_live_nb_1794401032340`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page1.waitForTimeout(2000);

    const desktopShot1 = path.join(ARTIFACTS_DIR, "06-order-live-status-confirmed-desktop.png");
    await page1.screenshot({ path: desktopShot1, fullPage: true });

    const page1Text = await page1.locator("body").innerText();
    const subtotalText1 = await page1.getByTestId("order-subtotal").innerText();
    const gstText1 = await page1.getByTestId("order-gst").innerText();
    const grandTotalText1 = await page1.getByTestId("order-grand-total").innerText();
    const orderNumText1 = await page1.getByTestId("order-number").innerText();
    const kotNumText1 = await page1.getByTestId("kot-number").innerText();
    const payIdText1 = await page1.getByTestId("gateway-payment-id").innerText();

    await page1.setViewportSize({ width: 390, height: 844 });
    await page1.waitForTimeout(500);
    const mobileShot1 = path.join(ARTIFACTS_DIR, "06b-order-live-status-confirmed-mobile.png");
    await page1.screenshot({ path: mobileShot1, fullPage: true });
    await page1.close();

    summary.repaired_historical_order = {
      order_id: "ord_live_nb_1794401032340",
      order_number: orderNumText1,
      kot_number: kotNumText1,
      subtotal_displayed: subtotalText1,
      gst_displayed: gstText1,
      grand_total_displayed: grandTotalText1,
      gateway_payment_id_displayed: payIdText1,
      desktop_screenshot: desktopShot1,
      mobile_screenshot: mobileShot1,
      body_excerpt: page1Text.slice(0, 600),
    };
    console.log("Repaired ord_live_nb_1794401032340 UI:", summary.repaired_historical_order);

    // =========================================================================
    // PART 2: Fresh Order + Genuine Razorpay Test Mode Netbanking Success Flow
    // =========================================================================
    console.log("\n=== PART 2: Fresh Order + Genuine Razorpay Test Mode Netbanking Capture ===");
    const prodRes = await db.query(
      `SELECT p.id, p.title, COALESCE((p.metadata->>'selling_price')::numeric, (p.metadata->>'price')::numeric, 750) AS price
       FROM public.product p WHERE p.id = 'prod_01KXYMAJKNWZCFXJHESPTZE01G' LIMIT 1`
    );
    const product = prodRes.rows[0] || {
      id: "prod_01KXYMAJKNWZCFXJHESPTZE01G",
      title: "Classic Chocolate Truffle Cake",
      price: "433",
    };
    const unitPrice = Number(product.price) || 433;
    const qty = 1;
    const subtotal = Math.round(unitPrice * qty * 100) / 100;
    const gstRate = 5;
    const taxTotal = Math.round(subtotal * (gstRate / 100) * 100) / 100;
    const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;
    const expectedPaise = Math.round(grandTotal * 100);

    const freshTs = Date.now();
    const freshOrderId = `ord_p0_verified_${freshTs}`;
    const freshDisplayId = Number(String(freshTs).slice(-6));
    const freshOrderNumber = `CTH-${freshDisplayId}`;

    await db.query(
      `INSERT INTO public."order" (
         id, display_id, order_number, status, payment_status, payment_method,
         customer_id, customer_name, customer_phone, email, branch_id,
         currency_code, subtotal, tax_total, grand_total, metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'pending', 'pending', 'RAZORPAY',
         'cust_kerala_01', 'Meera Nair', '+919847012345', 'meera.nair@example.com', 'br_partner_04',
         'INR', $4, $5, $6, $7::jsonb, NOW(), NOW()
       )`,
      [
        freshOrderId,
        freshDisplayId,
        freshOrderNumber,
        subtotal,
        taxTotal,
        grandTotal,
        JSON.stringify({
          order_number: freshOrderNumber,
          customer_name: "Meera Nair",
          customer_phone: "+919847012345",
          branch_id: "br_partner_04",
          branch_name: "Kochi Panampilly Nagar Flagship Hub",
          delivery_address: "14/220 Panampilly Nagar, Kochi, Kerala 682036",
          delivery_date: new Date().toISOString().split("T")[0],
          delivery_slot_time: "16:00 - 18:00",
          delivery_otp: "648291",
          subtotal,
          tax_amount: taxTotal,
          grand_total: grandTotal,
          total_amount: grandTotal,
          total: grandTotal,
        }),
      ]
    );

    await db.query(
      `INSERT INTO public.order_item (
         id, order_id, product_id, title, quantity, unit_price,
         taxable_value, gst_rate_pct, tax_amount, total,
         version, raw_quantity, fulfilled_quantity, shipped_quantity,
         return_requested_quantity, return_received_quantity,
         return_dismissed_quantity, written_off_quantity, raw_unit_price,
         metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         1, '{"value":"1"}', 0, 0,
         0, 0, 0, 0, $11,
         $12::jsonb, NOW(), NOW()
       )`,
      [
        `oi_${freshOrderId}`,
        freshOrderId,
        product.id,
        product.title,
        qty,
        unitPrice,
        subtotal,
        gstRate,
        taxTotal,
        grandTotal,
        JSON.stringify({ value: String(unitPrice), precision: 20 }),
        JSON.stringify({
          weight: "1 kg",
          cgst: Math.round((taxTotal / 2) * 100) / 100,
          sgst: Math.round((taxTotal / 2) * 100) / 100,
          line_total: subtotal,
          total: grandTotal,
        }),
      ]
    );

    const context2 = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page2 = await context2.newPage();

    const checkoutUrl = `${BASE_URL}/checkout/razorpay?order_id=${freshOrderId}&amount=${grandTotal}`;
    console.log("Opening Razorpay Checkout:", checkoutUrl);
    await page2.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const verifyResponsePromise = page2.waitForResponse(
      (res) => res.url().includes("/api/v1/payments/razorpay/verify"),
      { timeout: 45000 }
    );

    await interactWithRazorpayModal(context2, page2, "9847012345", "meera.nair@example.com", "Success");

    const verifyRes = await verifyResponsePromise;
    console.log("[Playwright] /api/v1/payments/razorpay/verify HTTP Status:", verifyRes.status());

    // Wait for redirect to /your-order?order_id=...
    await page2.waitForURL((u) => u.pathname.includes("/your-order"), { timeout: 30000 });
    await page2.waitForTimeout(2500);

    const freshDesktopShot = path.join(ARTIFACTS_DIR, "07-fresh-order-confirmed-desktop.png");
    await page2.screenshot({ path: freshDesktopShot, fullPage: true });

    const freshSubtotalUi = await page2.getByTestId("order-subtotal").innerText();
    const freshGstUi = await page2.getByTestId("order-gst").innerText();
    const freshGrandTotalUi = await page2.getByTestId("order-grand-total").innerText();
    const freshOrderNumUi = await page2.getByTestId("order-number").innerText();
    const freshKotNumUi = await page2.getByTestId("kot-number").innerText();
    const freshPayIdUi = await page2.getByTestId("gateway-payment-id").innerText();

    await page2.setViewportSize({ width: 390, height: 844 });
    await page2.waitForTimeout(500);
    const freshMobileShot = path.join(ARTIFACTS_DIR, "07b-fresh-order-confirmed-mobile.png");
    await page2.screenshot({ path: freshMobileShot, fullPage: true });
    await context2.close();

    // Verify DB & Upstream Razorpay records for freshOrderId
    const dbFreshOrd = (await db.query(`SELECT * FROM public."order" WHERE id = $1`, [freshOrderId])).rows[0];
    const dbFreshItems = (await db.query(`SELECT * FROM public.order_item WHERE order_id = $1`, [freshOrderId])).rows;
    const dbFreshPtx = (await db.query(`SELECT * FROM public.payment_transaction WHERE order_id = $1`, [freshOrderId])).rows[0];
    const dbFreshVch = (await db.query(`SELECT * FROM public.accounting_voucher WHERE reference_id = $1`, [freshOrderId])).rows[0];
    const dbFreshJe = dbFreshVch
      ? (await db.query(`SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`, [dbFreshVch.id])).rows[0]
      : null;

    const authHeader = "Basic " + Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
    const rzpOrdUpstream = await (
      await fetch(`https://api.razorpay.com/v1/orders/${dbFreshPtx.gateway_order_id}`, {
        headers: { Authorization: authHeader },
      })
    ).json();
    const rzpPayUpstream = await (
      await fetch(`https://api.razorpay.com/v1/payments/${dbFreshPtx.gateway_payment_id}`, {
        headers: { Authorization: authHeader },
      })
    ).json();

    summary.fresh_paid_order = {
      order_id: freshOrderId,
      order_number: freshOrderNumber,
      product_id: product.id,
      product_title: product.title,
      razorpay_order_id: dbFreshPtx.gateway_order_id,
      razorpay_payment_id: dbFreshPtx.gateway_payment_id,
      expected_paise: expectedPaise,
      upstream_order_amount_paise: rzpOrdUpstream.amount,
      upstream_order_amount_paid_paise: rzpOrdUpstream.amount_paid,
      upstream_order_status: rzpOrdUpstream.status,
      upstream_payment_amount_paise: rzpPayUpstream.amount,
      upstream_payment_status: rzpPayUpstream.status,
      upstream_payment_currency: rzpPayUpstream.currency,
      db_order_status: dbFreshOrd.status,
      db_payment_status: dbFreshOrd.payment_status,
      db_subtotal: Number(dbFreshOrd.subtotal),
      db_tax_total: Number(dbFreshOrd.tax_total),
      db_grand_total: Number(dbFreshOrd.grand_total),
      db_items_count: dbFreshItems.length,
      db_ptx_amount: Number(dbFreshPtx.amount),
      db_ptx_status: dbFreshPtx.status,
      db_voucher_no: dbFreshVch?.voucher_no,
      db_voucher_amount: Number(dbFreshVch?.total_amount),
      db_je_debit: Number(dbFreshJe?.total_debit),
      db_je_credit: Number(dbFreshJe?.total_credit),
      ui_order_number: freshOrderNumUi,
      ui_kot_number: freshKotNumUi,
      ui_subtotal: freshSubtotalUi,
      ui_gst: freshGstUi,
      ui_grand_total: freshGrandTotalUi,
      ui_gateway_payment_id: freshPayIdUi,
      desktop_screenshot: freshDesktopShot,
      mobile_screenshot: freshMobileShot,
    };
    console.log("Fresh Paid Order E2E Summary:", summary.fresh_paid_order);

    // =========================================================================
    // PART 3: Failed Payment Browser Flow (Must NOT Confirm Order)
    // =========================================================================
    console.log("\n=== PART 3: Testing Failed Payment in Razorpay Simulator ===");
    const failTs = Date.now();
    const failOrderId = `ord_p0_failed_${failTs}`;
    const failDisplayId = Number(String(failTs).slice(-6));
    const failOrderNumber = `CTH-${failDisplayId}`;

    await db.query(
      `INSERT INTO public."order" (
         id, display_id, order_number, status, payment_status, payment_method,
         customer_id, customer_name, customer_phone, email, branch_id,
         currency_code, subtotal, tax_total, grand_total, metadata, created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'pending', 'pending', 'RAZORPAY',
         'cust_kerala_02', 'Rahul Menon', '+919847099999', 'rahul.menon@example.com', 'br_partner_04',
         'INR', $4, $5, $6, $7::jsonb, NOW(), NOW()
       )`,
      [
        failOrderId,
        failDisplayId,
        failOrderNumber,
        subtotal,
        taxTotal,
        grandTotal,
        JSON.stringify({
          order_number: failOrderNumber,
          customer_name: "Rahul Menon",
          customer_phone: "+919847099999",
          branch_id: "br_partner_04",
          branch_name: "Kochi Panampilly Nagar Flagship Hub",
          subtotal,
          tax_amount: taxTotal,
          grand_total: grandTotal,
        }),
      ]
    );

    await db.query(
      `INSERT INTO public.order_item (
         id, order_id, product_id, title, quantity, unit_price,
         taxable_value, gst_rate_pct, tax_amount, total,
         version, raw_quantity, fulfilled_quantity, shipped_quantity,
         return_requested_quantity, return_received_quantity,
         return_dismissed_quantity, written_off_quantity, raw_unit_price,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 1, $5,
         $6, $7, $8, $9,
         1, '{"value":"1"}', 0, 0,
         0, 0, 0, 0, '{"value":"433"}',
         NOW(), NOW()
       )`,
      [`oi_${failOrderId}`, failOrderId, product.id, product.title, unitPrice, subtotal, gstRate, taxTotal, grandTotal]
    );

    const context3 = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page3 = await context3.newPage();
    await page3.goto(`${BASE_URL}/checkout/razorpay?order_id=${failOrderId}&amount=${grandTotal}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await interactWithRazorpayModal(context3, page3, "9847099999", "rahul.menon@example.com", "Failure");

    await page3.waitForTimeout(3500);
    const failedShot = path.join(ARTIFACTS_DIR, "08-failed-payment-not-confirmed-desktop.png");
    await page3.screenshot({ path: failedShot, fullPage: true });
    await context3.close();

    const dbFailOrd = (await db.query(`SELECT status, payment_status, grand_total FROM public."order" WHERE id = $1`, [failOrderId])).rows[0];
    const dbFailVch = (await db.query(`SELECT COUNT(*)::int AS cnt FROM public.accounting_voucher WHERE reference_id = $1`, [failOrderId])).rows[0];

    summary.failed_payment_order = {
      order_id: failOrderId,
      order_number: failOrderNumber,
      db_order_status: dbFailOrd.status,
      db_payment_status: dbFailOrd.payment_status,
      db_grand_total: Number(dbFailOrd.grand_total),
      accounting_vouchers_created: dbFailVch.cnt,
      order_confirmed: dbFailOrd.status === "confirmed" || dbFailOrd.payment_status === "paid",
      screenshot: failedShot,
    };
    console.log("Failed Payment Order Summary:", summary.failed_payment_order);

    const outJson = path.join(ARTIFACTS_DIR, "p0_e2e_browser_verification.json");
    fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
    console.log("\nSaved P0 E2E Browser Verification manifest to:", outJson);
  } finally {
    await browser.close();
    await db.end();
  }
}

main().catch((err) => {
  console.error("Fatal error in P0 E2E verification:", err);
  process.exit(1);
});
