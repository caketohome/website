import { dbQuery, dbTransaction } from "../src/lib/db";
import { OrderRepository } from "../src/lib/repositories/order.repository";
import { ProductRepository } from "../src/lib/repositories/product.repository";
import { BranchRepository } from "../src/lib/repositories/branch.repository";
import { CustomerRepository } from "../src/lib/repositories/customer.repository";
import { CmsRepository } from "../src/lib/repositories/cms.repository";
import { InventoryService } from "../src/lib/services/inventory.service";
import { OrderService } from "../src/lib/services/order.service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runComprehensiveSourceOfTruthVerification() {
  console.log("================================================================================");
  console.log("   CAKETOHOME DATABASE SOURCE-OF-TRUTH COMPREHENSIVE VERIFICATION SUITE");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Command Center List & Detail Live Database Round-Trip (Zero Restart)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Order Command Center List/Detail Live DB Round-Trip ---");
  const latestOrderRes = await dbQuery(
    `SELECT id, status, metadata FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`
  );
  assert(latestOrderRes.rows.length === 1, "Existing order found in PostgreSQL");
  const testOrderId = latestOrderRes.rows[0].id;
  console.log(`Target Test Order: ${testOrderId}`);

  // 1A. Direct DB mutation to 'baking_inspection'
  const testStatus1 = "baking_inspection";
  await dbQuery(
    `UPDATE "order"
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{bakery_status}', to_jsonb($1::text)),
         updated_at = NOW()
     WHERE id = $2`,
    [testStatus1, testOrderId]
  );

  // 1B. Read via OrderRepository.listOrders without restart
  const listResult1 = await OrderRepository.listOrders({ pageSize: 50 });
  const listOrder1 = listResult1.items.find((o) => o.id === testOrderId);
  assert(!!listOrder1, `Order ${testOrderId} found in listOrders()`);
  assert(String(listOrder1?.status) === testStatus1, `listOrders() immediately reflected DB change: got ${listOrder1?.status}, expected ${testStatus1}`);

  // 1C. Read via OrderRepository.findById without restart
  const detailOrder1 = await OrderRepository.findById(testOrderId);
  assert(String(detailOrder1?.status) === testStatus1, `findById() immediately reflected DB change: got ${detailOrder1?.status}, expected ${testStatus1}`);
  assert(listOrder1?.status === detailOrder1?.status, "List and Detail statuses are 100% IDENTICAL");

  // 1D. Update via OrderRepository.updateStatus
  const testStatus2 = "ready_for_pickup";
  const updatedOrder = await OrderRepository.updateStatus(testOrderId, testStatus2, "Round-trip verified transition");
  assert(updatedOrder.status === testStatus2, `updateStatus() returned new status: ${updatedOrder.status}`);

  // Verify in PostgreSQL directly
  const dbVerify = await dbQuery(`SELECT metadata->>'bakery_status' as status FROM "order" WHERE id = $1`, [testOrderId]);
  assert(dbVerify.rows[0]?.status === testStatus2, `Direct PostgreSQL confirmed status is ${testStatus2}`);

  // Verify status history row was created
  const historyVerify = await dbQuery(
    `SELECT * FROM "order_status_history" WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [testOrderId]
  );
  assert(historyVerify.rows.length === 1, "order_status_history record was created transactionally");
  assert(historyVerify.rows[0].to_status === testStatus2, `order_status_history to_status matches ${testStatus2}`);

  // ---------------------------------------------------------------------------
  // TEST 2: Product Catalog Direct DB Round-Trip (Zero Restart)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Product Catalog Direct DB Round-Trip ---");
  const prodRes = await dbQuery(
    `SELECT id, title, metadata FROM "product" WHERE deleted_at IS NULL LIMIT 1`
  );
  assert(prodRes.rows.length === 1, "Existing product found in PostgreSQL");
  const testProdId = prodRes.rows[0].id;
  const originalMeta = prodRes.rows[0].metadata || {};
  const testPrice = 888;

  // Direct DB update of product selling_price and price
  await dbQuery(
    `UPDATE "product"
     SET metadata = jsonb_set(
       jsonb_set(COALESCE(metadata, '{}'::jsonb), '{selling_price}', to_jsonb($1::numeric)),
       '{price}',
       to_jsonb($1::numeric)
     ),
     updated_at = NOW()
     WHERE id = $2`,
    [testPrice, testProdId]
  );

  // Read immediately via ProductRepository
  const fetchedProd = await ProductRepository.findById(testProdId);
  assert(fetchedProd?.price === testPrice, `ProductRepository.findById immediately reflected DB price: got ₹${fetchedProd?.price}, expected ₹${testPrice}`);

  // Revert metadata back to exact original state
  await dbQuery(
    `UPDATE "product"
     SET metadata = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(originalMeta), testProdId]
  );
  console.log(`Reverted product metadata back to original state`);

  // ---------------------------------------------------------------------------
  // TEST 3: Branch Isolation Verification with Real Data
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Branch Isolation Verification ---");
  const branches = await BranchRepository.findAll();
  assert(branches.length >= 2, `Found ${branches.length} branches in PostgreSQL`);
  const branchA = branches[0];
  const branchB = branches[1];
  console.log(`Testing Branch A (${branchA.name} [${branchA.id}]) vs Branch B (${branchB.name} [${branchB.id}])`);

  const branchAOrders = await OrderRepository.listOrders({ branch_id: branchA.id, pageSize: 50 });
  const branchBOrders = await OrderRepository.listOrders({ branch_id: branchB.id, pageSize: 50 });

  console.log(`Branch A Orders count: ${branchAOrders.total}, Branch B Orders count: ${branchBOrders.total}`);
  const leakedFromB = branchAOrders.items.filter((o) => o.branch_id === branchB.id);
  assert(leakedFromB.length === 0, "Zero Branch B orders leaked into Branch A order stream");

  // Stock isolation
  const stockA = await InventoryService.getAvailableStock(branchA.id, testProdId);
  const stockB = await InventoryService.getAvailableStock(branchB.id, testProdId);
  console.log(`Branch A Stock: ${stockA}, Branch B Stock: ${stockB}`);
  assert(typeof stockA === "number" && typeof stockB === "number", "Stock queried independently across branches");

  // ---------------------------------------------------------------------------
  // TEST 4: Customer Isolation Verification with Real Data
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Customer Isolation Verification ---");
  const custRes = await dbQuery(
    `SELECT id, metadata FROM "customer" WHERE deleted_at IS NULL LIMIT 2`
  );
  assert(custRes.rows.length >= 2, "Found at least 2 real customers in PostgreSQL");
  const custA = custRes.rows[0];
  const custB = custRes.rows[1];
  const custAUid = custA.metadata?.customer_uid || custA.id;
  const custBUid = custB.metadata?.customer_uid || custB.id;
  console.log(`Testing Customer A (${custAUid}) vs Customer B (${custBUid})`);

  const ordersA = await OrderRepository.listOrders({ customer_id: custAUid });
  const ordersB = await OrderRepository.listOrders({ customer_id: custBUid });

  const leakOrders = ordersA.items.filter((o) => o.customer_uid === custBUid || o.customer_id === custBUid);
  assert(leakOrders.length === 0, "Zero Customer B orders accessible from Customer A query");

  // ---------------------------------------------------------------------------
  // TEST 5: GST Compliance Regression (HSN 19059090)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: GST Compliance Invariant (HSN 19059090) ---");
  // Verify tax logic: Food bakery items HSN 19059090 are 5% GST
  const sampleProduct = await ProductRepository.findById(testProdId);
  assert(sampleProduct?.hsn_code === "19059090", `Product HSN code is ${sampleProduct?.hsn_code} (Expected 19059090)`);
  assert(sampleProduct?.gst_rate === 5, `Product GST rate is ${sampleProduct?.gst_rate}% (Expected 5%)`);

  // ---------------------------------------------------------------------------
  // TEST 6: Zero-Loss Bounded Pagination Regression
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Bounded Pagination & Deterministic Ordering ---");
  const page1 = await OrderRepository.listOrders({ page: 1, pageSize: 5 });
  const page2 = await OrderRepository.listOrders({ page: 2, pageSize: 5 });
  assert(page1.items.length <= 5, "Page 1 bounded to requested pageSize 5");
  assert(page2.items.length <= 5, "Page 2 bounded to requested pageSize 5");

  const page1Ids = new Set(page1.items.map((o) => o.id));
  const duplicateOverlap = page2.items.filter((o) => page1Ids.has(o.id));
  assert(duplicateOverlap.length === 0, "Zero duplicate orders between Page 1 and Page 2");

  // Safe cap test (request 5000 -> hard capped to 100)
  const cappedResult = await OrderRepository.listOrders({ pageSize: 5000 });
  assert(cappedResult.items.length <= 100, `Requested 5000 items, bounded strictly to ${cappedResult.items.length} (<= 100)`);

  console.log("\n================================================================================");
  console.log("   🎉 ALL 6 COMPREHENSIVE RECOVERY & AUTHORITY GATES PASSED (100% SUCCESS)");
  console.log("   PostgreSQL is LIVE SINGLE SOURCE OF TRUTH across CakeToHome Platform");
  console.log("================================================================================\n");
}

const safetyTimer = setTimeout(() => {
  console.error("❌ TIMEOUT: test-phase-db-source-of-truth-comprehensive exceeded 30s timeout");
  process.exit(1);
}, 30000);
safetyTimer.unref();

runComprehensiveSourceOfTruthVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
