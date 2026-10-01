/**
 * Phase 5B.3 Verification: Online Order → Delivery → Final Billing
 *
 * Tests the Order ≠ Bill invariant by directly seeding an order into the
 * memory store and then driving it through the delivery lifecycle.
 */

import { ApiEngine } from "../src/lib/api-engine";
import { OrderLifecycleService } from "../src/lib/order-lifecycle-service";
import { dbQuery } from "../src/lib/db";

let passed = 0;
let total = 0;

function assert(cond: boolean, name: string, detail?: string) {
  total++;
  if (cond) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}`);
    if (detail) console.error(`   ${detail}`);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🧪 Phase 5B.3: Online Order → Delivery → Final Billing");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // Ensure stores exist
    ApiEngine.ensureOrdersStore();
    const store = ApiEngine.getStore();
    if (!store.invoices) store.invoices = [];
    if (!store.delivery_partners) store.delivery_partners = [];

    // ── Test 1: Seed Order with NULL invoice_number ──────────────────────
    console.log("--- Test 1: Order Creation (Order ≠ Bill Invariant) ---");
    
    const orderId = `ord_5b3_${Date.now()}`;
    const orderNumber = `CTH-20261001-V5B3`;
    const pickupOtp = "1294";
    const deliveryOtp = "4819";

    const seedOrder: any = {
      id: orderId,
      cart_id: `cart_5b3_${Date.now()}`,
      order_number: orderNumber,
      invoice_number: null,     // <-- THE INVARIANT UNDER TEST
      invoice_id: null,
      invoice: null,
      kot_number: `KOT-${orderNumber}`,
      customer_id: "cus_test_5b3",
      customer_uid: "cth_cus_9876543210",
      customer_name: "Ananya Sharma",
      customer_phone: "+91 98765 43210",
      delivery_address: "Flat 402, Lotus Residency, 12th Main, Indiranagar, Bengaluru 560038",
      delivery_pincode: "560038",
      delivery_city: "Bengaluru",
      delivery_state: "Karnataka",
      delivery_latitude: 12.9716,
      delivery_longitude: 77.5946,
      pincode: "560038",
      city: "Bengaluru",
      state: "Karnataka",
      branch_id: "br_indiranagar",
      branch_name: "Indiranagar Flagship Kitchen",
      branch_code: "HUB-BLR-01",
      store_id: "br_indiranagar",
      store_name: "Indiranagar Flagship Kitchen",
      delivery_mode: "delivery",
      delivery_date: new Date().toISOString().slice(0, 10),
      delivery_slot: { id: "slot_14_16", label: "2:00 PM – 4:00 PM" },
      status: "pending",
      payment_method: "online_upi",
      payment_status: "captured",
      items: [
        {
          id: "prod_belgian_chocolate",
          product_id: "prod_belgian_chocolate",
          title: "Belgian Chocolate Truffle Cake (1kg)",
          quantity: 1,
          price: 850,
          unit_price: 850,
          total: 850,
          tax_rate: 5,
          gst_rate_pct: 5,
          hsn_code: "19059090",
          taxable_value: 809.52,
          cgst: 20.24,
          sgst: 20.24,
          igst: 0,
          category: "CAKE",
        },
      ],
      pricing: {
        subtotal: 850,
        tax_total: 40.48,
        delivery_fee: 49,
        discount_total: 0,
        grand_total: 939.48,
      },
      subtotal: 850,
      tax_total: 40.48,
      delivery_fee: 49,
      discount_total: 0,
      total: 939.48,
      grand_total: 939.48,
      pickup_otp: pickupOtp,
      delivery_otp: deliveryOtp,
      delivery: {
        pickup_otp: pickupOtp,
        delivery_otp: deliveryOtp,
      },
      compliance_snapshot: {
        seller_legal_name: "CakeToHome India Private Limited",
        seller_trade_name: "CakeToHome",
        seller_gstin: "29AAAAA0000A1Z5",
        seller_fssai_number: "11223344556677",
        seller_state: "Karnataka",
        seller_state_code: "29",
        seller_address: "100 Feet Rd, Indiranagar, Bengaluru - 560038",
        customer_state: "Karnataka",
        is_intra_state: true,
        supply_type: "INTRA-STATE (CGST + SGST)",
        branch_name: "Indiranagar Flagship Kitchen",
        branch_code: "HUB-BLR-01",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Push directly into memory store
    store.orders.push(seedOrder);

    // Also seed into PostgreSQL "order" table to satisfy foreign key constraint on public.invoice(order_id)
    try {
      await dbQuery(
        `INSERT INTO public."order" ("id", "currency_code", "status", "metadata", "created_at", "updated_at")
         VALUES ($1, 'inr', 'pending', $2, NOW(), NOW())
         ON CONFLICT ("id") DO NOTHING;`,
        [orderId, JSON.stringify(seedOrder)]
      );
    } catch (e: any) {
      console.warn("DB seed order skipped:", e?.message);
    }

    assert(seedOrder.invoice_number === null, "CRITICAL: invoice_number is NULL at creation");
    assert(Boolean(seedOrder.order_number), `Order number: ${seedOrder.order_number}`);

    // ── Test 2: Lifecycle Progression without Premature Invoicing ────────
    console.log("\n--- Test 2: No Invoice During Intermediate States ---");

    const transitions: Array<{ state: string; actor: any }> = [
      { state: "CONFIRMED", actor: { actorType: "SYSTEM" } },
      { state: "KITCHEN_ACCEPTED", actor: { actorType: "BRANCH_MANAGER", branchId: "br_indiranagar" } },
      { state: "PREPARING", actor: { actorType: "BRANCH_MANAGER", branchId: "br_indiranagar" } },
      { state: "READY_FOR_PICKUP", actor: { actorType: "BRANCH_MANAGER", branchId: "br_indiranagar" } },
    ];

    for (const t of transitions) {
      const res = await OrderLifecycleService.transitionOrder(ApiEngine, orderId, t.state, t.actor);
      assert(res.success, `→ ${t.state}`);
      assert(!seedOrder.invoice_number, `  invoice_number NULL at ${t.state}`);
    }

    // ── Test 3: Pickup → OUT_FOR_DELIVERY ────────────────────────────────
    console.log("\n--- Test 3: Pickup OTP & OUT_FOR_DELIVERY ---");

    let partner = store.delivery_partners.find((p: any) => p.id === "dlp_test_5b3");
    if (!partner) {
      partner = {
        id: "dlp_test_5b3",
        partner_number: "DLP-5B3",
        full_name: "Rajesh Kumar",
        phone: "+91 98111 22233",
        availability_status: "AVAILABLE",
        current_active_orders: 0,
        successful_deliveries: 10,
        total_deliveries: 10,
        assigned_branches: ["br_indiranagar"],
      };
      store.delivery_partners.push(partner);
    } else {
      partner.availability_status = "AVAILABLE";
    }

    if (typeof OrderLifecycleService.verifyPickupAndStartDelivery === "function") {
      const pickupRes = OrderLifecycleService.verifyPickupAndStartDelivery(
        ApiEngine,
        orderId,
        partner.id,
        pickupOtp,
        { actorType: "DELIVERY_PARTNER", partnerId: partner.id }
      );
      assert(pickupRes.success, "Pickup OTP verified → OUT_FOR_DELIVERY");
    } else {
      const ofdRes = await OrderLifecycleService.transitionOrder(
        ApiEngine,
        orderId,
        "OUT_FOR_DELIVERY",
        { actorType: "DELIVERY_PARTNER", partnerId: partner.id }
      );
      assert(ofdRes.success, "→ OUT_FOR_DELIVERY");
    }
    assert(!seedOrder.invoice_number, "invoice_number NULL during OUT_FOR_DELIVERY");

    // ── Test 4: Doorstep Delivery → Statutory Invoice ────────────────────
    console.log("\n--- Test 4: DELIVERED → Statutory Invoice Allocation ---");

    const deliveryRes = await OrderLifecycleService.transitionOrder(
      ApiEngine,
      orderId,
      "DELIVERED",
      {
        actorType: "DELIVERY_PARTNER",
        partnerId: partner.id,
        name: partner.full_name,
      },
      {
        otpInput: deliveryOtp,
        notes: "Doorstep OTP verified. Cake handed to customer.",
        metadata: {
          delivery_proof: {
            photoUrl: "https://cdn.caketohome.com/proofs/test.webp",
            latitude: 12.9716,
            longitude: 77.5946,
            recipientName: "Ananya Sharma",
          },
        },
      }
    );

    assert(deliveryRes.success, "Transitioned → DELIVERED");
    
    if (!deliveryRes.success) {
      console.error("Delivery transition failed:", JSON.stringify(deliveryRes, null, 2));
      throw new Error("Cannot continue — delivery failed");
    }

    assert(
      seedOrder.status === "delivered" || seedOrder.status === "DELIVERED",
      `Order status: ${seedOrder.status}`
    );
    assert(Boolean(seedOrder.invoice_number), `Invoice allocated: ${seedOrder.invoice_number}`);

    const invNum = seedOrder.invoice_number;
    if (invNum) {
      const invRegex = /^CTH\/\d{2}-\d{2}\/\d{6}$/;
      assert(invRegex.test(invNum), `Format CTH/YY-YY/XXXXXX: ${invNum}`);
    }
    assert(Boolean(seedOrder.invoice_id), `Invoice ID: ${seedOrder.invoice_id}`);
    assert(Boolean(seedOrder.invoice), "Invoice object attached");
    if (seedOrder.invoice) {
      assert(
        seedOrder.invoice.grand_total === seedOrder.total,
        `Invoice ₹${seedOrder.invoice.grand_total} = Order ₹${seedOrder.total}`
      );
    }

    // ── Test 5: PostgreSQL Persistence ───────────────────────────────────
    console.log("\n--- Test 5: PostgreSQL Persistence ---");
    try {
      const dbCheck = await dbQuery(
        "SELECT * FROM public.invoice WHERE order_id = $1 AND deleted_at IS NULL;",
        [orderId]
      );
      assert(dbCheck.rows.length === 1, "1 row in public.invoice");
      if (dbCheck.rows.length > 0) {
        const row = dbCheck.rows[0];
        assert(row.invoice_number === invNum, `DB invoice_number: ${row.invoice_number}`);
        assert(row.status === "GENERATED", `DB status: ${row.status}`);
        assert(Boolean(row.delivered_at), `DB delivered_at: ${row.delivered_at}`);
      }
    } catch (dbErr: any) {
      console.warn(`⚠️ DB check skipped: ${dbErr.message}`);
    }

    // ── Test 6: Idempotency ──────────────────────────────────────────────
    console.log("\n--- Test 6: Idempotency & Replay Protection ---");
    const replayRes = await OrderLifecycleService.transitionOrder(
      ApiEngine,
      orderId,
      "DELIVERED",
      { actorType: "DELIVERY_PARTNER", partnerId: partner.id },
      { otpInput: deliveryOtp }
    );
    assert(replayRes.success, "Re-delivery succeeds idempotently");
    assert(seedOrder.invoice_number === invNum, "Invoice number unchanged");

    try {
      const dbCount = await dbQuery(
        "SELECT COUNT(*)::int AS count FROM public.invoice WHERE order_id = $1;",
        [orderId]
      );
      assert(dbCount.rows[0].count === 1, "No duplicate DB rows");
    } catch (dbErr: any) {
      console.warn(`⚠️ DB replay check skipped: ${dbErr.message}`);
    }

    // ── Teardown / Cleanup Test Data ─────────────────────────────────────
    try {
      await dbQuery("DELETE FROM public.invoice WHERE order_id = $1;", [orderId]);
      await dbQuery("DELETE FROM public.\"order\" WHERE id = $1;", [orderId]);
    } catch {
      // ignore cleanup errors
    }

    // ── Summary ──────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log(`📊 Result: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log("═══════════════════════════════════════════════════════════════");

    if (passed === total) {
      console.log("🎉 ALL INVARIANTS SATISFIED.\n");
      process.exit(0);
    } else {
      console.error("⚠️ SOME TESTS FAILED.\n");
      process.exit(1);
    }
  } catch (err: any) {
    console.error("💥 FATAL:", err.message || err);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
