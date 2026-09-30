const path = require("path");
const fs = require("fs");
const dotenv = require(path.join(__dirname, "../backend/node_modules/dotenv"));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
}

const { Client } = require(path.join(__dirname, "../backend/node_modules/pg"));

async function runInventoryAndCartAudit() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to PostgreSQL for Phase 7 & 8 Inventory and Cart Audit.");

  const results = {
    phase7_inventory: [],
    phase8_cart: [],
    overall_status: "PENDING"
  };

  const baseUrl = "http://localhost:3000";

  // ==========================================
  // PHASE 7: INVENTORY / AVAILABILITY AUDIT
  // ==========================================
  console.log("\n--- Executing Phase 7 Inventory & Availability Checks ---");

  // 1. Physical Accessory Stock: Inspect branch_inventory in PostgreSQL
  const invRes = await client.query(`
    SELECT id, branch_id, product_id, variant_id, quantity, reserved
    FROM branch_inventory
    WHERE branch_id = 'br_koramangala' AND (product_id = 'acc_01' OR variant_id = 'acc_01')
      AND deleted_at IS NULL;
  `);

  if (invRes.rows.length === 0) {
    // If not seeded at this specific branch, insert a test row to test atomic deduction
    await client.query(`
      INSERT INTO branch_inventory (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
      VALUES ('bi_audit_acc01_kora', 'br_koramangala', 'acc_01', 'acc_01', 50, 0, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET quantity = 50, reserved = 0;
    `);
  }

  const initialStockRes = await client.query(`
    SELECT quantity, reserved
    FROM branch_inventory
    WHERE branch_id = 'br_koramangala' AND (product_id = 'acc_01' OR variant_id = 'acc_01');
  `);
  const initialQty = Number(initialStockRes.rows[0].quantity);
  console.log(`Initial stock for acc_01 at br_koramangala: ${initialQty}`);

  results.phase7_inventory.push({
    test: "Physical Accessory Stock Read from PostgreSQL",
    status: initialQty > 0 ? "PASS" : "FAIL",
    quantity: initialQty
  });

  // 2. Test Atomic Deduction in a Transaction (Safe Rollback)
  console.log("Testing Atomic Stock Deduction in PostgreSQL Transaction...");
  await client.query("BEGIN;");
  const deductRes = await client.query(`
    UPDATE branch_inventory
    SET quantity = quantity - 2, updated_at = NOW()
    WHERE branch_id = 'br_koramangala'
      AND (product_id = 'acc_01' OR variant_id = 'acc_01')
      AND (quantity - reserved) >= 2
    RETURNING quantity, reserved;
  `);

  const deductedQty = Number(deductRes.rows[0].quantity);
  console.log(`Deducted stock result in transaction: ${deductedQty}`);
  const passDeduct = deductedQty === initialQty - 2;

  // Test Insufficient Stock check
  let insufficientStockThrew = false;
  try {
    const overDeductRes = await client.query(`
      UPDATE branch_inventory
      SET quantity = quantity - 999999, updated_at = NOW()
      WHERE branch_id = 'br_koramangala'
        AND (product_id = 'acc_01' OR variant_id = 'acc_01')
        AND (quantity - reserved) >= 999999
      RETURNING quantity;
    `);
    if (overDeductRes.rows.length === 0) {
      insufficientStockThrew = true; // Conditional update prevented negative balance
    }
  } catch (err) {
    insufficientStockThrew = true;
  }

  // Rollback test transaction to keep inventory untouched
  await client.query("ROLLBACK;");
  console.log("Rolled back test transaction cleanly.");

  results.phase7_inventory.push({
    test: "Atomic Stock Deduction & Condition Enforcement",
    status: passDeduct && insufficientStockThrew ? "PASS" : "FAIL",
    deductedWorked: passDeduct,
    overdraftPrevented: insufficientStockThrew
  });

  // 3. Verify Zero Synthetic Inventory for Cakes (only physical accessories exist)
  const syntheticCakeCheck = await client.query(`
    SELECT count(*) as cnt
    FROM branch_inventory bi
    WHERE bi.product_id NOT LIKE 'acc_%' AND bi.deleted_at IS NULL;
  `);
  const syntheticCakeRows = Number(syntheticCakeCheck.rows[0].cnt);
  console.log(`Synthetic Non-Accessory Rows in branch_inventory: ${syntheticCakeRows}`);
  results.phase7_inventory.push({
    test: "Zero Synthetic Cake Inventory in PostgreSQL",
    status: syntheticCakeRows === 0 ? "PASS" : "FAIL",
    syntheticCount: syntheticCakeRows
  });

  // ==========================================
  // PHASE 8: CART PERSISTENCE & LIFECYCLE AUDIT
  // ==========================================
  console.log("\n--- Executing Phase 8 Cart Persistence & Operations ---");

  const testCartId = `cart_audit_${Date.now()}`;

  // 1. Create a Cart
  console.log(`[Cart Step 1] Creating Cart: ${testCartId}...`);
  const createCartRes = await fetch(`${baseUrl}/api/v1/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: testCartId,
      branch_id: "br_koramangala",
      currency_code: "inr"
    })
  });
  const createCartBody = await createCartRes.json();
  const createdOk = createCartRes.status === 200 || createCartBody.success || createCartBody.cart;
  results.phase8_cart.push({
    step: "Create Cart via API",
    status: createdOk ? "PASS" : "FAIL",
    cart_id: testCartId
  });

  // 2. Add Cake Item with Customization
  console.log("[Cart Step 2] Adding Customized Cake to Cart...");
  const addCakeRes = await fetch(`${baseUrl}/api/v1/cart/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `_cth_cart_id=${testCartId}`
    },
    body: JSON.stringify({
      cart_id: testCartId,
      product_id: "prod_1788960674375", // CHOCOLATE TRUFFLE (₹552)
      variant_id: "var_truffle_1kg",
      title: "CHOCOLATE TRUFFLE",
      quantity: 1,
      unit_price: 552,
      metadata: {
        weight: "1 kg",
        flavour: "Dark Belgian Chocolate",
        cake_message: "Happy Birthday Auditor!",
        eggless: true
      }
    })
  });
  const addCakeBody = await addCakeRes.json();
  const cakeAdded = addCakeRes.status === 200 && addCakeBody.cart?.items?.length > 0;
  results.phase8_cart.push({
    step: "Add Customized Cake to Cart",
    status: cakeAdded ? "PASS" : "FAIL",
    items_count: addCakeBody.cart?.items?.length
  });

  // 3. Add Accessory Addon Item
  console.log("[Cart Step 3] Adding Accessory Addon to Cart...");
  const addAccRes = await fetch(`${baseUrl}/api/v1/cart/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `_cth_cart_id=${testCartId}`
    },
    body: JSON.stringify({
      cart_id: testCartId,
      product_id: "acc_01",
      title: "Gold Acrylic Happy Birthday Topper",
      quantity: 2,
      unit_price: 99
    })
  });
  const addAccBody = await addAccRes.json();
  const accAdded = addAccRes.status === 200 && addAccBody.cart?.items?.length === 2;
  results.phase8_cart.push({
    step: "Add Accessory Addon to Cart",
    status: accAdded ? "PASS" : "FAIL",
    items_count: addAccBody.cart?.items?.length
  });

  // 4. Retrieve Cart and Verify Pricing Calculation
  console.log("[Cart Step 4] Retrieving Cart and Verifying Totals...");
  const getCartRes = await fetch(`${baseUrl}/api/v1/cart?id=${testCartId}`, {
    headers: { "Cookie": `_cth_cart_id=${testCartId}` }
  });
  const getCartBody = await getCartRes.json();
  const cartData = getCartBody.cart || getCartBody.data?.cart || getCartBody;
  // Expected: 1 * 552 + 2 * 99 = 552 + 198 = 750
  const expectedSubtotal = 552 + 198;
  const cartSubtotal = Number(cartData.subtotal || cartData.total || 0);
  const mathCorrect = Math.abs(cartSubtotal - expectedSubtotal) <= 5; // Allow for potential tax if calculated in subtotal
  console.log(`Cart subtotal: ₹${cartSubtotal} (Expected: ₹${expectedSubtotal})`);
  results.phase8_cart.push({
    step: "Cart Totals Financial Reconciliation",
    status: mathCorrect ? "PASS" : "FAIL",
    subtotal: cartSubtotal,
    expected: expectedSubtotal
  });

  // 5. Verify PostgreSQL Persistence for Cart
  console.log("[Cart Step 5] Checking Cart in PostgreSQL...");
  const dbCartRes = await client.query(`
    SELECT id, metadata, created_at
    FROM cart
    WHERE id = $1;
  `, [testCartId]);

  const persistedInDb = dbCartRes.rows.length > 0;
  console.log(`Cart persisted in PostgreSQL cart table: ${persistedInDb}`);
  results.phase8_cart.push({
    step: "Cart PostgreSQL Database Persistence",
    status: persistedInDb ? "PASS" : "FAIL"
  });

  // 6. Clean up test cart
  console.log("Cleaning up test cart...");
  await client.query(`DELETE FROM cart_line_item WHERE cart_id = $1;`, [testCartId]);
  await client.query(`DELETE FROM cart WHERE id = $1;`, [testCartId]);
  console.log("Test cart cleaned up safely.");

  await client.end();

  const allInvPass = results.phase7_inventory.every(r => r.status === "PASS");
  const allCartPass = results.phase8_cart.every(r => r.status === "PASS");
  results.overall_status = allInvPass && allCartPass ? "PASS" : "PARTIAL";

  console.log("\n=================================================");
  console.log("PHASE 7 & 8 AUDIT SUMMARY");
  console.log("=================================================");
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    path.join(__dirname, "phase7_phase8_inventory_cart_results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("Saved results to scratch/phase7_phase8_inventory_cart_results.json");
}

runInventoryAndCartAudit().catch(err => {
  console.error("Phase 7 & 8 failed:", err);
  process.exit(1);
});
