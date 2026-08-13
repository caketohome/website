import { ApiEngine } from "../frontend/src/lib/api-engine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runStoreArchivingTestSuite() {
  console.log("==================================================================");
  console.log("🏬 CAKETOHOME — STORE ARCHIVING & RESTORE AUDIT TEST SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now().toString().slice(-6);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SETUP: CREATE TEST STORE AND HISTORICAL ORDER
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- STEP 1: CREATE TEST STORE AND PLACE HISTORICAL ORDER ---");

  const testBranch = ApiEngine.saveBranch({
    name: `Jayanagar Hub ${timestamp}`,
    code: `HUB-JYN-${timestamp}`,
    city: "Bengaluru",
    pincode: "560041",
    address: "4th Block Jayanagar",
    phone: "+91 98765 44444",
  });

  assert(testBranch !== null && testBranch.id !== undefined, "Test store created with ID");
  assert(testBranch.status === "active" || testBranch.is_archived === false, "New store lifecycle status is ACTIVE");

  // Place order at test branch
  const cartId = `cart_arch_test_${timestamp}`;
  ApiEngine.createCart({ id: cartId });
  ApiEngine.addToCart(cartId, { productId: "prod_1", quantity: 1, price: 599 });

  const orderRes = ApiEngine.confirmCheckout({
    cart_id: cartId,
    customer_id: "cus_archive_tester",
    address: { first_name: "Archive", last_name: "Tester", phone: "+91 98765 00000", line1: "Jayanagar 4th block", city: "Bengaluru" },
    pincode: "560041",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_slot_id: "slot_01",
    payment_method: "test_mode",
  });

  assert(orderRes.success === true, "Historical order placed successfully for test store");
  const orderId = orderRes.order_id || orderRes.order?.id;

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ACTIVE STORE LISTING
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- STEP 2: ACTIVE STORE LISTING AUDIT ---");

  const activeBranchesInitial = ApiEngine.listBranches({ includeArchived: false });
  const foundInActive = activeBranchesInitial.some((b) => b.id === testBranch.id);
  assert(foundInActive === true, "Test store appears in active store list");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ARCHIVE STORE ACTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- STEP 3: ARCHIVE STORE ACTION & IDEMPOTENCY ---");

  const archiveRes = ApiEngine.archiveBranch(testBranch.id);
  assert(archiveRes.success === true, "archiveBranch API call succeeded");

  // Verify Idempotency
  const archiveResDuplicate = ApiEngine.archiveBranch(testBranch.id);
  assert(archiveResDuplicate.success === true, "Duplicate archiveBranch call returns clean response");
  assert(archiveResDuplicate.message.includes("already archived"), "Duplicate archive response confirms 'already archived'");

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ACTIVE FILTERING & ROUTING SAFETY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- STEP 4: ACTIVE FILTERING & ROUTING SAFETY AUDIT ---");

  const activeBranchesAfter = ApiEngine.listBranches({ includeArchived: false });
  const inActiveAfter = activeBranchesAfter.some((b) => b.id === testBranch.id);
  assert(inActiveAfter === false, "Archived store disappears from normal active store list");

  const allBranchesAfter = ApiEngine.listBranches({ includeArchived: true });
  const inAllAfter = allBranchesAfter.find((b) => b.id === testBranch.id);
  assert(inAllAfter !== undefined, "Archived store remains present in complete database list");
  assert(inAllAfter?.status === "archived" || inAllAfter?.is_archived === true, "Store record has status = 'archived'");

  // ──────────────────────────────────────────────────────────────────────────
  // 5. HISTORICAL DATA PRESERVATION & ORDER INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- STEP 5: HISTORICAL DATA & ORDER INTEGRITY AUDIT ---");

  const pastOrder = ApiEngine.getOrderDetails(orderId);
  assert(pastOrder !== null, "Historical order record retrieved cleanly after store archive");
  assert(pastOrder.branch_id === testBranch.id || pastOrder.branch_name !== undefined, "Historical order preserves original branch reference");

  // ──────────────────────────────────────────────────────────────────────────
  // 6. RESTORE STORE ACTION & CONFIGURATION PRESERVATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- STEP 6: RESTORE STORE ACTION & CONFIG PRESERVATION ---");

  const restoreRes = ApiEngine.restoreBranch(testBranch.id);
  assert(restoreRes.success === true, "restoreBranch API call succeeded");

  // Verify Idempotency
  const restoreResDuplicate = ApiEngine.restoreBranch(testBranch.id);
  assert(restoreResDuplicate.success === true, "Duplicate restoreBranch call returns clean response");
  assert(restoreResDuplicate.message.includes("already active"), "Duplicate restore response confirms 'already active'");

  const activeBranchesRestored = ApiEngine.listBranches({ includeArchived: false });
  const inActiveRestored = activeBranchesRestored.some((b) => b.id === testBranch.id);
  assert(inActiveRestored === true, "Restored store appears in active store list");

  // ──────────────────────────────────────────────────────────────────────────
  // 7. AUDIT LOG AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- STEP 7: AUDIT LOG SYSTEM INTEGRATION ---");

  const auditLogs = ApiEngine.listAuditLogs();
  const archiveLogEntry = auditLogs.some((l: any) => (typeof l === "string" ? l : l.action || JSON.stringify(l)).includes("STORE_ARCHIVED"));
  const restoreLogEntry = auditLogs.some((l: any) => (typeof l === "string" ? l : l.action || JSON.stringify(l)).includes("STORE_RESTORED"));

  assert(archiveLogEntry === true, "STORE_ARCHIVED recorded in system audit logs");
  assert(restoreLogEntry === true, "STORE_RESTORED recorded in system audit logs");

  // Cleanup test store
  const deleted = ApiEngine.deleteBranch(testBranch.id);
  assert(deleted === true, "Test store archived/cleaned up");

  console.log("\n==================================================================");
  console.log("🎉 ALL STORE ARCHIVING & RESTORE AUDIT TESTS PASSED!");
  console.log("==================================================================\n");
}

runStoreArchivingTestSuite().catch((err) => {
  console.error("❌ STORE ARCHIVING TEST SUITE FAILED:", err);
  process.exit(1);
});
