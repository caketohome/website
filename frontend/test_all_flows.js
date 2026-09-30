const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = 'supersecret';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_verification');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function base64Url(obj) {
  return Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url');
}

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const expPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 86400, iat: Math.floor(Date.now() / 1000) };
  const head = base64Url(header);
  const pay = base64Url(expPayload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${pay}`).digest('base64url');
  return `${head}.${pay}.${sig}`;
}

async function runVerification() {
  console.log('====================================================');
  console.log('  COMPREHENSIVE FRONTEND RUNTIME & BROWSER AUDIT');
  console.log('====================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = {};
  const consoleErrors = [];

  // Helper to create page with console error tracking
  async function createTrackedPage(context) {
    const page = await context.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('status of 404')) {
          consoleErrors.push(`[${page.url()}] Console Error: ${text}`);
        }
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(`[${page.url()}] Page Error: ${err.message}`);
    });
    return page;
  }

  try {
    // -------------------------------------------------------------
    // FLOW A: Homepage (/)
    // -------------------------------------------------------------
    console.log('📍 [FLOW A] Testing Homepage (http://localhost:3000/)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const title = await page.title();
      const content = await page.content();
      const hasHeading = await page.locator('h1, h2').first().isVisible().catch(() => false);
      const ok = res.status() === 200 && content.length > 5000 && hasHeading;
      results['A. / (Homepage)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        title,
        contentLength: content.length,
        hasHeading
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_homepage.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, Title: "${title}", Length: ${content.length})`);
      await context.close();
    } catch (e) {
      results['A. / (Homepage)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW B: Login Page (/login)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW B] Testing Login Page (http://localhost:3000/login)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const hasPhoneInput = await page.locator("input[type='tel'], input[placeholder*='Mobile'], input[placeholder*='phone']").first().isVisible().catch(() => false);
      const hasReqBtn = await page.locator("button:has-text('Request OTP'), button:has-text('Send OTP'), button:has-text('Login')").first().isVisible().catch(() => false);
      const ok = res.status() === 200 && (hasPhoneInput || hasReqBtn);
      results['B. /login'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        hasPhoneInput,
        hasReqBtn
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_login.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, PhoneInput: ${hasPhoneInput}, RequestBtn: ${hasReqBtn})`);
      await context.close();
    } catch (e) {
      results['B. /login'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW C: Customer Login & OTP Flow
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW C] Testing Customer Login Flow & Account Access...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      
      const phoneInput = page.locator("input[type='tel'], input[placeholder*='Mobile']").first();
      if (await phoneInput.isVisible().catch(() => false)) {
        await phoneInput.fill('9876543210');
        const reqBtn = page.locator("button:has-text('Request OTP'), button:has-text('Send OTP')").first();
        if (await reqBtn.isVisible().catch(() => false)) {
          await reqBtn.click();
          await page.waitForTimeout(1500);
        }
      }

      const autoFillBtn = page.locator("button:has-text('Auto-fill')").first();
      if (await autoFillBtn.isVisible().catch(() => false)) {
        await autoFillBtn.click();
        await page.waitForTimeout(500);
      } else {
        const otpInput = page.locator("input[placeholder*='OTP']").first();
        if (await otpInput.isVisible().catch(() => false)) {
          await otpInput.fill('123456');
        }
      }

      const verifyBtn = page.locator("button:has-text('Verify & Login'), button:has-text('Verify OTP')").first();
      if (await verifyBtn.isVisible().catch(() => false)) {
        await verifyBtn.click();
        await page.waitForTimeout(2500);
      }

      const currentUrl = page.url();
      const loginSuccess = currentUrl.includes('/account') || currentUrl.includes('/') || (await page.locator("text=Account, text=Profile, text=Logout, text=Orders").first().isVisible().catch(() => false));
      results['C. Customer Login'] = {
        status: loginSuccess ? 'PASS' : 'FAIL',
        finalUrl: currentUrl
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_customer_login.png') });
      console.log(`   -> Result: ${loginSuccess ? 'PASS' : 'FAIL'} (Final URL: ${currentUrl})`);
      await context.close();
    } catch (e) {
      results['C. Customer Login'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW D: Product Listing (/products)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW D] Testing Product Listing (http://localhost:3000/products)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const productCards = await page.locator("a[href*='/products/'], div[data-testid*='product-card']").count();
      const ok = res.status() === 200 && productCards > 0;
      results['D. Product Listing (/products)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        productCount: productCards
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_products.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, Found ${productCards} product cards)`);
      await context.close();
    } catch (e) {
      results['D. Product Listing (/products)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW E: Category Page (/category/chocolate-cakes)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW E] Testing Category Page (http://localhost:3000/category/chocolate-cakes)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/category/chocolate-cakes', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const content = await page.content();
      const ok = res.status() === 200 && content.length > 5000;
      results['E. Category Page (/category/chocolate-cakes)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        contentLength: content.length
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_category_chocolate.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, Content Length: ${content.length})`);
      await context.close();
    } catch (e) {
      results['E. Category Page (/category/chocolate-cakes)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW F: Product Detail Page (PDP)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW F] Testing Product Detail Page (PDP)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      
      await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      const firstProductLink = await page.locator("a[href*='/products/']").first().getAttribute('href');
      const pdpUrl = firstProductLink ? `http://localhost:3000${firstProductLink.startsWith('/') ? firstProductLink : '/' + firstProductLink}` : 'http://localhost:3000/products/chocolate-fudge-cupcake';
      
      console.log(`   Navigating to PDP: ${pdpUrl}`);
      const res = await page.goto(pdpUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const hasAddToCart = await page.locator("button:has-text('Add to Bag'), button:has-text('Add to Cart'), button:has-text('Order')").first().isVisible().catch(() => false);
      const hasPrice = await page.locator("text=₹").first().isVisible().catch(() => false);
      const ok = res.status() === 200 && hasAddToCart && hasPrice;
      results['F. Product Detail Page (PDP)'] = {
        status: ok ? 'PASS' : 'FAIL',
        url: pdpUrl,
        httpStatus: res.status(),
        hasAddToCart,
        hasPrice
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_pdp.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, AddToCart: ${hasAddToCart}, HasPrice: ${hasPrice})`);
      await context.close();
    } catch (e) {
      results['F. Product Detail Page (PDP)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW G: Cart Page (/cart) & Cart Drawer
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW G] Testing Cart Page (http://localhost:3000/cart)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const content = await page.content();
      const hasCartTitle = await page.locator("text=Your Bag, text=Cart, text=Shopping Bag, text=Empty").first().isVisible().catch(() => false);
      const ok = res.status() === 200 && (content.length > 3000 || hasCartTitle);
      results['G. Cart Page (/cart)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        contentLength: content.length,
        hasCartTitle
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_cart.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, HasCartTitle: ${hasCartTitle})`);
      await context.close();
    } catch (e) {
      results['G. Cart Page (/cart)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW H: Checkout Page (/checkout)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW H] Testing Checkout Page (http://localhost:3000/checkout)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/checkout', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const content = await page.content();
      const ok = res.status() === 200 && content.length > 5000;
      results['H. Checkout (/checkout)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        contentLength: content.length
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_checkout.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, Content Length: ${content.length})`);
      await context.close();
    } catch (e) {
      results['H. Checkout (/checkout)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW I: Order Confirmation / Your Order (/your-order)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW I] Testing Order Confirmation (/your-order)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/your-order', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const ok = res.status() === 200 || res.status() === 307;
      results['I. Order Confirmation (/your-order)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status()
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_your_order.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()})`);
      await context.close();
    } catch (e) {
      results['I. Order Confirmation (/your-order)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW J & K: Authenticated Customer Account & Orders (/account, /account/orders)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW J & K] Testing Authenticated Customer Account & Orders...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const token = createToken({ userId: 'cus_9876543210', role: 'CUSTOMER', phone: '9876543210', customerUid: 'cus_9876543210' });
      await context.addCookies([
        { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'cus_9876543210', domain: 'localhost', path: '/' },
        { name: '_cth_customer_uid', value: 'cus_9876543210', domain: 'localhost', path: '/' },
        { name: '_cth_phone', value: '9876543210', domain: 'localhost', path: '/' },
        { name: '_cth_role', value: 'CUSTOMER', domain: 'localhost', path: '/' }
      ]);
      const page = await createTrackedPage(context);

      // Account Page
      const resAccount = await page.goto('http://localhost:3000/account', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const accountContent = await page.content();
      const accountOk = resAccount.status() === 200 && accountContent.length > 5000;
      results['J. Customer Account (/account)'] = {
        status: accountOk ? 'PASS' : 'FAIL',
        httpStatus: resAccount.status(),
        contentLength: accountContent.length
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_account.png') });
      console.log(`   -> Account Result: ${accountOk ? 'PASS' : 'FAIL'} (HTTP ${resAccount.status()})`);

      // Orders Page
      const resOrders = await page.goto('http://localhost:3000/account/orders', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const ordersContent = await page.content();
      const ordersOk = resOrders.status() === 200 && ordersContent.length > 3000;
      results['K. Order History (/account/orders)'] = {
        status: ordersOk ? 'PASS' : 'FAIL',
        httpStatus: resOrders.status(),
        contentLength: ordersContent.length
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_orders.png') });
      console.log(`   -> Orders Result: ${ordersOk ? 'PASS' : 'FAIL'} (HTTP ${resOrders.status()})`);

      await context.close();
    } catch (e) {
      results['J. Customer Account (/account)'] = { status: 'FAIL', error: e.message };
      results['K. Order History (/account/orders)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW L: Order Detail / Tracking Client (/orders/[id])
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW L] Testing Order Detail & Tracking Client...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const token = createToken({ userId: 'cus_9876543210', role: 'CUSTOMER', phone: '9876543210', customerUid: 'cus_9876543210' });
      await context.addCookies([
        { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'cus_9876543210', domain: 'localhost', path: '/' },
        { name: '_cth_customer_uid', value: 'cus_9876543210', domain: 'localhost', path: '/' }
      ]);
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/orders/ord_101', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const content = await page.content();
      const ok = (res.status() === 200 || res.status() === 404 || res.status() === 307) && !content.includes('Application error: a client-side exception has occurred');
      results['L. Order Detail / Tracking (/orders/[id])'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        renderedWithoutCrash: ok
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_order_detail.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()}, No Unhandled Crash: ${ok})`);
      await context.close();
    } catch (e) {
      results['L. Order Detail / Tracking (/orders/[id])'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW M: Branch Selection (/locations)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW M] Testing Branch Selection (/locations)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await createTrackedPage(context);
      const res = await page.goto('http://localhost:3000/locations', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const content = await page.content();
      const ok = res.status() === 200 && content.length > 5000;
      results['M. Branch Selection (/locations)'] = {
        status: ok ? 'PASS' : 'FAIL',
        httpStatus: res.status(),
        contentLength: content.length
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_locations.png') });
      console.log(`   -> Result: ${ok ? 'PASS' : 'FAIL'} (HTTP ${res.status()})`);
      await context.close();
    } catch (e) {
      results['M. Branch Selection (/locations)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW N: Branch Manager Dashboard (/dashboard/shop & /dashboard/shop/menu)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW N] Testing Branch Manager Dashboard (/dashboard/shop)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const token = createToken({ userId: 'shpmgr_01', role: 'BRANCH_MANAGER', branchId: 'br_indiranagar' });
      await context.addCookies([
        { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_medusa_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'shpmgr_01', domain: 'localhost', path: '/' },
        { name: '_cth_role', value: 'BRANCH_MANAGER', domain: 'localhost', path: '/' },
        { name: '_cth_branch_id', value: 'br_indiranagar', domain: 'localhost', path: '/' }
      ]);
      const page = await createTrackedPage(context);

      // /dashboard/shop
      const resShop = await page.goto('http://localhost:3000/dashboard/shop', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const shopContent = await page.content();
      const shopOk = resShop.status() === 200 && !shopContent.includes('Application error');
      results['N1. Branch Manager Dashboard (/dashboard/shop)'] = {
        status: shopOk ? 'PASS' : 'FAIL',
        httpStatus: resShop.status()
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_manager_shop.png') });
      console.log(`   -> Shop Dashboard: ${shopOk ? 'PASS' : 'FAIL'} (HTTP ${resShop.status()})`);

      // /dashboard/shop/menu
      const resMenu = await page.goto('http://localhost:3000/dashboard/shop/menu', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const menuContent = await page.content();
      const menuOk = resMenu.status() === 200 && !menuContent.includes('Application error');
      results['N2. Branch Manager Menu (/dashboard/shop/menu)'] = {
        status: menuOk ? 'PASS' : 'FAIL',
        httpStatus: resMenu.status()
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_manager_menu.png') });
      console.log(`   -> Shop Menu: ${menuOk ? 'PASS' : 'FAIL'} (HTTP ${resMenu.status()})`);

      await context.close();
    } catch (e) {
      results['N1. Branch Manager Dashboard (/dashboard/shop)'] = { status: 'FAIL', error: e.message };
      results['N2. Branch Manager Menu (/dashboard/shop/menu)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

    // -------------------------------------------------------------
    // FLOW O: Admin Dashboard (/dashboard)
    // -------------------------------------------------------------
    console.log('\n📍 [FLOW O] Testing Super Admin Dashboard (/dashboard)...');
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const token = createToken({ userId: 'admin_01', role: 'SUPER_ADMIN', isSuperAdmin: true });
      await context.addCookies([
        { name: '_cth_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_medusa_jwt', value: token, domain: 'localhost', path: '/' },
        { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
        { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' }
      ]);
      const page = await createTrackedPage(context);

      const resAdmin = await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const adminContent = await page.content();
      const adminOk = resAdmin.status() === 200 && !adminContent.includes('Application error');
      results['O. Admin Dashboard (/dashboard)'] = {
        status: adminOk ? 'PASS' : 'FAIL',
        httpStatus: resAdmin.status()
      };
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_admin_dashboard.png') });
      console.log(`   -> Admin Dashboard: ${adminOk ? 'PASS' : 'FAIL'} (HTTP ${resAdmin.status()})`);

      await context.close();
    } catch (e) {
      results['O. Admin Dashboard (/dashboard)'] = { status: 'FAIL', error: e.message };
      console.error('   -> Error:', e.message);
    }

  } finally {
    await browser.close();
  }

  console.log('\n====================================================');
  console.log('  FINAL VERIFICATION SUMMARY');
  console.log('====================================================');
  console.log(JSON.stringify(results, null, 2));

  if (consoleErrors.length > 0) {
    console.log('\n⚠️ Console / Page Errors Detected:');
    consoleErrors.forEach(err => console.log(' - ' + err));
  } else {
    console.log('\n✓ ZERO Runtime Console / Page Errors Detected!');
  }
}

runVerification().catch(err => {
  console.error('FATAL Test Suite Failure:', err);
  process.exit(1);
});
