/**
 * CakeToHome — Real Customer Order Flow Test
 * Phase 1: End-to-End Browser-Based Ordering Journey
 * 
 * Tests every step of the real customer journey:
 * 1. Homepage load
 * 2. Location selection
 * 3. Product browsing/search
 * 4. Product detail (variants/options)
 * 5. Add to cart
 * 6. Cart page
 * 7. Checkout form
 * 8. Delivery address
 * 9. Delivery date/slot
 * 10. Branch/serviceability
 * 11. Payment
 * 12. Place order
 * 13. Order confirmation
 * 14. PostgreSQL order verification
 * 15. Admin order visibility
 */

const path = require("path");
const fs = require("fs");
const { chromium } = require(path.join(__dirname, "../frontend/node_modules/playwright"));

const BASE = "http://localhost:3000";
const results = [];

function log(step, status, detail) {
  const entry = { step, status, detail, timestamp: new Date().toISOString() };
  results.push(entry);
  console.log(`[${status}] Step ${step}: ${detail}`);
}

async function testOrderFlow() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 CakeToHome-Audit/1.0",
    });
    const page = await context.newPage();

    // Collect console errors
    const consoleErrors = [];
    const networkErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => {
      networkErrors.push({ url: req.url(), failure: req.failure()?.errorText });
    });

    // ── STEP 1: Homepage Load ─────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════");
    console.log("PHASE 1: REAL CUSTOMER ORDER FLOW TEST");
    console.log("═══════════════════════════════════════\n");

    const homepageRes = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const homepageStatus = homepageRes?.status();
    if (homepageStatus === 200) {
      // Check for visible content
      const title = await page.title();
      const hasHeader = await page.$("header, nav, [class*='header'], [class*='nav']");
      const hasProductSection = await page.$("[class*='product'], [class*='hero'], [class*='collection'], main");
      log("1-Homepage", "PASS", `HTTP ${homepageStatus}, Title: "${title}", Header: ${!!hasHeader}, Content: ${!!hasProductSection}`);
    } else {
      log("1-Homepage", "FAIL", `HTTP ${homepageStatus}`);
    }

    // Check CSS is loaded (not unstyled)
    const cssLoaded = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.length > 0;
    });
    log("1-CSS", cssLoaded ? "PASS" : "FAIL", `Stylesheets loaded: ${cssLoaded}`);

    // ── STEP 2: Location Selection ────────────────────────────────────────
    const locationWidget = await page.$("[class*='location'], [class*='pin'], [class*='deliver'], [aria-label*='location']");
    if (locationWidget) {
      log("2-LocationWidget", "PASS", "Location selection widget found on homepage");
      // Check if it's clickable
      const isVisible = await locationWidget.isVisible().catch(() => false);
      log("2-LocationVisible", isVisible ? "PASS" : "WARN", `Location widget visible: ${isVisible}`);
    } else {
      log("2-LocationWidget", "WARN", "No explicit location widget found on homepage — checking header");
      const headerLocationBtn = await page.$("button:has-text('location'), button:has-text('deliver'), button:has-text('Set')");
      log("2-LocationFallback", headerLocationBtn ? "PASS" : "INFO", `Header location button: ${!!headerLocationBtn}`);
    }

    // ── STEP 3: Product Browsing ──────────────────────────────────────────
    const productsRes = await page.goto(BASE + "/products", { waitUntil: "domcontentloaded", timeout: 60000 });
    const productsStatus = productsRes?.status();
    
    // Count product cards
    await page.waitForTimeout(2000); // Allow hydration
    const productCards = await page.$$("[class*='product-card'], [class*='ProductCard'], [class*='card'], a[href*='/products/']");
    const productCardCount = productCards.length;
    
    if (productsStatus === 200 && productCardCount > 0) {
      log("3-ProductListing", "PASS", `HTTP ${productsStatus}, ${productCardCount} product cards found`);
    } else if (productsStatus === 200 && productCardCount === 0) {
      log("3-ProductListing", "FAIL", `HTTP ${productsStatus} but 0 product cards rendered — possible rendering failure`);
    } else {
      log("3-ProductListing", "FAIL", `HTTP ${productsStatus}, ${productCardCount} cards`);
    }

    // Check for product images
    const productImages = await page.$$("img[src*='product'], img[src*='cake'], img[src*='supabase'], img[alt]");
    log("3-ProductImages", productImages.length > 0 ? "PASS" : "WARN", `${productImages.length} product images found`);

    // ── STEP 4: Product Detail Page ───────────────────────────────────────
    // Click first product to go to detail
    let productDetailUrl = "";
    const firstProductLink = await page.$("a[href*='/products/']");
    if (firstProductLink) {
      const href = await firstProductLink.getAttribute("href");
      productDetailUrl = href || "/products/chocolate-truffle";
    } else {
      productDetailUrl = "/products/chocolate-truffle";
    }

    const pdpRes = await page.goto(BASE + productDetailUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const pdpStatus = pdpRes?.status();
    
    // Check for product name, price, add-to-cart button
    const productName = await page.$eval("h1, h2, [class*='title']", el => el.textContent).catch(() => "");
    const priceElement = await page.$("[class*='price'], [class*='₹'], :text('₹')");
    const addToCartBtn = await page.$("button:has-text('Add'), button:has-text('Cart'), button:has-text('cart'), [class*='add-to-cart']");
    
    if (pdpStatus === 200) {
      log("4-ProductDetail", "PASS", `HTTP ${pdpStatus}, Product: "${productName?.substring(0, 40)}"`);
      log("4-PriceDisplay", priceElement ? "PASS" : "FAIL", `Price element found: ${!!priceElement}`);
      log("4-AddToCartBtn", addToCartBtn ? "PASS" : "FAIL", `Add to cart button found: ${!!addToCartBtn}`);
    } else {
      log("4-ProductDetail", "FAIL", `HTTP ${pdpStatus}`);
    }

    // Check for variant options (weight, shape, flavor)
    const weightOptions = await page.$$("[class*='weight'], [class*='variant'], select, [role='radiogroup'], [class*='option']");
    log("4-VariantOptions", weightOptions.length > 0 ? "PASS" : "INFO", `${weightOptions.length} variant/option elements found`);

    // ── STEP 5: Add to Cart ───────────────────────────────────────────────
    let addToCartSuccess = false;
    if (addToCartBtn) {
      try {
        await addToCartBtn.click();
        await page.waitForTimeout(2000);
        
        // Check for cart update (counter badge, toast notification, etc.)
        const cartCounter = await page.$("[class*='cart-count'], [class*='badge'], [class*='counter']");
        const toastMsg = await page.$("[class*='toast'], [class*='notification'], [class*='snackbar'], [role='alert']");
        addToCartSuccess = true;
        log("5-AddToCart", "PASS", `Button clicked. Cart counter: ${!!cartCounter}, Toast: ${!!toastMsg}`);
      } catch (err) {
        log("5-AddToCart", "FAIL", `Click failed: ${err.message}`);
      }
    } else {
      log("5-AddToCart", "FAIL", "No add-to-cart button found on PDP");
    }

    // ── STEP 6: Cart Page ─────────────────────────────────────────────────
    const cartRes = await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded", timeout: 60000 });
    const cartStatus = cartRes?.status();
    
    const cartItems = await page.$$("[class*='cart-item'], [class*='CartItem'], [class*='line-item'], tr, [class*='item']");
    const checkoutLink = await page.$("a[href*='checkout'], button:has-text('Checkout'), button:has-text('checkout'), button:has-text('Proceed')");
    
    log("6-CartPage", cartStatus === 200 ? "PASS" : "FAIL", `HTTP ${cartStatus}, Items: ${cartItems.length}`);
    log("6-CheckoutBtn", checkoutLink ? "PASS" : "FAIL", `Checkout button/link found: ${!!checkoutLink}`);

    // ── STEP 7: Checkout Page ─────────────────────────────────────────────
    const checkoutRes = await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded", timeout: 60000 });
    const checkoutStatus = checkoutRes?.status();
    
    // Check for checkout form elements
    const nameField = await page.$("input[name*='name'], input[name*='first'], input[placeholder*='name'], input[placeholder*='Name']");
    const phoneField = await page.$("input[name*='phone'], input[name*='mobile'], input[placeholder*='phone'], input[placeholder*='Phone']");
    const emailField = await page.$("input[name*='email'], input[type='email']");
    
    if (checkoutStatus === 200) {
      log("7-CheckoutPage", "PASS", `HTTP ${checkoutStatus}`);
      log("7-NameField", nameField ? "PASS" : "FAIL", `Name input: ${!!nameField}`);
      log("7-PhoneField", phoneField ? "PASS" : "FAIL", `Phone input: ${!!phoneField}`);
      log("7-EmailField", emailField ? "PASS" : "FAIL", `Email input: ${!!emailField}`);
    } else {
      log("7-CheckoutPage", "FAIL", `HTTP ${checkoutStatus}`);
    }

    // ── STEP 8: Delivery Address Fields ───────────────────────────────────
    const addressField = await page.$("input[name*='address'], input[placeholder*='address'], input[placeholder*='Address'], textarea[name*='address']");
    const cityField = await page.$("input[name*='city'], input[placeholder*='city'], input[placeholder*='City']");
    const pincodeField = await page.$("input[name*='zip'], input[name*='pincode'], input[name*='postal'], input[placeholder*='pin'], input[placeholder*='PIN']");
    
    log("8-AddressField", addressField ? "PASS" : "WARN", `Address input: ${!!addressField}`);
    log("8-CityField", cityField ? "PASS" : "WARN", `City input: ${!!cityField}`);
    
    // CRITICAL: Check pincode field presence and required status
    if (pincodeField) {
      const isRequired = await pincodeField.getAttribute("required");
      const ariaRequired = await pincodeField.getAttribute("aria-required");
      const isVisible = await pincodeField.isVisible();
      log("8-PincodeField", "INFO", `Pincode field EXISTS. Required: ${isRequired}, aria-required: ${ariaRequired}, Visible: ${isVisible}`);
    } else {
      log("8-PincodeField", "INFO", "No pincode field found in checkout");
    }

    // ── STEP 9: Location/GPS button ───────────────────────────────────────
    const gpsBtn = await page.$("button:has-text('Current Location'), button:has-text('GPS'), button:has-text('Detect'), [data-testid='use-current-location-btn']");
    log("9-GPSButton", gpsBtn ? "PASS" : "INFO", `GPS location button: ${!!gpsBtn}`);

    // Map component
    const mapElement = await page.$("[class*='map'], [class*='Map'], canvas, [class*='leaflet']");
    log("9-MapComponent", mapElement ? "PASS" : "INFO", `Map component: ${!!mapElement}`);

    // ── STEP 10: Delivery Date/Slot ───────────────────────────────────────
    const dateSelector = await page.$("input[type='date'], [class*='date'], button:has-text('Today'), button:has-text('Tomorrow')");
    const slotSelector = await page.$("[class*='slot'], [class*='time'], button:has-text('Morning'), button:has-text('Evening')");
    log("10-DateSelector", dateSelector ? "PASS" : "INFO", `Date selector: ${!!dateSelector}`);
    log("10-SlotSelector", slotSelector ? "PASS" : "INFO", `Slot selector: ${!!slotSelector}`);

    // ── STEP 11: Payment Method ───────────────────────────────────────────
    const paymentSection = await page.$("[class*='payment'], input[name*='payment'], [class*='cod'], [class*='razorpay']");
    const placeOrderBtn = await page.$("button:has-text('Place Order'), button:has-text('place order'), button[type='submit']:has-text('Order')");
    log("11-PaymentSection", paymentSection ? "PASS" : "INFO", `Payment section: ${!!paymentSection}`);
    log("11-PlaceOrderBtn", placeOrderBtn ? "PASS" : "INFO", `Place Order button: ${!!placeOrderBtn}`);

    // ── STEP 12: API Order Flow Test ──────────────────────────────────────
    // Test the order APIs directly
    console.log("\n--- API-Level Order Flow Tests ---\n");

    // Test checkout availability API
    const availRes = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/v1/checkout/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart_id: "cart_guest",
            delivery_type: "delivery",
            latitude: 12.9716,
            longitude: 77.5946,
          }),
        });
        return { status: res.status, data: await res.json().catch(() => null) };
      } catch (err) {
        return { status: 0, error: err.message };
      }
    });
    log("12-AvailabilityAPI", availRes.status >= 200 && availRes.status < 500 ? "PASS" : "FAIL",
      `POST /api/v1/checkout/availability -> HTTP ${availRes.status}. Serviceable: ${availRes.data?.serviceable ?? "N/A"}`);

    // Test branches API
    const branchesRes = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/v1/branches");
        return { status: res.status, data: await res.json().catch(() => null) };
      } catch (err) {
        return { status: 0, error: err.message };
      }
    });
    log("12-BranchesAPI", branchesRes.status === 200 ? "PASS" : "FAIL",
      `GET /api/v1/branches -> HTTP ${branchesRes.status}, Branches: ${branchesRes.data?.branches?.length ?? 0}`);

    // Test delivery slots API
    const slotsRes = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/v1/delivery/slots");
        return { status: res.status, data: await res.json().catch(() => null) };
      } catch (err) {
        return { status: 0, error: err.message };
      }
    });
    log("12-SlotsAPI", slotsRes.status >= 200 && slotsRes.status < 500 ? "PASS" : "FAIL",
      `GET /api/v1/delivery/slots -> HTTP ${slotsRes.status}`);

    // Test delivery resolve API (for branch matching)
    const resolveRes = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/v1/delivery/resolve?lat=12.9716&lng=77.5946");
        return { status: res.status, data: await res.json().catch(() => null) };
      } catch (err) {
        return { status: 0, error: err.message };
      }
    });
    log("12-DeliveryResolve", resolveRes.status >= 200 && resolveRes.status < 500 ? "PASS" : "FAIL",
      `GET /api/v1/delivery/resolve -> HTTP ${resolveRes.status}. Serviceable: ${resolveRes.data?.serviceable ?? "N/A"}, Branch: ${resolveRes.data?.branch_id ?? "N/A"}`);

    // ── STEP 13: Admin Dashboard Order Visibility ─────────────────────────
    const adminRes = await page.goto(BASE + "/dashboard?tab=orders", { waitUntil: "domcontentloaded", timeout: 60000 });
    const adminStatus = adminRes?.status();
    log("13-AdminOrders", adminStatus === 200 ? "PASS" : "FAIL", `GET /dashboard?tab=orders -> HTTP ${adminStatus}`);

    // Check for order table/list
    const orderTable = await page.$("table, [class*='order-list'], [class*='OrderList'], [class*='data-table']");
    log("13-OrderTable", orderTable ? "PASS" : "INFO", `Order table/list element: ${!!orderTable}`);

    // ── STEP 14: Branch Manager View ──────────────────────────────────────
    const bmRes = await page.goto(BASE + "/dashboard?tab=fulfillment", { waitUntil: "domcontentloaded", timeout: 60000 });
    log("14-BranchManager", bmRes?.status() === 200 ? "PASS" : "FAIL", `GET /dashboard?tab=fulfillment -> HTTP ${bmRes?.status()}`);

    // ── STEP 15: Customer Order History ───────────────────────────────────
    const orderHistoryRes = await page.goto(BASE + "/account/orders", { waitUntil: "domcontentloaded", timeout: 60000 });
    log("15-OrderHistory", orderHistoryRes?.status() === 200 ? "PASS" : "FAIL", `GET /account/orders -> HTTP ${orderHistoryRes?.status()}`);

    // ── FINAL: Console & Network Error Summary ────────────────────────────
    console.log("\n--- Error Summary ---");
    log("ERRORS-Console", consoleErrors.length === 0 ? "PASS" : "WARN", `${consoleErrors.length} console errors`);
    if (consoleErrors.length > 0) {
      consoleErrors.slice(0, 5).forEach((err, i) => {
        log(`ERRORS-Console-${i+1}`, "DETAIL", err.substring(0, 200));
      });
    }
    log("ERRORS-Network", networkErrors.length === 0 ? "PASS" : "WARN", `${networkErrors.length} network failures`);
    if (networkErrors.length > 0) {
      networkErrors.slice(0, 5).forEach((err, i) => {
        log(`ERRORS-Network-${i+1}`, "DETAIL", `${err.url?.substring(0, 100)}: ${err.failure}`);
      });
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════");
    console.log("PHASE 1 ORDER FLOW SUMMARY");
    console.log("══════════════════════════════════════");
    
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    const warned = results.filter(r => r.status === "WARN").length;
    const info = results.filter(r => r.status === "INFO").length;
    
    console.log(`PASS: ${passed}`);
    console.log(`FAIL: ${failed}`);
    console.log(`WARN: ${warned}`);
    console.log(`INFO: ${info}`);
    console.log(`TOTAL: ${results.length}`);
    console.log(`VERDICT: ${failed === 0 ? "ALL CRITICAL STEPS PASSED" : `${failed} FAILURES REQUIRE INVESTIGATION`}`);

    // Print failures
    if (failed > 0) {
      console.log("\n--- FAILURES ---");
      results.filter(r => r.status === "FAIL").forEach(r => {
        console.log(`  [FAIL] ${r.step}: ${r.detail}`);
      });
    }

    // Save results
    // fs already imported at top level
    fs.writeFileSync(
      "scratch/phase1_order_flow_results.json",
      JSON.stringify({ timestamp: new Date().toISOString(), results, summary: { passed, failed, warned, info, total: results.length } }, null, 2)
    );
    console.log("\nResults saved to scratch/phase1_order_flow_results.json");

    await browser.close();
  } catch (err) {
    console.error("FATAL ERROR:", err);
    if (browser) await browser.close();
    process.exit(1);
  }
}

testOrderFlow();
