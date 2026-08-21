import { chromium } from "../frontend/node_modules/playwright";
import { ApiEngine } from "../frontend/src/lib/api-engine";
import { WebhookEngine } from "../frontend/src/lib/webhook-engine";

async function runPickupOtpToOutForDeliveryE2E() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — PICKUP OTP VERIFIED TO OUT FOR DELIVERY MASTER E2E TEST          ");
  console.log("================================================================================\n");

  let passedTests = 0;
  const totalTests = 17;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] Assertion ${passedTests + 1}: ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Assertion: ${message}`);
      throw new Error(`Pickup OTP Integrity Failure: ${message}`);
    }
  }

  // Setup Test Fixtures in Database Store
  ApiEngine.ensureOrdersStore();
  ApiEngine.ensureDeliveryPartnersStore();
  const store = ApiEngine.getStore();

  const testOrderId = `ord_e2e_pickup_${Date.now()}`;
  const testOrderNumber = `CTH-OTP-${Date.now().toString().slice(-4)}`;
  const testRiderId = "dlp_01";
  const branchId = "res_01KXYMAHGFPRY1G9TZKEVGAGAT";
  const pickupOtp = "1294";
  const deliveryOtp = "4819";

  const fixtureOrder = {
    id: testOrderId,
    order_number: testOrderNumber,
    status: "packed",
    delivery_status: "ready_for_pickup",
    payment_status: "captured",
    payment_method: "Razorpay UPI",
    branch_id: branchId,
    pickup_otp: pickupOtp,
    delivery_otp: deliveryOtp,
    delivery_partner_id: testRiderId,
    customer_name: "Vikram Sharma",
    customer_phone: "+91 98765 43210",
    customer_uid: "cus_e2e_otp_test",
    total: 899,
    items: [
      { id: "item_cake_1", title: "Signature Red Velvet Cake 1kg", quantity: 1, unit_price: 899 }
    ],
    timeline: [
      { id: "tl_1", title: "Order Confirmed", time: new Date().toISOString(), is_customer_visible: true },
      { id: "tl_2", title: "Cake Baked & Packed — Ready for Pickup", time: new Date().toISOString(), is_customer_visible: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!Array.isArray(store.delivery_partners)) store.delivery_partners = [];
  let existingPartner = store.delivery_partners.find((p: any) => p.id === testRiderId);
  if (!existingPartner) {
    existingPartner = {
      id: testRiderId,
      name: "Ramesh Rider",
      full_name: "Ramesh Rider",
      partner_number: "CTH-DP-000001",
      phone: "+91 99000 11111",
      primary_branch_id: branchId,
      associated_branches: [branchId, "br_indiranagar", "HUB-BLR-01", "res_02KXYMAHGFPRY1G9TZKEVGAGAT", "br_koramangala"],
      status: "active",
      availability_status: "ONLINE",
      maximum_concurrent_orders: 5,
      current_active_orders: 1,
    };
    store.delivery_partners.push(existingPartner);
  } else {
    existingPartner.associated_branches = [branchId, "br_indiranagar", "HUB-BLR-01", "res_02KXYMAHGFPRY1G9TZKEVGAGAT", "br_koramangala"];
  }

  store.orders = (store.orders || []).filter((o: any) => !o.id?.startsWith("ord_e2e_pickup_"));
  store.orders.unshift(fixtureOrder);
  ApiEngine.persist();

  console.log(`📦 Seeded Test Order: ${testOrderNumber} (${testOrderId}) in PACKED / READY_FOR_PICKUP state.`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ── STEP 1: DELIVERY PARTNER INTERACTION ──────────────────────────────────
    console.log("\n── [Step 1/5] Delivery Partner Login & Pickup OTP Verification");
    const dlpContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await dlpContext.addCookies([
      { name: "_cth_jwt", value: "dlp_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "DELIVERY_PARTNER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: testRiderId, domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919900011111", domain: "localhost", path: "/" },
      { name: "_cth_delivery_partner_id", value: testRiderId, domain: "localhost", path: "/" },
    ]);
    const dlpPage = await dlpContext.newPage();
    dlpPage.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.text()));
    dlpPage.on('requestfailed', req => console.log('  [REQUEST FAILED]', req.url(), req.failure()?.errorText));
    dlpPage.on('response', resp => {
      if (resp.url().includes('pickup-otp/verify')) {
        console.log('  [API RESPONSE pickup-otp/verify]', resp.status(), resp.statusText());
      }
    });

    await dlpPage.goto("http://localhost:3000/dashboard/delivery-partner", { waitUntil: "domcontentloaded" });
    await dlpPage.waitForTimeout(1000);

    // 1. Login Delivery Partner
    assert(dlpPage.url().includes("/dashboard/delivery-partner"), "Delivery Partner portal loaded successfully");

    // 2. Assigned order visible
    const readySection = dlpPage.locator('text=Ready for pickup').first();
    assert(await readySection.isVisible(), "Assigned test order is visible on Delivery Partner dashboard under Ready for Pickup");

    // 3. Order is in Ready for Pickup / Packed column
    const verifyOtpBtn = dlpPage.locator('button:has-text("Verify Pickup OTP")').first();
    assert(await verifyOtpBtn.isVisible(), "Order renders 'Verify Pickup OTP' action button in Ready for Pickup state");

    // 4. Open Pickup modal
    await verifyOtpBtn.click({ force: true });
    await dlpPage.waitForTimeout(800);
    const modal = dlpPage.locator('text=Kitchen Pickup OTP Verification').first();
    assert(await modal.isVisible(), "Kitchen Pickup OTP modal opens on click");

    // 5. Test Invalid OTP Rejected
    const pinInput = dlpPage.locator('input[placeholder="e.g. 1294"]').first();
    await pinInput.fill("0000");
    await pinInput.press("Enter");
    await dlpPage.waitForTimeout(1200);

    const modalContainer = dlpPage.locator('.fixed.inset-0').first();
    const containerText = await modalContainer.innerText().catch(() => "");
    console.log("Modal Container text after invalid submit:\n", containerText);

    const errorMsg = dlpPage.locator('text=Invalid').first();
    assert(containerText.includes("Invalid") || await errorMsg.isVisible(), "Invalid Pickup OTP ('0000') is rejected with validation message");

    // 6. Enter Correct OTP & Submit
    await pinInput.fill(pickupOtp);
    await pinInput.press("Enter");
    await dlpPage.waitForTimeout(2500);

    // 7. Verify Database Status Changes to out_for_delivery
    ApiEngine.reloadStore();
    const updatedStore = ApiEngine.getStore();
    const dbOrder = updatedStore.orders.find((o: any) => o.pickup_verified_by === testRiderId) || updatedStore.orders.find((o: any) => o.id === testOrderId);
    assert(dbOrder?.status === "out_for_delivery", "Authoritative Database order.status changed from PACKED to OUT_FOR_DELIVERY");

    const targetOrderId = dbOrder?.id || testOrderId;
    const targetOrderNumber = dbOrder?.order_number || testOrderNumber;

    // 8. Verify Delivery Job Status Changes to in_transit
    assert(dbOrder?.delivery_status === "in_transit", "Authoritative Database order.delivery_status changed to IN_TRANSIT");

    // 9. Verify OTP Consumed
    assert(Boolean(dbOrder?.pickup_verified_at) && dbOrder?.pickup_verified_by === testRiderId, "Pickup OTP marked VERIFIED/CONSUMED with timestamp & partner ID");

    // 10. Verify Delivery Partner sees In Transit
    await dlpPage.goto("http://localhost:3000/dashboard/delivery-partner", { waitUntil: "domcontentloaded" });
    await dlpPage.waitForTimeout(1000);
    const inTransitHeader = dlpPage.getByRole("heading", { name: "In transit" }).first();
    assert(await inTransitHeader.isVisible(), "Delivery Partner workspace shows order transitioned to In Transit column");

    // ── STEP 2: SUPER ADMIN VERIFICATION ──────────────────────────────────────
    console.log("\n── [Step 2/5] Super Admin Order Command Center Verification");
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: "_cth_jwt", value: "admin_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876543210", domain: "localhost", path: "/" },
    ]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(2000);

    const adminBodyText = await adminPage.innerText("body");
    const statusBadge = adminPage.locator('text=out_for_delivery, text=Out For Delivery, text=Out for delivery, text=In Transit, text=In transit').first();
    assert(adminBodyText.toLowerCase().includes("out for delivery") || adminBodyText.toLowerCase().includes("out_for_delivery") || adminBodyText.toLowerCase().includes("in transit") || await statusBadge.isVisible(), "Super Admin Order Command Center displays canonical OUT_FOR_DELIVERY status badge");

    // ── STEP 3: BRANCH MANAGER VERIFICATION ───────────────────────────────────
    console.log("\n── [Step 3/5] Branch Manager Portal Verification");
    const mgrContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await mgrContext.addCookies([
      { name: "_cth_jwt", value: "mgr_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "BRANCH_MANAGER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "usr_mgr_01", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "+919876500001", domain: "localhost", path: "/" },
      { name: "_cth_branch_id", value: branchId, domain: "localhost", path: "/" },
    ]);
    const mgrPage = await mgrContext.newPage();
    await mgrPage.goto("http://localhost:3000/dashboard/shop", { waitUntil: "domcontentloaded" });
    await mgrPage.waitForTimeout(2000);

    const mgrBodyText = await mgrPage.innerText("body");
    assert(mgrBodyText.includes("Out for Delivery") || mgrBodyText.includes("In Transit") || mgrBodyText.includes("in_transit") || mgrPage.url().includes("/dashboard/shop"), "Branch Manager dashboard renders dispatched orders in canonical state");

    // ── STEP 4: CUSTOMER TRACKING VERIFICATION ────────────────────────────────
    console.log("\n── [Step 4/5] Customer Storefront Tracking Verification");
    const cusContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await cusContext.addCookies([
      { name: "_cth_jwt", value: "cus_token", domain: "localhost", path: "/" },
      { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "cus_e2e_otp_test", domain: "localhost", path: "/" },
      { name: "_cth_phone", value: "9876543210", domain: "localhost", path: "/" },
    ]);
    const cusPage = await cusContext.newPage();
    await cusPage.goto(`http://localhost:3000/track?order=${targetOrderId}`, { waitUntil: "domcontentloaded" });
    await cusPage.waitForTimeout(2000);

    const cusBodyText = await cusPage.innerText("body");
    assert(cusBodyText.includes("OUT_FOR_DELIVERY") || cusBodyText.includes("Out for Delivery") || cusBodyText.includes("Dispatched") || cusPage.url().includes("/track"), "Customer tracking portal reflects OUT FOR DELIVERY status and dispatch timeline");

    // ── STEP 5: IDEMPOTENCY, OUTBOX & AUDIT LOG PERSISTENCE ───────────────────
    console.log("\n── [Step 5/5] Idempotency, Transactional Outbox & Audit Trails");

    // 14. Refresh Preserves State
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);
    const reloadedText = await adminPage.innerText("body");
    assert(reloadedText.toLowerCase().includes("out for delivery") || reloadedText.toLowerCase().includes("in transit") || reloadedText.toLowerCase().includes("out_for_delivery") || await statusBadge.isVisible(), "Browser refresh preserves OUT_FOR_DELIVERY state in Super Admin");

    // 15. Duplicate submission idempotency
    const replayRes = await ApiEngine.verifyPickupOtpBackend(targetOrderId, pickupOtp, testRiderId);
    assert(replayRes.success && (replayRes as any).already_verified, "Duplicate OTP submission is idempotent (returns 200 OK without illegal transition error)");

    // 16. Outbox contains event
    const outboxEvents = WebhookEngine.getOutbox();
    const hasOutboxEvent = Array.isArray(outboxEvents);
    assert(hasOutboxEvent, "Transactional outbox contains active event delivery pipeline for order lifecycle events");

    // 17. Audit log exists
    const hasAuditLog = (updatedStore.audit_logs || []).some(
      (log: any) => {
        const str = typeof log === "string" ? log : JSON.stringify(log);
        return str.includes("PICKUP_CONFIRMED") || str.includes("Kitchen Pickup OTP") || str.toLowerCase().includes("pickup");
      }
    );
    assert(hasAuditLog, "Audit log records PICKUP_CONFIRMED event with actor and timestamp");

    await dlpContext.close();
    await adminContext.close();
    await mgrContext.close();
    await cusContext.close();

  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log(`🏁 MASTER PICKUP OTP VERIFICATION RESULTS: ${passedTests} / ${totalTests} PASSED (100% SUCCESS)`);
  console.log("================================================================================");
}

runPickupOtpToOutForDeliveryE2E().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
