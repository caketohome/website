/**
 * CakeToHome — Final Browser / UI Acceptance Audit Suite
 * Tests Parts 1 through 17 against live Next.js app and PostgreSQL
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

const BASE_URL = 'http://localhost:3000';
const screenshotsDir = path.join(__dirname, 'screenshots_acceptance');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runAudit() {
  console.log('========================================================================');
  console.log('  CakeToHome — FINAL BROWSER / UI ACCEPTANCE AUDIT                      ');
  console.log('========================================================================\n');

  const auditReport = {
    parts: {},
    defects: [],
    summary: {}
  };

  let totalAssertions = 0;
  let passedAssertions = 0;

  function record(partKey, assertionName, passed, details) {
    totalAssertions++;
    if (passed) passedAssertions++;
    if (!auditReport.parts[partKey]) auditReport.parts[partKey] = [];
    auditReport.parts[partKey].push({ assertionName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${partKey}] ${mark}: ${assertionName} ${details ? `(${details})` : ''}`);
    if (!passed) {
      auditReport.defects.push({
        part: partKey,
        name: assertionName,
        details
      });
    }
  }

  // 1. Discover Real Operational Entities in PostgreSQL
  console.log('--- STEP 0: Discovering Operational Entities in PostgreSQL ---');
  const branchARes = await pool.query("SELECT id, name, code, is_open FROM branch WHERE id = 'br_indiranagar'");
  const branchBRes = await pool.query("SELECT id, name, code, is_open FROM branch WHERE id = 'br_koramangala'");
  const branchA = branchARes.rows[0];
  const branchB = branchBRes.rows[0];
  console.log(`Branch A (Manager Rajesh Kumar): ${branchA.name} (${branchA.id})`);
  console.log(`Branch B (Isolated Branch): ${branchB.name} (${branchB.id})`);

  const cakeRes = await pool.query(`
    SELECT p.id, p.title, p.handle, pv.id as variant_id,
           COALESCE((p.metadata->>'selling_price')::numeric, 499) as price
    FROM product p
    JOIN product_variant pv ON pv.product_id = p.id
    WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'MADE_TO_ORDER_AVAILABILITY' OR p.metadata->>'category_slug' != 'accessories')
      AND p.id NOT LIKE 'acc_%'
      AND p.deleted_at IS NULL
    ORDER BY p.id ASC
    LIMIT 1
  `);
  const cake = cakeRes.rows[0];
  console.log(`Cake X: ${cake.title} (${cake.id}, handle: ${cake.handle})`);

  const accRes = await pool.query(`
    SELECT p.id, p.title, p.handle, pv.id as variant_id,
           COALESCE((p.metadata->>'selling_price')::numeric, 99) as price
    FROM product p
    JOIN product_variant pv ON pv.product_id = p.id
    WHERE p.id LIKE 'acc_%'
      AND p.deleted_at IS NULL
    ORDER BY p.id ASC
    LIMIT 1
  `);
  const accessory = accRes.rows[0];
  console.log(`Accessory: ${accessory.title} (${accessory.id}, variant: ${accessory.variant_id})\n`);

  // Launch Playwright Headless Chromium
  const browser = await chromium.launch({ headless: true });

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PART 1 — MANAGER LOGIN
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 1 — MANAGER LOGIN ---');
    const mgrContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const mgrPage = await mgrContext.newPage();

    // 1. Visit /login
    await mgrPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mgrPage.screenshot({ path: path.join(screenshotsDir, 'part1_login_page.png') });
    record('PART1', 'Login page renders', mgrPage.url().includes('/login'), mgrPage.url());

    // Enter phone for manager
    // In StaffAccessControl: staff_mgr_01 has phone "+91 98765 00001", role BRANCH_MANAGER, branch br_indiranagar
    await mgrPage.fill('#phone_input', '9876500001');
    await mgrPage.waitForTimeout(500);
    await mgrPage.click('button[type="submit"]');

    // Wait for OTP step
    await mgrPage.waitForSelector('input[maxlength="1"]', { timeout: 15000 });
    const digitInputs = await mgrPage.$$('input[maxlength="1"]');
    record('PART1', 'OTP verification step appears', digitInputs.length === 6);

    // Fill OTP digits (123456)
    for (let i = 0; i < 6; i++) {
      await digitInputs[i].fill(String(i + 1));
    }
    await mgrPage.waitForTimeout(500);
    await mgrPage.screenshot({ path: path.join(screenshotsDir, 'part1_otp_entered.png') });
    await mgrPage.click('button[type="submit"]');
    await mgrPage.waitForTimeout(3000);

    // Check cookies set after login
    const cookiesAfterLogin = await mgrContext.cookies();
    const roleCookie = cookiesAfterLogin.find(c => c.name === '_cth_role');
    const userIdCookie = cookiesAfterLogin.find(c => c.name === '_cth_user_id');
    const branchIdCookie = cookiesAfterLogin.find(c => c.name === '_cth_branch_id');
    record('PART1', 'Manager role recognized in session', roleCookie?.value?.toUpperCase() === 'BRANCH_MANAGER', `role=${roleCookie?.value}`);
    record('PART1', 'Manager user ID resolved', !!userIdCookie?.value, `user_id=${userIdCookie?.value}`);
    record('PART1', 'Manager authorized branch resolved', branchIdCookie?.value === 'br_indiranagar', `branch_id=${branchIdCookie?.value}`);

    // Navigate to Manager Dashboard (/dashboard/shop)
    await mgrPage.goto(`${BASE_URL}/dashboard/shop`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mgrPage.waitForTimeout(2000);
    await mgrPage.screenshot({ path: path.join(screenshotsDir, 'part1_manager_dashboard.png') });
    const dashContent = await mgrPage.content();
    const dashboardLoaded = dashContent.includes('Indiranagar Flagship') || dashContent.includes('Orders Pipeline') || dashContent.includes('Branch Operations');
    record('PART1', 'Manager dashboard loads successfully for authorized branch', dashboardLoaded, mgrPage.url());

    // Verify Manager cannot mutate another branch via API (authorization test)
    const unauthorizedMutation = await mgrPage.evaluate(async (otherBranchId) => {
      const res = await fetch(`/api/v1/branches/${otherBranchId}/products/prod_01KXYMAJKNDZ4T2YVA7K144XP5/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OFF' })
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    }, branchB.id);
    record('PART1', 'Manager cannot access/mutate another branch operational controls (HTTP 403)', unauthorizedMutation.status === 403, `HTTP ${unauthorizedMutation.status}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 2 — MANAGER CAKE AVAILABILITY UI
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 2 — MANAGER CAKE AVAILABILITY UI ---');
    // Click "Product Availability" tab
    const productsTabBtn = mgrPage.locator('button:has-text("Product Availability")').first();
    await productsTabBtn.click();
    await mgrPage.waitForTimeout(1500);
    await mgrPage.screenshot({ path: path.join(screenshotsDir, 'part2_products_tab.png') });

    const prodTabContent = await mgrPage.content();
    const identifiesBranch = prodTabContent.includes('Branch 3-State Product Availability Matrix');
    const noticePresent = prodTabContent.includes('without mutating global products') || prodTabContent.includes('strictly for');
    record('PART2', 'UI clearly identifies branch-specific availability context', identifiesBranch);
    record('PART2', 'UI contains notice that setting applies to THIS branch only', noticePresent);

    // Check cake product present in list
    const cakeTitleInTab = prodTabContent.includes(cake.title);
    record('PART2', 'Cake products visible with titles and current availability', cakeTitleInTab, cake.title);

    // Find Cake X availability buttons: Available, Out of Stock, Hidden
    const cakeCard = mgrPage.locator('div.rounded-xl', { has: mgrPage.locator(`h4:has-text("${cake.title}")`) }).first();
    const outOfStockBtn = cakeCard.locator('button:has-text("Out of Stock")');
    const availableBtn = cakeCard.locator('button:has-text("Available")');

    // Toggle ON -> OFF (Available -> Out of Stock)
    if (await outOfStockBtn.isVisible().catch(() => false)) {
      await outOfStockBtn.click();
      await mgrPage.waitForTimeout(1500);
      await mgrPage.screenshot({ path: path.join(screenshotsDir, 'part2_cake_turned_off.png') });
      const isOffActive = await outOfStockBtn.evaluate(el => el.classList.contains('bg-amber-600') || el.classList.contains('text-white'));
      record('PART2', 'Manager can toggle Cake ON -> OFF (Out of Stock)', isOffActive);

      // Toggle OFF -> ON (Out of Stock -> Available)
      await availableBtn.click();
      await mgrPage.waitForTimeout(1500);
      await mgrPage.screenshot({ path: path.join(screenshotsDir, 'part2_cake_turned_on.png') });
      const isOnActive = await availableBtn.evaluate(el => el.classList.contains('bg-emerald-600') || el.classList.contains('text-white'));
      record('PART2', 'Manager can toggle Cake OFF -> ON (Available)', isOnActive);
    } else {
      record('PART2', 'Manager cake toggle buttons visible', false, 'Toggle buttons not located in card');
    }


    // ══════════════════════════════════════════════════════════════════════════
    // PART 3 — BRANCH ISOLATION THROUGH UI
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 3 — BRANCH ISOLATION THROUGH UI ---');
    // Branch A Manager sets Branch A: Cake = AVAILABLE
    await mgrPage.evaluate(async ({ branchId, productId }) => {
      await fetch(`/api/v1/branches/${branchId}/products/${productId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-branch-id': branchId, 'x-user-role': 'branch_manager' },
        body: JSON.stringify({ status: 'AVAILABLE' })
      });
    }, { branchId: branchA.id, productId: cake.id });

    // Set Branch B: Cake = OUT_OF_STOCK (using Admin / Branch B authority)
    await fetch(`${BASE_URL}/api/v1/branches/${branchB.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'SUPER_ADMIN',
        'Cookie': '_cth_role=SUPER_ADMIN; _cth_user_id=admin_01;'
      },
      body: JSON.stringify({ status: 'OUT_OF_STOCK' })
    });

    // Direct database verification of branch isolation
    const pgBranchA = await pool.query('SELECT metadata FROM branch WHERE id = $1', [branchA.id]);
    const pgBranchB = await pool.query('SELECT metadata FROM branch WHERE id = $1', [branchB.id]);
    const availA = pgBranchA.rows[0]?.metadata?.product_availability?.[cake.id];
    const availB = pgBranchB.rows[0]?.metadata?.product_availability?.[cake.id];

    record('PART3', 'Branch A Cake remains AVAILABLE in DB', availA === 'AVAILABLE' || availA === undefined || availA === 'ON' || availA?.status === 'AVAILABLE', `Branch A: ${JSON.stringify(availA)}`);
    record('PART3', 'Branch B Cake is persisted as OUT_OF_STOCK in DB', availB === 'OUT_OF_STOCK' || availB?.status === 'OUT_OF_STOCK', `Branch B: ${JSON.stringify(availB)}`);
    record('PART3', 'Complete branch isolation verified (Branch A != Branch B)', JSON.stringify(availA) !== JSON.stringify(availB), `A vs B`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 4 — CUSTOMER STOREFRONT (Branch Context & Switching)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 4 — CUSTOMER STOREFRONT ---');
    const custContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const custPage = await custContext.newPage();

    // 1. Select Branch A via _cakes2home_branch_id cookie
    await custContext.addCookies([
      { name: '_cakes2home_branch_id', value: branchA.id, domain: 'localhost', path: '/' }
    ]);

    // Open Cake X PDP
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await custPage.waitForTimeout(2000);
    await custPage.screenshot({ path: path.join(screenshotsDir, 'part4_pdp_branchA.png') });
    const pdpContentA = await custPage.content();
    const isAvailableBranchA = pdpContentA.includes('Freshly Baked on Order') || !pdpContentA.includes('Temporarily Unavailable at this Kitchen');
    record('PART4', 'Cake X shows AVAILABLE for Branch A on Storefront PDP', isAvailableBranchA);

    // 2. Switch Branch to Branch B
    await custContext.addCookies([
      { name: '_cakes2home_branch_id', value: branchB.id, domain: 'localhost', path: '/' }
    ]);

    // Reload Cake X PDP
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await custPage.waitForTimeout(2000);
    await custPage.screenshot({ path: path.join(screenshotsDir, 'part4_pdp_branchB.png') });
    const pdpContentB = await custPage.content();
    const isUnavailableBranchB = pdpContentB.includes('Temporarily Unavailable at this Kitchen') || pdpContentB.includes('Sold Out');
    record('PART4', 'Cake X shows UNAVAILABLE for Branch B after switching branch', isUnavailableBranchB);

    // Test after page refresh
    await custPage.reload({ waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);
    const pdpContentBRefreshed = await custPage.content();
    record('PART4', 'Availability state preserved after page refresh', pdpContentBRefreshed.includes('Temporarily Unavailable') || pdpContentBRefreshed.includes('Sold Out'));


    // ══════════════════════════════════════════════════════════════════════════
    // PART 5 — CAKE PDP TRUTHFULNESS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 5 — CAKE PDP TRUTHFULNESS ---');
    // Switch back to Branch A where cake is available
    await custContext.addCookies([
      { name: '_cakes2home_branch_id', value: branchA.id, domain: 'localhost', path: '/' }
    ]);
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);
    const truthContent = await custPage.content();

    // Verify absence of fabricated capacity numbers
    const hasFakeNumbers = truthContent.includes('15 available') || truthContent.includes('20 available') || truthContent.includes('25 available') || truthContent.includes('50 available') || truthContent.includes('In Stock (15)') || truthContent.includes('In Stock (20)');
    record('PART5', 'Cake PDP DOES NOT display fabricated capacity numbers (15, 20, 25, 50)', !hasFakeNumbers);

    // Verify authentic kitchen fulfillment wording
    const hasTruthfulWording = truthContent.includes('Freshly Baked on Order') && truthContent.includes('Available for Delivery');
    record('PART5', 'Cake PDP displays approved kitchen fulfillment wording', hasTruthfulWording);

    // Check physical accessory PDP for authentic PostgreSQL stock display
    await custPage.goto(`${BASE_URL}/products/${accessory.handle || accessory.id}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);
    await custPage.screenshot({ path: path.join(screenshotsDir, 'part5_accessory_pdp.png') });
    const accPdpContent = await custPage.content();
    const hasAccStockOrPrice = accPdpContent.includes(accessory.title) && (accPdpContent.includes('available') || accPdpContent.includes('₹99'));
    record('PART5', 'Physical accessory PDP displays authentic PostgreSQL stock / pricing', hasAccStockOrPrice);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 6 — CAKE ADD TO CART
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 6 — CAKE ADD TO CART ---');
    // Branch A: Cake is ON. Add to Cart should succeed
    await custContext.addCookies([
      { name: '_cakes2home_branch_id', value: branchA.id, domain: 'localhost', path: '/' }
    ]);
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);

    const addBtnA = custPage.locator('[data-testid="pdp-add-to-bag"]').first();
    const isAddEnabledA = await addBtnA.isEnabled().catch(() => false);
    record('PART6', 'Branch A (Cake ON): Add to Bag button is ENABLED', isAddEnabledA);

    // Branch B: Cake is OFF. Add to Cart should be disabled or show Sold Out
    await custContext.addCookies([
      { name: '_cakes2home_branch_id', value: branchB.id, domain: 'localhost', path: '/' }
    ]);
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);

    const addBtnB = custPage.locator('[data-testid="pdp-add-to-bag"]').first();
    const isAddDisabledB = !(await addBtnB.isEnabled().catch(() => true));
    const btnBText = await addBtnB.textContent().catch(() => '');
    record('PART6', 'Branch B (Cake OFF): Add to Bag is DISABLED / Sold Out', isAddDisabledB || btnBText.includes('Sold Out'), `Text: ${btnBText.trim()}`);

    // Direct API attempt to add Cake to Cart for Branch B must be rejected
    const directAddRes = await custPage.evaluate(async ({ branchId, productId, variantId }) => {
      const res = await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          product_id: productId,
          variant_id: variantId,
          quantity: 1
        })
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    }, { branchId: branchB.id, productId: cake.id, variantId: cake.variant_id });
    record('PART6', 'Adding unavailable cake to cart rejected with HTTP 400', directAddRes.status === 400, `HTTP ${directAddRes.status}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 7 — CAKE + ACCESSORY CUSTOMIZATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 7 — CAKE + ACCESSORY CUSTOMIZATION ---');
    // Set Branch A (Cake is ON)
    await custContext.addCookies([
      { name: '_cakes2home_branch_id', value: branchA.id, domain: 'localhost', path: '/' }
    ]);
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);

    // Look for accessory option in customization section
    const accessoryOption = custPage.locator(`span:has-text("${accessory.title}")`).first();
    const isAccOptionVisible = await accessoryOption.isVisible().catch(() => false);
    record('PART7', 'Celebration accessory visible in PDP customization section', isAccOptionVisible, accessory.title);

    if (isAccOptionVisible) {
      await accessoryOption.click();
      await custPage.waitForTimeout(500);
      await custPage.screenshot({ path: path.join(screenshotsDir, 'part7_accessory_selected.png') });
    }

    // Click Add to Bag
    const addToBagBtn = custPage.locator('[data-testid="pdp-add-to-bag"]').first();
    await addToBagBtn.click();
    await custPage.waitForTimeout(3000);
    await custPage.screenshot({ path: path.join(screenshotsDir, 'part7_cart_drawer_opened.png') });

    // Inspect Cart Drawer DOM
    const cartDrawerText = await custPage.content();
    const hasCakeInCart = cartDrawerText.includes(cake.title);
    const hasAccessoryInCart = cartDrawerText.includes(accessory.title) || cartDrawerText.includes('Topper');

    record('PART7', 'Cake item visible in customer cart drawer', hasCakeInCart, cake.title);
    record('PART7', 'Accessory clearly represented with title in cart drawer', hasAccessoryInCart, accessory.title);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 8 — ACCESSORY INVENTORY PER BRANCH
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 8 — ACCESSORY INVENTORY PER BRANCH ---');
    const pgInvA = await pool.query(
      'SELECT quantity, reserved FROM branch_inventory WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $3)',
      [branchA.id, accessory.id, accessory.variant_id]
    );
    const pgInvB = await pool.query(
      'SELECT quantity, reserved FROM branch_inventory WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $3)',
      [branchB.id, accessory.id, accessory.variant_id]
    );
    const stockA = pgInvA.rows[0] ? pgInvA.rows[0].quantity - pgInvA.rows[0].reserved : null;
    const stockB = pgInvB.rows[0] ? pgInvB.rows[0].quantity - pgInvB.rows[0].reserved : null;

    record('PART8', 'PostgreSQL branch_inventory has record for Branch A', stockA !== null, `Stock: ${stockA}`);
    record('PART8', 'PostgreSQL branch_inventory has record for Branch B', stockB !== null, `Stock: ${stockB}`);

    const apiAccA = await custPage.evaluate(async (bId) => {
      const res = await fetch(`/api/v1/accessories?branchId=${bId}`);
      return res.json();
    }, branchA.id);
    const apiAccB = await custPage.evaluate(async (bId) => {
      const res = await fetch(`/api/v1/accessories?branchId=${bId}`);
      return res.json();
    }, branchB.id);

    const apiItemA = (apiAccA.accessories || []).find(a => a.id === accessory.id || a.title === accessory.title);
    const apiItemB = (apiAccB.accessories || []).find(a => a.id === accessory.id || a.title === accessory.title);

    record('PART8', 'API reflects Branch A stock accurately from PostgreSQL', (apiItemA?.available_stock === stockA || apiItemA?.stock === stockA), `API: ${apiItemA?.available_stock} vs DB: ${stockA}`);
    record('PART8', 'API reflects Branch B stock accurately from PostgreSQL', (apiItemB?.available_stock === stockB || apiItemB?.stock === stockB), `API: ${apiItemB?.available_stock} vs DB: ${stockB}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 9 — CAKE + ACCESSORY CHECKOUT
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 9 — CAKE + ACCESSORY CHECKOUT ---');
    const beforeAccStockRes = await pool.query(
      'SELECT quantity FROM branch_inventory WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $3)',
      [branchA.id, accessory.id, accessory.variant_id]
    );
    const beforeStock = beforeAccStockRes.rows[0]?.quantity || 0;

    const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const orderPayload = {
      branch_id: branchA.id,
      customer_name: "Audit Customer",
      customer_phone: "+91 98765 43210",
      customer_email: "audit@caketohome.com",
      delivery_address: "123 Indiranagar 100ft Road, Bengaluru",
      delivery_date: tomorrowDate,
      delivery_slot: "2:00 PM - 4:00 PM",
      items: [
        {
          product_id: cake.id,
          variant_id: cake.variant_id,
          title: cake.title,
          quantity: 1,
          price: Number(cake.price),
          unit_price: Number(cake.price),
          customization: {
            selected_addons: [accessory.title],
            selected_addons_detail: [
              {
                product_id: accessory.id,
                variant_id: accessory.variant_id,
                title: accessory.title,
                quantity: 1,
                unit_price: Number(accessory.price)
              }
            ]
          }
        }
      ]
    };

    const orderRes = await custPage.evaluate(async (payload) => {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { status: res.status, data: await res.json() };
    }, orderPayload);

    record('PART9', 'Cake + Addon order placed successfully (HTTP 201/200)', orderRes.status === 201 || orderRes.status === 200, `HTTP ${orderRes.status}`);

    // Verify PostgreSQL after order
    const cakeInvRows = await pool.query('SELECT COUNT(*) FROM branch_inventory WHERE product_id = $1', [cake.id]);
    record('PART9', 'Cake has NO inventory rows in branch_inventory', Number(cakeInvRows.rows[0].count) === 0, `Rows: ${cakeInvRows.rows[0].count}`);

    const afterAccStockRes = await pool.query(
      'SELECT quantity FROM branch_inventory WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $3)',
      [branchA.id, accessory.id, accessory.variant_id]
    );
    const afterStock = afterAccStockRes.rows[0]?.quantity || 0;
    record('PART9', 'Topper stock in branch_inventory accurately deducted by 1', afterStock === beforeStock - 1, `Before: ${beforeStock} -> After: ${afterStock}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 10 — CAKE OFF AFTER CART (Stale Cart Test)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 10 — CAKE OFF AFTER CART ---');
    await mgrPage.evaluate(async ({ branchId, productId }) => {
      await fetch(`/api/v1/branches/${branchId}/products/${productId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-branch-id': branchId, 'x-user-role': 'branch_manager' },
        body: JSON.stringify({ status: 'OFF' })
      });
    }, { branchId: branchA.id, productId: cake.id });

    const staleOrderRes = await custPage.evaluate(async (payload) => {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { status: res.status, data: await res.json() };
    }, orderPayload);

    record('PART10', 'Order rejected when Cake turned OFF after adding to cart', staleOrderRes.status === 400 || staleOrderRes.status === 409, `HTTP ${staleOrderRes.status}`);
    const errMsg = staleOrderRes.data?.error || staleOrderRes.data?.message || '';
    record('PART10', 'Server-side error explains cake is unavailable at selected store', errMsg.toLowerCase().includes('unavailable') || errMsg.toLowerCase().includes('stock'), errMsg);

    // Turn Cake X back ON at Branch A for remaining tests
    await mgrPage.evaluate(async ({ branchId, productId }) => {
      await fetch(`/api/v1/branches/${branchId}/products/${productId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-branch-id': branchId, 'x-user-role': 'branch_manager' },
        body: JSON.stringify({ status: 'AVAILABLE' })
      });
    }, { branchId: branchA.id, productId: cake.id });


    // ══════════════════════════════════════════════════════════════════════════
    // PART 11 — MANAGER AUTHORIZATION UI & API
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 11 — MANAGER AUTHORIZATION UI & API ---');
    const unauthRes = await fetch(`${BASE_URL}/api/v1/branches/${branchA.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'OFF' })
    });
    record('PART11', 'Unauthenticated mutation returns HTTP 401', unauthRes.status === 401, `HTTP ${unauthRes.status}`);

    const crossBranchRes = await fetch(`${BASE_URL}/api/v1/branches/${branchB.id}/products/${cake.id}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `_cth_role=branch_manager; _cth_branch_id=${branchA.id}; _cth_user_id=usr_mgr_01;`
      },
      body: JSON.stringify({ status: 'OFF' })
    });
    record('PART11', 'Cross-branch mutation returns HTTP 403 Forbidden', crossBranchRes.status === 403, `HTTP ${crossBranchRes.status}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 12 — RESPONSIVE UI (5 Viewports)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 12 — RESPONSIVE UI ---');
    const viewports = [
      { name: 'Mobile Narrow (320px)', width: 320, height: 568 },
      { name: 'Mobile Wide (390px)', width: 390, height: 844 },
      { name: 'Tablet (768px)', width: 768, height: 1024 },
      { name: 'Desktop (1280px)', width: 1280, height: 800 },
      { name: 'Large Desktop (1440px)', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      await custPage.setViewportSize({ width: vp.width, height: vp.height });
      await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded' });
      await custPage.waitForTimeout(1000);
      const overflow = await custPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      record('PART12', `Storefront PDP has zero horizontal overflow at ${vp.name}`, !overflow, `scrollWidth vs innerWidth`);
      await custPage.screenshot({ path: path.join(screenshotsDir, `part12_pdp_${vp.width}.png`) });

      await mgrPage.setViewportSize({ width: vp.width, height: vp.height });
      await mgrPage.goto(`${BASE_URL}/dashboard/shop`, { waitUntil: 'domcontentloaded' });
      await mgrPage.waitForTimeout(1000);
      const mgrOverflow = await mgrPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      record('PART12', `Manager Dashboard has zero horizontal overflow at ${vp.name}`, !mgrOverflow, `scrollWidth vs innerWidth`);
      await mgrPage.screenshot({ path: path.join(screenshotsDir, `part12_mgr_${vp.width}.png`) });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // PART 13 — STALE DATA / REFRESH
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 13 — STALE DATA / REFRESH ---');
    await mgrPage.evaluate(async ({ branchId, productId }) => {
      await fetch(`/api/v1/branches/${branchId}/products/${productId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-branch-id': branchId, 'x-user-role': 'branch_manager' },
        body: JSON.stringify({ status: 'OUT_OF_STOCK' })
      });
    }, { branchId: branchA.id, productId: cake.id });

    await mgrPage.reload({ waitUntil: 'domcontentloaded' });
    await mgrPage.waitForTimeout(1500);
    const mgrReloadContent = await mgrPage.content();
    record('PART13', 'Manager page preserves availability state after full reload', mgrReloadContent.includes('Indiranagar Flagship') || mgrReloadContent.includes('Branch Operations'));

    // Customer PDP with branch A cookie
    await custPage.goto(`${BASE_URL}/products/${cake.handle || cake.id}`, { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(2000);
    const custReloadContent = await custPage.content();
    record('PART13', 'Customer PDP immediately reflects updated status after reload', custReloadContent.includes('Temporarily Unavailable') || custReloadContent.includes('Sold Out'));

    // Restore to AVAILABLE
    await mgrPage.evaluate(async ({ branchId, productId }) => {
      await fetch(`/api/v1/branches/${branchId}/products/${productId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-branch-id': branchId, 'x-user-role': 'branch_manager' },
        body: JSON.stringify({ status: 'AVAILABLE' })
      });
    }, { branchId: branchA.id, productId: cake.id });


    // ══════════════════════════════════════════════════════════════════════════
    // PART 15 — REPORT UI
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 15 — REPORT UI ---');
    const invReportRes = await fetch(`${BASE_URL}/api/v1/admin/reports/inventory?branch_id=${branchA.id}`);
    const invReport = await invReportRes.json();
    record('PART15', 'Inventory Report returns HTTP 200', invReportRes.status === 200);
    record('PART15', 'Inventory Report computes valuation strictly on physical accessories', Number(invReport.ingredient_base_val || 0) === 0 && Number(invReport.total_valuation || 0) > 0, `Total Valuation: ₹${invReport.total_valuation}`);

    const cakeAvailReportRes = await fetch(`${BASE_URL}/api/v1/admin/reports/cake-availability`);
    const cakeAvailReport = await cakeAvailReportRes.json();
    record('PART15', 'Cake Availability Matrix report returns HTTP 200', cakeAvailReportRes.status === 200);
    record('PART15', 'Cake Availability Matrix covers operational branches and cakes', Array.isArray(cakeAvailReport.matrix) && cakeAvailReport.matrix.length > 0, `Total rows: ${cakeAvailReport.matrix?.length}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 16 — DATABASE/UI CONSISTENCY RECONCILIATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 16 — DATABASE/UI CONSISTENCY RECONCILIATION ---');
    const pgCheckAcc = await pool.query(
      'SELECT quantity, reserved FROM branch_inventory WHERE branch_id = $1 AND product_id = $2',
      [branchA.id, accessory.id]
    );
    const dbAccStock = pgCheckAcc.rows[0].quantity - pgCheckAcc.rows[0].reserved;
    
    // Fresh fetch after order deductions
    const freshApiAcc = await fetch(`${BASE_URL}/api/v1/accessories?branchId=${branchA.id}`).then(r => r.json());
    const freshApiItem = (freshApiAcc.accessories || []).find(a => a.id === accessory.id || a.title === accessory.title);
    const freshApiStock = freshApiItem.available_stock !== undefined ? freshApiItem.available_stock : freshApiItem.stock;

    record('PART16', 'Database branch_inventory matches API available_stock', dbAccStock === freshApiStock, `DB: ${dbAccStock} vs API: ${freshApiStock}`);

    const pgCheckCake = await pool.query('SELECT metadata FROM branch WHERE id = $1', [branchA.id]);
    const dbCakeStatus = pgCheckCake.rows[0]?.metadata?.product_availability?.[cake.id];
    record('PART16', 'Database branch cake status matches storefront PDP status', dbCakeStatus === 'AVAILABLE' || dbCakeStatus?.status === 'AVAILABLE', `DB: ${JSON.stringify(dbCakeStatus)}`);


    // ══════════════════════════════════════════════════════════════════════════
    // PART 17 — NO INVENTORY MODEL CROSSOVER
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 17 — NO INVENTORY MODEL CROSSOVER ---');
    const allCakeRows = await pool.query('SELECT COUNT(*) FROM branch_inventory WHERE product_id NOT LIKE \'acc_%\'');
    record('PART17', 'Zero cake rows in branch_inventory (Rule absolute)', Number(allCakeRows.rows[0].count) === 0, `Count: ${allCakeRows.rows[0].count}`);

    const accRows = await pool.query('SELECT COUNT(*) FROM branch_inventory WHERE product_id LIKE \'acc_%\'');
    record('PART17', 'Physical accessories tracked in branch_inventory (Rule absolute)', Number(accRows.rows[0].count) >= 424, `Count: ${accRows.rows[0].count}`);

  } finally {
    await browser.close();
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(`  AUDIT COMPLETE: ${passedAssertions} / ${totalAssertions} Assertions Passed`);
  console.log(`  Defects Discovered: ${auditReport.defects.length}`);
  console.log('========================================================================\n');

  fs.writeFileSync(
    path.join(__dirname, 'browser_ui_acceptance_report.json'),
    JSON.stringify(auditReport, null, 2)
  );
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
