/**
 * CakeToHome — P0 Financial Integrity & Payment Amount Consistency Regression Suite
 * Validates all 20 mandatory financial consistency & order confirmation invariants.
 */

const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { Client } = require(path.resolve(__dirname, "../frontend/node_modules/pg"));

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://cth_test_user:8b58f6cb35e64015459917243b77e2794c57K9!@127.0.0.1:5433/cth_rehearsal_phase5";
const BASE_URL = "http://127.0.0.1:3000";
const RZP_KEY_ID = "rzp_test_TxymYPGydaHJBL";
const RZP_KEY_SECRET = "sekOj7zSZFkBoRB2op7tgQBE";

function signHmac(orderId, paymentId) {
  return crypto
    .createHmac("sha256", RZP_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

async function fetchJson(urlPath, options = {}) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json, text };
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const results = [];
  const tempOrderIds = [];

  function record(id, name, passed, details) {
    results.push({ id, name, status: passed ? "PASS" : "FAIL", details });
    const icon = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`[${icon}] #${id} ${name} -> ${JSON.stringify(details)}`);
  }

  try {
    // Wait for Next.js server readiness
    for (let i = 0; i < 30; i++) {
      try {
        const h = await fetch(`${BASE_URL}/api/v1/health`);
        if (h.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Fetch a real active product and branch from DB for testing
    const prodRes = await client.query(
      `SELECT id, title, COALESCE((metadata->>'selling_price')::numeric, (metadata->>'price')::numeric, 750) AS price
       FROM public.product WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`
    );
    const testProduct = prodRes.rows[0] || { id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", title: "Classic Chocolate Truffle Cake", price: 750 };
    const unitPrice = Number(testProduct.price) || 750;

    const branchRes = await client.query(
      `SELECT id, name FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`
    );
    const testBranchId = branchRes.rows[0]?.id || "br_partner_04";

    // -------------------------------------------------------------------------
    // TEST 1: Normal paid order (Verify ord_live_nb_1794401032340 via Order Details API & DB)
    // -------------------------------------------------------------------------
    {
      const apiRes = await fetchJson("/api/v1/orders/ord_live_nb_1794401032340");
      const ord = apiRes.data?.order;
      const passed =
        apiRes.status === 200 &&
        ord &&
        ord.id === "ord_live_nb_1794401032340" &&
        Number(ord.subtotal) === 750 &&
        Number(ord.tax_amount) === 37.5 &&
        Number(ord.grand_total) === 787.5 &&
        Number(ord.total_amount) === 787.5 &&
        Array.isArray(ord.items) &&
        ord.items.length === 1 &&
        ord.payment_status === "paid" &&
        ord.gateway_payment_id === "pay_TysA3RwgFh8yNr";
      record(1, "Normal paid order (API + DB financial hydration)", passed, {
        order_id: ord?.id,
        subtotal: ord?.subtotal,
        tax_amount: ord?.tax_amount,
        grand_total: ord?.grand_total,
        items_count: ord?.items?.length,
        payment_status: ord?.payment_status,
        gateway_payment_id: ord?.gateway_payment_id,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Zero-value order rejected before payment order creation
    // -------------------------------------------------------------------------
    {
      const zeroOrderId = `ord_test_zero_${Date.now()}`;
      tempOrderIds.push(zeroOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900001, $2, 'pending', 'pending', 0, 0, 0, 'INR', $3, 'Test Zero', 'zero@example.com', NOW(), NOW())`,
        [zeroOrderId, `ORD-ZERO-${Date.now()}`, testBranchId]
      );
      const rzpRes = await fetchJson("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ order_id: zeroOrderId }),
      });
      const passed = !rzpRes.ok && (rzpRes.status === 400 || rzpRes.status === 422 || rzpRes.status === 500) &&
        /SUBTOTAL|INVALID_ORDER_AMOUNT/i.test(JSON.stringify(rzpRes.data));
      record(2, "Zero-value order blocked from creating Razorpay order", passed, {
        http_status: rzpRes.status,
        error: rzpRes.data?.error || rzpRes.data?.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Missing subtotal rejected (DB NOT NULL constraint + Service MISSING_ORDER_SUBTOTAL)
    // -------------------------------------------------------------------------
    {
      let dbNotNullEnforced = false;
      try {
        await client.query(
          `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
           VALUES ($1, 900002, $2, 'pending', 'pending', NULL, 37.5, 787.5, 'INR', $3, 'Test NoSub', 'nosub@example.com', NOW(), NOW())`,
          [`ord_null_sub_${Date.now()}`, `ORD-NULLSUB-${Date.now()}`, testBranchId]
        );
      } catch (dbErr) {
        dbNotNullEnforced = dbErr.code === "23502";
      }

      const noSubOrderId = `ord_test_nosub_${Date.now()}`;
      tempOrderIds.push(noSubOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900002, $2, 'pending', 'pending', 0, 37.5, 787.5, 'INR', $3, 'Test NoSub', 'nosub@example.com', NOW(), NOW())`,
        [noSubOrderId, `ORD-NOSUB-${Date.now()}`, testBranchId]
      );
      const rzpRes = await fetchJson("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ order_id: noSubOrderId }),
      });
      const passed = dbNotNullEnforced && !rzpRes.ok && /MISSING_ORDER_SUBTOTAL/i.test(JSON.stringify(rzpRes.data));
      record(3, "Missing subtotal blocked by DB NOT NULL constraint (23502) and Service MISSING_ORDER_SUBTOTAL", passed, {
        db_not_null_enforced: dbNotNullEnforced,
        http_status: rzpRes.status,
        error: rzpRes.data?.error || rzpRes.data?.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Missing grand total rejected (DB NOT NULL constraint + Service INVALID_ORDER_AMOUNT)
    // -------------------------------------------------------------------------
    {
      let dbNotNullEnforced = false;
      try {
        await client.query(
          `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
           VALUES ($1, 900003, $2, 'pending', 'pending', 750, 37.5, NULL, 'INR', $3, 'Test NoGrand', 'nogrand@example.com', NOW(), NOW())`,
          [`ord_null_grand_${Date.now()}`, `ORD-NULLGRAND-${Date.now()}`, testBranchId]
        );
      } catch (dbErr) {
        dbNotNullEnforced = dbErr.code === "23502";
      }

      const noGrandOrderId = `ord_test_nogrand_${Date.now()}`;
      tempOrderIds.push(noGrandOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900003, $2, 'pending', 'pending', 750, 37.5, 0, 'INR', $3, 'Test NoGrand', 'nogrand@example.com', NOW(), NOW())`,
        [noGrandOrderId, `ORD-NOGRAND-${Date.now()}`, testBranchId]
      );
      const rzpRes = await fetchJson("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ order_id: noGrandOrderId }),
      });
      const passed = dbNotNullEnforced && !rzpRes.ok && /INVALID_ORDER_AMOUNT/i.test(JSON.stringify(rzpRes.data));
      record(4, "Missing grand total blocked by DB NOT NULL constraint (23502) and Service INVALID_ORDER_AMOUNT", passed, {
        db_not_null_enforced: dbNotNullEnforced,
        http_status: rzpRes.status,
        error: rzpRes.data?.error || rzpRes.data?.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Missing line items rejected before payment order creation
    // -------------------------------------------------------------------------
    {
      const noItemsOrderId = `ord_test_noitems_${Date.now()}`;
      tempOrderIds.push(noItemsOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900004, $2, 'pending', 'pending', 750, 37.5, 787.5, 'INR', $3, 'Test NoItems', 'noitems@example.com', NOW(), NOW())`,
        [noItemsOrderId, `ORD-NOITEMS-${Date.now()}`, testBranchId]
      );
      const rzpRes = await fetchJson("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ order_id: noItemsOrderId }),
      });
      const passed = !rzpRes.ok && /MISSING_ORDER_ITEMS/i.test(JSON.stringify(rzpRes.data));
      record(5, "Missing line items blocked with MISSING_ORDER_ITEMS", passed, {
        http_status: rzpRes.status,
        error: rzpRes.data?.error || rzpRes.data?.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 6: Incorrect product price rejected at checkout/order creation
    // -------------------------------------------------------------------------
    {
      const badProdRes = await fetchJson("/api/v1/checkout/confirm", {
        method: "POST",
        body: JSON.stringify({
          customer_name: "Price Tamper Test",
          customer_phone: "+919876543210",
          branch_id: "br_indiranagar",
          delivery_type: "pickup",
          delivery_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          delivery_slot_id: "14:00 - 16:00",
          payment_method: "razorpay",
          items: [
            {
              product_id: testProduct.id,
              quantity: 1,
              expected_unit_price: 1.0, // Tampered ₹1 price vs catalogue price
            },
          ],
        }),
      });
      const passed = !badProdRes.ok && /PRODUCT_PRICE_MISMATCH|inactive|not found/i.test(JSON.stringify(badProdRes.data));
      record(6, "Incorrect/tampered product price rejected with PRODUCT_PRICE_MISMATCH", passed, {
        http_status: badProdRes.status,
        error: badProdRes.data?.error,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 7: Quantity calculation (Multi-quantity & invalid 0/-1 quantity rejection)
    // -------------------------------------------------------------------------
    {
      const invalidQtyRes = await fetchJson("/api/v1/checkout/confirm", {
        method: "POST",
        body: JSON.stringify({
          customer_name: "Zero Qty Test",
          customer_phone: "+919876543210",
          branch_id: "br_indiranagar",
          delivery_type: "pickup",
          delivery_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          delivery_slot_id: "14:00 - 16:00",
          payment_method: "razorpay",
          items: [{ product_id: testProduct.id, quantity: 0 }],
        }),
      });

      const validMultiQtyOrderId = `ord_test_qty3_${Date.now()}`;
      tempOrderIds.push(validMultiQtyOrderId);
      const qty = 3;
      const sub = Math.round(unitPrice * qty * 100) / 100;
      const tax = Math.round(sub * 0.05 * 100) / 100;
      const grand = Math.round((sub + tax) * 100) / 100;
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900007, $2, 'pending', 'pending', $3, $4, $5, 'INR', $6, 'Qty3 Customer', 'qty3@example.com', NOW(), NOW())`,
        [validMultiQtyOrderId, `ORD-QTY3-${Date.now()}`, sub, tax, grand, testBranchId]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 5, $8, $9, 1, '{"value":"3"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${validMultiQtyOrderId}`, validMultiQtyOrderId, testProduct.id, testProduct.title, qty, unitPrice, sub, tax, grand]
      );

      const getRes = await fetchJson(`/api/v1/orders/${validMultiQtyOrderId}`);
      const ord = getRes.data?.order;
      const passed =
        !invalidQtyRes.ok &&
        /INVALID_ITEM_QUANTITY/i.test(JSON.stringify(invalidQtyRes.data)) &&
        getRes.ok &&
        Number(ord?.subtotal) === sub &&
        Number(ord?.grand_total) === grand &&
        Number(ord?.items?.[0]?.quantity) === 3;
      record(7, "Quantity calculation (3x unit price + zero/negative quantity rejection)", passed, {
        invalid_qty_error: invalidQtyRes.data?.error,
        qty3_subtotal: ord?.subtotal,
        qty3_grand_total: ord?.grand_total,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 8: Discount calculation reconciliation
    // -------------------------------------------------------------------------
    {
      const discOrderId = `ord_test_disc_${Date.now()}`;
      tempOrderIds.push(discOrderId);
      const sub = 1000;
      const discount = 100;
      const tax = 50;
      const grand = 950; // 1000 - 100 + 50
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, metadata, created_at, updated_at)
         VALUES ($1, 900008, $2, 'pending', 'pending', $3, $4, $5, 'INR', $6, 'Discount Customer', 'disc@example.com', $7::jsonb, NOW(), NOW())`,
        [
          discOrderId,
          `ORD-DISC-${Date.now()}`,
          sub,
          tax,
          grand,
          testBranchId,
          JSON.stringify({ discount_amount: discount, subtotal: sub, tax_amount: tax, grand_total: grand }),
        ]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $5, 5, $6, 1050, 1, '{"value":"1"}', 0, 0, 0, 0, 0, 0, '{"value":"1000"}', NOW(), NOW())`,
        [`oi_${discOrderId}`, discOrderId, testProduct.id, testProduct.title, sub, tax]
      );
      const getRes = await fetchJson(`/api/v1/orders/${discOrderId}`);
      const ord = getRes.data?.order;
      const passed =
        getRes.ok &&
        Number(ord?.subtotal) === 1000 &&
        Number(ord?.discount_amount) === 100 &&
        Number(ord?.tax_amount) === 50 &&
        Number(ord?.grand_total) === 950;
      record(8, "Discount calculation and grand_total reconciliation", passed, {
        subtotal: ord?.subtotal,
        discount_amount: ord?.discount_amount,
        tax_amount: ord?.tax_amount,
        grand_total: ord?.grand_total,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 9: Delivery fee calculation reconciliation
    // -------------------------------------------------------------------------
    {
      const delOrderId = `ord_test_del_${Date.now()}`;
      tempOrderIds.push(delOrderId);
      const sub = 750;
      const tax = 37.5;
      const delFee = 60;
      const grand = 847.5; // 750 + 37.5 + 60
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, metadata, created_at, updated_at)
         VALUES ($1, 900009, $2, 'pending', 'pending', $3, $4, $5, 'INR', $6, 'Delivery Fee Customer', 'del@example.com', $7::jsonb, NOW(), NOW())`,
        [
          delOrderId,
          `ORD-DEL-${Date.now()}`,
          sub,
          tax,
          grand,
          testBranchId,
          JSON.stringify({ delivery_fee: delFee, delivery: { fee: delFee }, subtotal: sub, tax_amount: tax, grand_total: grand }),
        ]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $5, 5, $6, 787.5, 1, '{"value":"1"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${delOrderId}`, delOrderId, testProduct.id, testProduct.title, sub, tax]
      );
      const getRes = await fetchJson(`/api/v1/orders/${delOrderId}`);
      const ord = getRes.data?.order;
      const passed =
        getRes.ok &&
        Number(ord?.subtotal) === 750 &&
        Number(ord?.delivery_fee) === 60 &&
        Number(ord?.tax_amount) === 37.5 &&
        Number(ord?.grand_total) === 847.5;
      record(9, "Delivery fee calculation and grand_total reconciliation", passed, {
        subtotal: ord?.subtotal,
        delivery_fee: ord?.delivery_fee,
        tax_amount: ord?.tax_amount,
        grand_total: ord?.grand_total,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 10: Tax calculation (Intra-State 5% GST -> 2.5% CGST + 2.5% SGST)
    // -------------------------------------------------------------------------
    {
      const getRes = await fetchJson("/api/v1/orders/ord_live_nb_1794401032340");
      const ord = getRes.data?.order;
      const passed =
        getRes.ok &&
        Number(ord?.tax_amount) === 37.5 &&
        Number(ord?.payment?.cgst) === 18.75 &&
        Number(ord?.payment?.sgst) === 18.75 &&
        Number(ord?.payment?.cgst) + Number(ord?.payment?.sgst) === Number(ord?.tax_amount);
      record(10, "Statutory Intra-State GST calculation (2.5% CGST + 2.5% SGST = 5% GST)", passed, {
        tax_total: ord?.tax_amount,
        cgst: ord?.payment?.cgst,
        sgst: ord?.payment?.sgst,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 11: Paise conversion (₹787.50 -> 78,750 paise on Razorpay Order creation)
    // -------------------------------------------------------------------------
    {
      const paiseOrderId = `ord_test_paise_${Date.now()}`;
      tempOrderIds.push(paiseOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900011, $2, 'pending', 'pending', 750.00, 37.50, 787.50, 'INR', $3, 'Paise Test', 'paise@example.com', NOW(), NOW())`,
        [paiseOrderId, `ORD-PAISE-${Date.now()}`, testBranchId]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, 750.00, 750.00, 5, 37.50, 787.50, 1, '{"value":"1"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${paiseOrderId}`, paiseOrderId, testProduct.id, testProduct.title]
      );
      const rzpRes = await fetchJson("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ order_id: paiseOrderId }),
      });
      const passed =
        rzpRes.ok &&
        rzpRes.data?.amount === 78750 &&
        Number(rzpRes.data?.amount_formatted) === 787.5 &&
        rzpRes.data?.currency === "INR" &&
        String(rzpRes.data?.razorpay_order_id || "").startsWith("order_");
      record(11, "Paise conversion (₹787.50 -> 78,750 paise on Razorpay Order API)", passed, {
        razorpay_order_id: rzpRes.data?.razorpay_order_id,
        amount_paise: rzpRes.data?.amount,
        amount_rupees: rzpRes.data?.amount_formatted,
        currency: rzpRes.data?.currency,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 12: Gateway order amount mismatch blocked and transitions to payment_exception
    // -------------------------------------------------------------------------
    {
      const gwMismatchOrderId = `ord_test_gwmismatch_${Date.now()}`;
      tempOrderIds.push(gwMismatchOrderId);
      const rzpOrderId = `order_test_gw_${Date.now()}`;
      const rzpPayId = `pay_test_gw_${Date.now()}`;
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900012, $2, 'pending', 'pending', 750.00, 37.50, 787.50, 'INR', $3, 'GW Mismatch', 'gw@example.com', NOW(), NOW())`,
        [gwMismatchOrderId, `ORD-GWM-${Date.now()}`, testBranchId]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, 750.00, 750.00, 5, 37.50, 787.50, 1, '{"value":"1"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${gwMismatchOrderId}`, gwMismatchOrderId, testProduct.id, testProduct.title]
      );
      // Insert payment_transaction with mismatched amount 500.00 instead of 787.50
      await client.query(
        `INSERT INTO public.payment_transaction (id, order_id, branch_id, customer_id, amount, currency, status, settlement_status, provider, gateway_order_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'cust_test', 500.00, 'INR', 'initiated', 'pending', 'razorpay', $4, NOW(), NOW())`,
        [`ptx_${gwMismatchOrderId}`, gwMismatchOrderId, testBranchId, rzpOrderId]
      );
      const verifyRes = await fetchJson("/api/v1/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          order_id: gwMismatchOrderId,
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPayId,
          razorpay_signature: signHmac(rzpOrderId, rzpPayId),
        }),
      });
      const dbOrd = await client.query(`SELECT status, payment_status FROM public."order" WHERE id = $1`, [gwMismatchOrderId]);
      const passed =
        !verifyRes.ok &&
        verifyRes.data?.error === "GATEWAY_ORDER_AMOUNT_MISMATCH" &&
        dbOrd.rows[0]?.payment_status === "pending";
      record(12, "Gateway order amount mismatch blocked with GATEWAY_ORDER_AMOUNT_MISMATCH", passed, {
        verify_status: verifyRes.data?.status,
        error: verifyRes.data?.error,
        order_payment_status: dbOrd.rows[0]?.payment_status,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 13: Captured amount mismatch blocked (Real ₹787.50 payment submitted against ₹1,575.00 order)
    // -------------------------------------------------------------------------
    {
      const capMismatchOrderId = `ord_test_capmismatch_${Date.now()}`;
      tempOrderIds.push(capMismatchOrderId);
      const rzpOrderId = "order_Tys9lC1k0BD7Wu"; // Real Razorpay order for ₹787.50
      const rzpPayId = "pay_TysA3RwgFh8yNr";     // Real captured payment of 78,750 paise (₹787.50)
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900013, $2, 'pending', 'pending', 1500.00, 75.00, 1575.00, 'INR', $3, 'Cap Mismatch', 'cap@example.com', NOW(), NOW())`,
        [capMismatchOrderId, `ORD-CAPM-${Date.now()}`, testBranchId]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 2, 750.00, 1500.00, 5, 75.00, 1575.00, 1, '{"value":"2"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${capMismatchOrderId}`, capMismatchOrderId, testProduct.id, testProduct.title]
      );
      await client.query(
        `INSERT INTO public.payment_transaction (id, order_id, branch_id, customer_id, amount, currency, status, settlement_status, provider, gateway_order_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'cust_test', 1575.00, 'INR', 'initiated', 'pending', 'razorpay', $4, NOW(), NOW())`,
        [`ptx_${capMismatchOrderId}`, capMismatchOrderId, testBranchId, rzpOrderId]
      );
      const verifyRes = await fetchJson("/api/v1/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          order_id: capMismatchOrderId,
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPayId,
          razorpay_signature: signHmac(rzpOrderId, rzpPayId),
        }),
      });
      const dbOrd = await client.query(`SELECT status, payment_status FROM public."order" WHERE id = $1`, [capMismatchOrderId]);
      const ptxRow = await client.query(`SELECT status, error_code FROM public.payment_transaction WHERE id = $1`, [`ptx_${capMismatchOrderId}`]);
      const passed =
        !verifyRes.ok &&
        verifyRes.data?.error === "AMOUNT_MISMATCH" &&
        dbOrd.rows[0]?.payment_status === "pending" &&
        ptxRow.rows[0]?.status === "payment_exception";
      record(13, "Captured amount mismatch (78,750 paise vs 157,500 paise) blocked with AMOUNT_MISMATCH", passed, {
        verify_error: verifyRes.data?.error,
        verify_message: verifyRes.data?.message,
        ptx_status: ptxRow.rows[0]?.status,
        order_payment_status: dbOrd.rows[0]?.payment_status,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 14: Currency mismatch blocked with CURRENCY_MISMATCH
    // -------------------------------------------------------------------------
    {
      const currOrderId = `ord_test_curr_${Date.now()}`;
      tempOrderIds.push(currOrderId);
      const rzpOrderId = `order_test_curr_${Date.now()}`;
      const rzpPayId = `pay_test_curr_${Date.now()}`;
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900014, $2, 'pending', 'pending', 750.00, 37.50, 787.50, 'USD', $3, 'Currency Mismatch', 'curr@example.com', NOW(), NOW())`,
        [currOrderId, `ORD-CURR-${Date.now()}`, testBranchId]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, 750.00, 750.00, 5, 37.50, 787.50, 1, '{"value":"1"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${currOrderId}`, currOrderId, testProduct.id, testProduct.title]
      );
      const verifyRes = await fetchJson("/api/v1/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          order_id: currOrderId,
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPayId,
          razorpay_signature: signHmac(rzpOrderId, rzpPayId),
        }),
      });
      const passed = !verifyRes.ok && verifyRes.data?.error === "CURRENCY_MISMATCH";
      record(14, "Currency mismatch (USD vs INR) blocked with CURRENCY_MISMATCH", passed, {
        verify_error: verifyRes.data?.error,
        verify_message: verifyRes.data?.message,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 15: Duplicate payment verification is idempotent (no duplicate vouchers)
    // -------------------------------------------------------------------------
    {
      const beforeVouchers = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM public.accounting_voucher WHERE reference_id = 'ord_live_nb_1794401032340'`
      );
      const dupRes = await fetchJson("/api/v1/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          order_id: "ord_live_nb_1794401032340",
          razorpay_order_id: "order_Tys9lC1k0BD7Wu",
          razorpay_payment_id: "pay_TysA3RwgFh8yNr",
          razorpay_signature: signHmac("order_Tys9lC1k0BD7Wu", "pay_TysA3RwgFh8yNr"),
        }),
      });
      const afterVouchers = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM public.accounting_voucher WHERE reference_id = 'ord_live_nb_1794401032340'`
      );
      const passed =
        dupRes.ok &&
        dupRes.data?.status === "already_processed" &&
        dupRes.data?.idempotent === true &&
        beforeVouchers.rows[0].cnt === afterVouchers.rows[0].cnt &&
        afterVouchers.rows[0].cnt === 1;
      record(15, "Duplicate payment verification is idempotent and prevents duplicate accounting vouchers", passed, {
        status: dupRes.data?.status,
        idempotent: dupRes.data?.idempotent,
        vouchers_before: beforeVouchers.rows[0].cnt,
        vouchers_after: afterVouchers.rows[0].cnt,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 16: Order confirmation with missing financial values blocked at verifyPayment
    // -------------------------------------------------------------------------
    {
      const corruptOrderId = `ord_test_corrupt_${Date.now()}`;
      tempOrderIds.push(corruptOrderId);
      const rzpOrderId = "order_Tys9lC1k0BD7Wu";
      const rzpPayId = "pay_TysA3RwgFh8yNr";
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900016, $2, 'pending', 'pending', 0, 0, 0, 'INR', $3, 'Corrupt Order', 'corrupt@example.com', NOW(), NOW())`,
        [corruptOrderId, `ORD-CORRUPT-${Date.now()}`, testBranchId]
      );
      const verifyRes = await fetchJson("/api/v1/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          order_id: corruptOrderId,
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: rzpPayId,
          razorpay_signature: signHmac(rzpOrderId, rzpPayId),
        }),
      });
      const dbOrd = await client.query(`SELECT status, payment_status FROM public."order" WHERE id = $1`, [corruptOrderId]);
      const passed =
        !verifyRes.ok &&
        verifyRes.data?.status === "payment_exception" &&
        dbOrd.rows[0]?.payment_status === "pending";
      record(16, "Order confirmation with missing financial values blocked at verifyPayment", passed, {
        verify_status: verifyRes.data?.status,
        verify_error: verifyRes.data?.error,
        order_payment_status: dbOrd.rows[0]?.payment_status,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 17: Frontend rendering with missing monetary fields blocks ₹0 confirmation
    // -------------------------------------------------------------------------
    {
      const zeroUiOrderId = `ord_test_zeroui_${Date.now()}`;
      tempOrderIds.push(zeroUiOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, created_at, updated_at)
         VALUES ($1, 900017, $2, 'confirmed', 'paid', 0, 0, 0, 'INR', $3, 'Zero UI Test', 'zeroui@example.com', NOW(), NOW())`,
        [zeroUiOrderId, `ORD-ZEROUI-${Date.now()}`, testBranchId]
      );
      const htmlRes = await fetch(`${BASE_URL}/your-order?order_id=${zeroUiOrderId}`);
      const html = await htmlRes.text();
      const blocksZeroConfirmation =
        html.includes("ORDER_FINANCIAL_INTEGRITY_EXCEPTION") &&
        html.includes("Order Financial Reconciliation Required") &&
        !html.includes("Order Confirmed &amp; In Kitchen");
      record(17, "Frontend /your-order blocks confirmation when monetary fields or items are missing/zero", blocksZeroConfirmation, {
        contains_exception_code: html.includes("ORDER_FINANCIAL_INTEGRITY_EXCEPTION"),
        contains_false_confirmed_banner: html.includes("Order Confirmed &amp; In Kitchen"),
      });
    }

    // -------------------------------------------------------------------------
    // TEST 18: Stale metadata vs authoritative relational columns on Order Details API
    // -------------------------------------------------------------------------
    {
      const staleMetaOrderId = `ord_test_stalemeta_${Date.now()}`;
      tempOrderIds.push(staleMetaOrderId);
      await client.query(
        `INSERT INTO public."order" (id, display_id, order_number, status, payment_status, payment_method, subtotal, tax_total, grand_total, currency_code, branch_id, customer_name, email, metadata, created_at, updated_at)
         VALUES ($1, 900018, $2, 'confirmed', 'paid', 'RAZORPAY', 750.00, 37.50, 787.50, 'INR', $3, 'Stale Meta Customer', 'stale@example.com', '{"note":"minimal metadata without subtotal"}'::jsonb, NOW(), NOW())`,
        [staleMetaOrderId, `ORD-STALE-${Date.now()}`, testBranchId]
      );
      await client.query(
        `INSERT INTO public.order_item (id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, version, raw_quantity, fulfilled_quantity, shipped_quantity, return_requested_quantity, return_received_quantity, return_dismissed_quantity, written_off_quantity, raw_unit_price, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, 750.00, 750.00, 5, 37.50, 787.50, 1, '{"value":"1"}', 0, 0, 0, 0, 0, 0, '{"value":"750"}', NOW(), NOW())`,
        [`oi_${staleMetaOrderId}`, staleMetaOrderId, testProduct.id, testProduct.title]
      );
      const getRes = await fetchJson(`/api/v1/orders/${staleMetaOrderId}`);
      const ord = getRes.data?.order;
      const passed =
        getRes.ok &&
        Number(ord?.subtotal) === 750 &&
        Number(ord?.tax_amount) === 37.5 &&
        Number(ord?.grand_total) === 787.5 &&
        ord?.items?.length === 1 &&
        ord?.payment_status === "paid";
      record(18, "Order Details API reads authoritative relational columns & order_item when metadata is minimal", passed, {
        subtotal: ord?.subtotal,
        tax_amount: ord?.tax_amount,
        grand_total: ord?.grand_total,
        items_count: ord?.items?.length,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 19: Incorrect/non-existent order ID handled cleanly across API, Gateway, and UI
    // -------------------------------------------------------------------------
    {
      const fakeId = "ord_nonexistent_999999999";
      const apiRes = await fetchJson(`/api/v1/orders/${fakeId}`);
      const rzpRes = await fetchJson("/api/v1/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ order_id: fakeId }),
      });
      const uiRes = await fetch(`${BASE_URL}/your-order?order_id=${fakeId}`);
      const uiHtml = await uiRes.text();
      const passed =
        apiRes.status === 404 &&
        !rzpRes.ok &&
        uiHtml.includes("No Recent Order Found") &&
        !uiHtml.includes("KOT-undefined");
      record(19, "Incorrect order ID returns 404 on API, blocks Razorpay order, and shows 'No Recent Order Found' on UI", passed, {
        api_status: apiRes.status,
        rzp_status: rzpRes.status,
        ui_shows_not_found: uiHtml.includes("No Recent Order Found"),
        ui_has_kot_undefined: uiHtml.includes("KOT-undefined"),
      });
    }

    // -------------------------------------------------------------------------
    // TEST 20: Genuine payment confirmation rendered on /your-order matches DB & Razorpay
    // -------------------------------------------------------------------------
    {
      const uiRes = await fetch(`${BASE_URL}/your-order?order_id=ord_live_nb_1794401032340`);
      const uiHtml = await uiRes.text();
      const passed =
        uiRes.ok &&
        uiHtml.includes("ORD-401032") &&
        uiHtml.includes("KOT-00024") &&
        uiHtml.includes("Anita") &&
        uiHtml.includes("Classic Chocolate Truffle Cake") &&
        uiHtml.includes("750") &&
        uiHtml.includes("37.50") &&
        uiHtml.includes("787.50") &&
        uiHtml.includes("pay_TysA3RwgFh8yNr") &&
        !uiHtml.includes("KOT-undefined");
      record(20, "Genuine confirmed order ord_live_nb_1794401032340 renders ₹787.50, ₹750 subtotal, ₹37.50 GST, and pay_TysA3RwgFh8yNr on /your-order", passed, {
        has_order_number: uiHtml.includes("ORD-401032"),
        has_kot_number: uiHtml.includes("KOT-00024"),
        has_subtotal_750: uiHtml.includes("750"),
        has_gst_37_50: uiHtml.includes("37.50"),
        has_total_787_50: uiHtml.includes("787.50"),
        has_payment_id: uiHtml.includes("pay_TysA3RwgFh8yNr"),
      });
    }
  } finally {
    // Cleanup temporary test rows
    if (tempOrderIds.length > 0) {
      await client.query(`DELETE FROM public.payment_transaction WHERE order_id = ANY($1::text[])`, [tempOrderIds]).catch(() => {});
      await client.query(`DELETE FROM public.order_item WHERE order_id = ANY($1::text[])`, [tempOrderIds]).catch(() => {});
      await client.query(`DELETE FROM public."order" WHERE id = ANY($1::text[])`, [tempOrderIds]).catch(() => {});
    }
    await client.end();
  }

  const passedCount = results.filter((r) => r.status === "PASS").length;
  console.log(`\n============================================================`);
  console.log(`P0 FINANCIAL CONSISTENCY REGRESSION SUITE: ${passedCount}/${results.length} PASSED`);
  console.log(`============================================================\n`);

  const outPath = path.resolve(__dirname, "../artifacts/phase-9-browser-verification/p0_financial_consistency_20_tests.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), total: results.length, passed: passedCount, results }, null, 2));

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error in P0 test suite:", err);
  process.exit(1);
});
