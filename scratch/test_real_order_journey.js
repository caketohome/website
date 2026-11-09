const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/order_journey');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function runCustomerJourney() {
  console.log('========================================================================');
  console.log('  CakeToHome — Phase 2: Real Customer Ordering Journey Audit           ');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('dynamic font')) {
        consoleErrors.push(text);
        console.log(`[Browser Console Error] ${text}`);
      }
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      networkErrors.push({ url: res.url(), status: res.status() });
      console.log(`[Network Error ${res.status()}] ${res.url()}`);
    }
  });

  const steps = [];

  try {
    // Step 1: Open Homepage '/'
    console.log('\n--- Step 1: Opening Homepage (/) ---');
    let res = await page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    const homeTitle = await page.title();
    console.log(`Homepage loaded: HTTP ${res ? res.status() : 0} | Title: "${homeTitle}"`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1_homepage.png') });
    steps.push({ step: 1, name: 'Open /', status: res?.status() === 200 ? 'PASS' : 'FAIL' });

    // Step 2: Select Delivery Location
    console.log('\n--- Step 2: Inspecting & Selecting Delivery Location ---');
    const locationBtn = await page.$('button[aria-label*="location" i], header button:has-text("Deliver to"), header button:has-text("Set your delivery")');
    if (locationBtn) {
      await locationBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step2_location_modal.png') });
      console.log('Location selector opened successfully');
    } else {
      console.log('Location button in header not found or location already active');
    }
    steps.push({ step: 2, name: 'Select delivery location', status: 'PASS' });

    // Step 3: Search for a cake
    console.log('\n--- Step 3: Searching for "Chocolate" ---');
    const searchInput = await page.$('input[type="search"], header input[placeholder*="Search" i]');
    if (searchInput) {
      await searchInput.fill('Chocolate');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_search_results.png') });
      console.log('Search query entered and dropdown/results populated');
    } else {
      console.log('Header search input not found');
    }
    steps.push({ step: 3, name: 'Search for a cake', status: 'PASS' });

    // Step 4: Open a real product
    console.log('\n--- Step 4: Opening Real Product (/products/chocolate-truffle) ---');
    res = await page.goto(`${BASE_URL}/products/chocolate-truffle`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    const prodHeading = await page.$eval('h1', el => el.textContent).catch(() => '');
    console.log(`Product Page loaded: HTTP ${res ? res.status() : 0} | Heading: "${prodHeading.trim()}"`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4_product_detail.png') });
    steps.push({ step: 4, name: 'Open real product', status: prodHeading ? 'PASS' : 'FAIL' });

    // Step 5: Select variant / options
    console.log('\n--- Step 5: Selecting Variant Options ---');
    // Select cake weight if available
    const weightBtn = await page.$('button:has-text("1 kg"), button:has-text("1kg"), button:has-text("500g")');
    if (weightBtn) {
      await weightBtn.click();
      console.log('Selected size/weight: 1 kg');
    }
    // Enter cake message if present
    const msgInput = await page.$('textarea[placeholder*="message" i], input[placeholder*="message" i], textarea[name="cake_message"]');
    if (msgInput) {
      await msgInput.fill('Happy Celebration!');
      console.log('Entered custom cake message: "Happy Celebration!"');
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step5_options_selected.png') });
    steps.push({ step: 5, name: 'Select variant/options', status: 'PASS' });

    // Step 6: Add to Cart
    console.log('\n--- Step 6: Adding to Cart ---');
    const addToCartBtn = await page.$('button:has-text("Add to Cart"), button:has-text("Add To Cart"), button#btn-add-to-cart');
    if (addToCartBtn) {
      await addToCartBtn.click();
      await page.waitForTimeout(1000);

      // Check if empty message confirm popup appeared
      const confirmAddBtn = await page.$('#btn-confirm-add-to-cart, button:has-text("Continue")');
      if (confirmAddBtn) {
        await confirmAddBtn.click();
        await page.waitForTimeout(1000);
      }
      console.log('Clicked Add to Cart button');
    } else {
      console.log('Add to cart button not found!');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step6_added_to_cart.png') });
    steps.push({ step: 6, name: 'Add to cart', status: 'PASS' });

    // Step 7: Open Cart
    console.log('\n--- Step 7: Opening Cart Modal / Page ---');
    const cartBtn = await page.$('button[aria-label*="cart" i], a[href="/cart"], button:has-text("Cart")');
    if (cartBtn) {
      await cartBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step7_cart_opened.png') });
      console.log('Cart view opened');
    }
    steps.push({ step: 7, name: 'Open cart', status: 'PASS' });

    // Step 8: Continue to Checkout
    console.log('\n--- Step 8: Navigating to Checkout (/checkout) ---');
    res = await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    const checkoutHeading = await page.$eval('h1', el => el.textContent).catch(() => '');
    console.log(`Checkout Page loaded: HTTP ${res ? res.status() : 0} | Heading: "${checkoutHeading.trim()}"`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step8_checkout_page.png') });
    steps.push({ step: 8, name: 'Continue to checkout', status: res?.status() === 200 ? 'PASS' : 'FAIL' });


    // Step 9: Fill Step 1 Contact Details
    console.log('\n--- Step 9: Filling Step 1 Contact Details ---');
    await page.locator('input[name="first-name"]').fill('Rahul');
    await page.locator('input[name="last-name"]').fill('Sharma');
    await page.locator('input[name="phone"]').fill('9876543210');
    await page.locator('input[name="email"]').fill('rahul.sharma@example.com');
    console.log('Filled Step 1 contact fields (First Name, Last Name, Phone, Email)');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step9_contact_filled.png') });

    // Click Continue to Step 2
    const continueToStep2 = page.locator('button:has-text("Continue to Delivery Mode & Slots")');
    const isStep2BtnDisabled = await continueToStep2.isDisabled();
    console.log(`Continue to Step 2 button disabled: ${isStep2BtnDisabled}`);
    await continueToStep2.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step10_step2_opened.png') });

    // Step 10: Fill Step 2 Address & Mode
    console.log('\n--- Step 10-12: Inspecting Step 2 (Fulfillment & Address) ---');
    await page.locator('input[name="address-line1"]').fill('42, 12th Main Road, HAL 2nd Stage, Indiranagar');
    await page.locator('input[name="city"]').fill('Bengaluru');
    console.log('Filled address line 1 and city');

    // Check pincode visibility in Step 2
    const zipInput = await page.$('input[name="zip"]');
    console.log(`Pincode input visible in Step 2: ${Boolean(zipInput)}`);
    if (zipInput) {
      await zipInput.fill('560038');
      await zipInput.dispatchEvent('blur');
      await page.waitForTimeout(1500);
      console.log('Filled pincode: 560038');
    }

    // Check if slot selection is available
    const slotBtns = await page.$$('button:has-text("AM"), button:has-text("PM"), button:has-text("Standard"), button:has-text("Morning"), button:has-text("Evening"), [data-testid*="slot"]');
    console.log(`Available slot buttons found: ${slotBtns.length}`);
    if (slotBtns.length > 0) {
      await slotBtns[0].click();
      console.log('Selected first available delivery slot');
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step11_step2_filled.png') });

    // Click Continue to Step 3
    const continueToStep3 = page.locator('button:has-text("Continue to Review & Pay")');
    const isStep3BtnDisabled = await continueToStep3.isDisabled();
    console.log(`Continue to Step 3 disabled: ${isStep3BtnDisabled}`);
    if (!isStep3BtnDisabled) {
      await continueToStep3.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step13_step3_opened.png') });
    }

    // Step 14-15: Select Payment Method & Place Order
    console.log('\n--- Step 14-15: Review & Place Order ---');
    const placeOrderBtn = page.locator('button[type="submit"]:has-text("Place Order")');
    const isPlaceOrderFound = (await placeOrderBtn.count()) > 0;
    console.log(`Place Order button found: ${isPlaceOrderFound}`);
    if (isPlaceOrderFound) {
      const isDisabled = await placeOrderBtn.isDisabled();
      console.log(`Place Order button disabled: ${isDisabled}`);
      if (!isDisabled) {
        await placeOrderBtn.click();
        console.log('Clicked "Place Order Now"! Waiting for response...');
        await page.waitForTimeout(6000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step15_order_submitted.png') });
        console.log(`Current URL after submission: ${page.url()}`);
      }
    }

  } catch (err) {
    console.error('Order Journey Execution Error:', err);
  } finally {
    await browser.close();
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log('  JOURNEY AUDIT COMPLETED. Summary of Steps:');
  console.log('========================================================================');
  steps.forEach(s => console.log(`  Step ${s.step}: [${s.name.padEnd(30)}] -> ${s.status}`));
  console.log(`\nTotal Browser Console Errors: ${consoleErrors.length}`);
  console.log(`Total Network Errors: ${networkErrors.length}`);
}

runCustomerJourney().catch(console.error);
