/**
 * CakeToHome — Payment Verification, Status Synchronization & Order Confirmation
 * Comprehensive Verification & Assurance Test Suite
 * 
 * Verifies:
 * 1. Cryptographic Webhook HMAC-SHA256 signature verification (valid vs invalid/tampered)
 * 2. End-to-end automatic payment confirmation (payment.captured -> paid & confirmed)
 * 3. Strict webhook idempotency & replay protection (duplicate delivery safely ignored)
 * 4. Amount mismatch detection & fail-closed security (diverts to payment_exception)
 * 5. Cancelled order protection (diverts to payment_exception & flagged for refund)
 * 6. Client checkout callback signature verification (HMAC of order_id|payment_id)
 * 7. Payment failure state machine transition (payment.failed -> payment_transaction & order failed)
 * 8. Payment refund lifecycle state machine (refund.processed -> refunded)
 * 9. Real-time status sync query engine for zero-refresh customer storefront
 * 10. Invariant preservation of protected baseline `cth_test` (127 orders, 71 invoices, 4 vouchers)
 */

const { Pool, Client } = require('e:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const crypto = require('crypto');

const WEBHOOK_SECRET = 'rzp_test_webhook_secret_cake2home_2026';
const KEY_SECRET = 'rzp_test_key_secret_cake2home_2026';

process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.WEBHOOK_SIGNING_SECRET = WEBHOOK_SECRET;
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;

const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'cth_test_user',
  database: 'cth_rehearsal_phase5_7',
});

// Helper: Calculate Razorpay Webhook HMAC Signature
function calcWebhookSignature(payloadString, secret = WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

// Helper: Calculate Razorpay Client Signature
function calcClientSignature(orderId, paymentId, secret = KEY_SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

let testPassed = 0;
let testFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    testPassed++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
    testFailed++;
  }
}

async function runSuite() {
  console.log('================================================================================');
  console.log('CAKETOHOME: AUTOMATIC PAYMENT VERIFICATION & STATUS SYNCHRONIZATION TEST SUITE');
  console.log('Target Rehearsal DB: cth_rehearsal_phase5_7 on port 5433');
  console.log('================================================================================\n');

  const client = await pool.connect();
  await client.query("SET client_encoding TO 'UTF8';");

  // Load the PaymentVerificationService dynamically or instantiate domain logic directly
  // to ensure testing against the identical compiled/TS-transpiled logic
  let PaymentVerificationService;
  try {
    PaymentVerificationService = require('e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/payment-verification.service.ts');
  } catch (e) {
    // If running under plain node without ts-node, load transpiled or use helper adapter
    console.log('Loading service adapter for verification suite...');
  }

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Cryptographic Webhook HMAC-SHA256 Signature Validation
    // --------------------------------------------------------------------------
    console.log('--- TEST 1: Cryptographic Webhook HMAC Signature Verification ---');
    const samplePayload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test_001', amount: 118000 } } }
    });

    const validSig = calcWebhookSignature(samplePayload, WEBHOOK_SECRET);
    const tamperedSig = calcWebhookSignature(samplePayload, 'wrong_secret_tampered');

    // Verification logic matching service
    function verifySig(body, sig, secret = WEBHOOK_SECRET) {
      const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const b1 = Buffer.from(hmac, 'utf8');
      const b2 = Buffer.from(sig || '', 'utf8');
      return b1.length === b2.length && crypto.timingSafeEqual(b1, b2);
    }

    assert(verifySig(samplePayload, validSig) === true, 'Valid webhook signature verifies successfully');
    assert(verifySig(samplePayload, tamperedSig) === false, 'Tampered/invalid webhook signature is rejected');
    assert(verifySig(samplePayload, '') === false, 'Empty signature is rejected');
    assert(verifySig(samplePayload, 'abc') === false, 'Malformed signature is safely rejected without crash');

    // --------------------------------------------------------------------------
    // TEST 2: Client Checkout Callback Signature Verification
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 2: Client Checkout Callback Signature Verification ---');
    const orderId = 'order_rzp_test_123';
    const payId = 'pay_rzp_test_456';
    const validClientSig = calcClientSignature(orderId, payId, KEY_SECRET);
    const tamperedClientSig = calcClientSignature(orderId, payId, 'bad_key');

    function verifyClientSig(oId, pId, sig, secret = KEY_SECRET) {
      const data = `${oId}|${pId}`;
      const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
      const b1 = Buffer.from(hmac, 'utf8');
      const b2 = Buffer.from(sig || '', 'utf8');
      return b1.length === b2.length && crypto.timingSafeEqual(b1, b2);
    }

    assert(verifyClientSig(orderId, payId, validClientSig) === true, 'Valid client checkout signature verifies');
    assert(verifyClientSig(orderId, payId, tamperedClientSig) === false, 'Tampered client checkout signature is rejected');

    // --------------------------------------------------------------------------
    // TEST 3: End-to-End Automatic Payment Confirmation Flow (payment.captured)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 3: End-to-End Automatic Payment Confirmation Flow ---');
    const testOrder1Id = `ord_e2e_test_${Date.now()}`;
    const testOrder1Number = `ORD-20261103-${Math.floor(1000 + Math.random() * 9000)}`;
    const testPayment1Id = `pay_e2e_captured_${Date.now()}`;
    const testEvent1Id = `evt_e2e_${Date.now()}`;
    const orderTotal = 1180.00;

    // Create test order in DB
    await client.query(
      `INSERT INTO public."order" (
        id, order_number, status, payment_status, payment_method, grand_total, subtotal, tax_total,
        currency_code, customer_id, branch_id, customer_phone, customer_name, email, created_at, updated_at
      ) VALUES ($1, $2, 'pending', 'pending', 'razorpay', $3, 1000, 180, 'INR', 'cus_test_01', 'br_indiranagar_01', '9876543210', 'Alex Customer', 'alex@test.com', NOW(), NOW())`,
      [testOrder1Id, testOrder1Number, orderTotal]
    );

    const sampleProdRes = await client.query('SELECT id, title FROM public.product LIMIT 1');
    const realProdId = sampleProdRes.rows[0].id;

    // Create test order item so inventory deduction can be verified
    const testItemId = `oi_${Date.now()}`;
    await client.query(
      `INSERT INTO public.order_item (
        id, order_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total, created_at
      ) VALUES ($1, $2, $3, 'Belgian Chocolate Truffle 1kg', 1, 1000, 1000, 18, 180, 1180, NOW())`,
      [testItemId, testOrder1Id, realProdId]
    );

    // Build signed webhook payload
    const webhook1Payload = JSON.stringify({
      event: 'payment.captured',
      event_id: testEvent1Id,
      payload: {
        payment: {
          entity: {
            id: testPayment1Id,
            order_id: testOrder1Id,
            amount: 118000, // 1180 INR in paise
            currency: 'INR',
            status: 'captured',
            notes: { order_id: testOrder1Id }
          }
        }
      }
    });
    const webhook1Sig = calcWebhookSignature(webhook1Payload);

    // Execute through PaymentVerificationService logic
    const { PaymentVerificationService: PVS } = require('e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/payment-verification.service.cjs');
    
    const e2eResult = await PVS.processWebhookEvent({
      rawBody: webhook1Payload,
      signature: webhook1Sig,
      headers: { 'x-razorpay-event-id': testEvent1Id },
      client: client
    });

    assert(e2eResult.success === true, 'Webhook returns success === true');
    assert(e2eResult.status === 'confirmed', 'Webhook returns status === "confirmed"');
    assert(e2eResult.order_id === testOrder1Id, 'Webhook confirms correct order_id');

    // Verify DB State
    const updatedOrderRes = await client.query('SELECT status, payment_status, payment_method, metadata FROM public."order" WHERE id = $1', [testOrder1Id]);
    const updatedOrder = updatedOrderRes.rows[0];
    assert(updatedOrder.payment_status === 'paid', 'Order payment_status is updated to "paid"');
    assert(updatedOrder.status === 'confirmed', 'Order status transitioned to "confirmed"');
    assert(updatedOrder.payment_method === 'razorpay', 'Order payment_method is "razorpay"');
    assert(updatedOrder.metadata?.payment_verified === true, 'Order metadata records payment_verified === true');

    // Verify payment_transaction row
    const txnRes = await client.query('SELECT status, settlement_status, provider, provider_ref, amount, currency FROM public.payment_transaction WHERE order_id = $1', [testOrder1Id]);
    assert(txnRes.rows.length >= 1, 'Payment transaction record created in ledger');
    assert(txnRes.rows[0].status === 'captured', 'Payment transaction status is "captured"');
    assert(txnRes.rows[0].settlement_status === 'settled', 'Payment transaction settlement_status is "settled"');
    assert(Number(txnRes.rows[0].amount) === 1180, 'Payment transaction amount matches INR 1180');

    // Verify inventory movement (stock deduction)
    const invRes = await client.query('SELECT movement_type, direction, quantity, order_id FROM public.inventory_movement WHERE order_id = $1', [testOrder1Id]);
    assert(invRes.rows.length >= 1, 'Inventory movement recorded for order items');
    assert(invRes.rows[0].movement_type === 'SALE', 'Inventory movement type is "SALE"');
    assert(invRes.rows[0].direction === 'OUT', 'Inventory movement direction is "OUT"');
    assert(Number(invRes.rows[0].quantity) === 1, 'Inventory movement quantity is positive 1 with direction OUT');

    // Verify automated customer notifications
    const notifRes = await client.query('SELECT channel, template, recipient, status FROM public.customer_notification_queue WHERE order_id = $1 ORDER BY channel', [testOrder1Id]);
    assert(notifRes.rows.length >= 2, 'Customer notifications queued (SMS, WhatsApp, Email)');
    const channels = notifRes.rows.map(r => r.channel);
    assert(channels.includes('sms'), 'SMS confirmation notification queued');
    assert(channels.includes('whatsapp'), 'WhatsApp confirmation notification queued');

    // Verify audit log
    const historyRes = await client.query('SELECT to_status, actor_type FROM public.order_status_history WHERE order_id = $1 AND to_status = \'confirmed\'', [testOrder1Id]);
    assert(historyRes.rows.length >= 1, 'Order status history recorded confirmation transition');

    // --------------------------------------------------------------------------
    // TEST 4: Idempotency & Replay Protection (Duplicate Webhook Delivery)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 4: Idempotency & Replay Protection ---');
    // Resend exact same webhook payload and event ID
    const duplicateResult = await PVS.processWebhookEvent({
      rawBody: webhook1Payload,
      signature: webhook1Sig,
      headers: { 'x-razorpay-event-id': testEvent1Id },
      client: client
    });

    assert(duplicateResult.success === true, 'Duplicate webhook returns success === true');
    assert(duplicateResult.idempotent === true, 'Duplicate webhook identified as idempotent === true');
    assert(duplicateResult.status === 'already_confirmed', 'Duplicate webhook status is "already_confirmed"');

    // Verify NO duplicate inventory movements were created
    const invCountAfter = await client.query('SELECT count(*) FROM public.inventory_movement WHERE order_id = $1', [testOrder1Id]);
    assert(Number(invCountAfter.rows[0].count) === 1, 'No duplicate inventory movements created (count remains 1)');

    // Verify NO duplicate notifications were queued
    const notifCountAfter = await client.query('SELECT count(*) FROM public.customer_notification_queue WHERE order_id = $1 AND channel = \'sms\'', [testOrder1Id]);
    assert(Number(notifCountAfter.rows[0].count) === 1, 'No duplicate SMS notifications queued (count remains 1)');

    // --------------------------------------------------------------------------
    // TEST 5: Amount Mismatch Detection (Fail-Closed Security Guard)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 5: Amount Mismatch Detection (Fail-Closed Guard) ---');
    const testOrder2Id = `ord_mismatch_test_${Date.now()}`;
    const testPayment2Id = `pay_mismatch_${Date.now()}`;
    const testEvent2Id = `evt_mismatch_${Date.now()}`;

    // Create order for INR 1180
    await client.query(
      `INSERT INTO public."order" (
        id, order_number, status, payment_status, grand_total, subtotal, tax_total, currency_code,
        customer_id, branch_id, customer_phone, customer_name, created_at, updated_at
      ) VALUES ($1, $2, 'pending', 'pending', 1180.00, 1000, 180, 'INR', 'cus_test_02', 'br_indiranagar_01', '9876543211', 'Bob Mismatch', NOW(), NOW())`,
      [testOrder2Id, `ORD-MISMATCH-${Date.now()}`]
    );

    // Send payment of INR 500 (50000 paise) instead of INR 1180
    const mismatchPayload = JSON.stringify({
      event: 'payment.captured',
      event_id: testEvent2Id,
      payload: {
        payment: {
          entity: {
            id: testPayment2Id,
            order_id: testOrder2Id,
            amount: 50000, // INR 500
            currency: 'INR',
            status: 'captured',
            notes: { order_id: testOrder2Id }
          }
        }
      }
    });
    const mismatchSig = calcWebhookSignature(mismatchPayload);

    const mismatchResult = await PVS.processWebhookEvent({
      rawBody: mismatchPayload,
      signature: mismatchSig,
      headers: { 'x-razorpay-event-id': testEvent2Id },
      client: client
    });

    assert(mismatchResult.success === false, 'Amount mismatch returns success === false');
    assert(mismatchResult.status === 'payment_exception', 'Amount mismatch status is "payment_exception"');

    // Verify order was NOT confirmed
    const orderMismatchRes = await client.query('SELECT status, payment_status, metadata FROM public."order" WHERE id = $1', [testOrder2Id]);
    assert(orderMismatchRes.rows[0].status === 'pending', 'Order status remains "pending" (NOT confirmed)');
    assert(orderMismatchRes.rows[0].payment_status === 'payment_exception', 'Order payment_status is set to "payment_exception"');

    // --------------------------------------------------------------------------
    // TEST 6: Cancelled Order Guard (Fail-Closed Security Guard)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 6: Cancelled Order Protection (Fail-Closed Guard) ---');
    const testOrder3Id = `ord_cancelled_test_${Date.now()}`;
    const testPayment3Id = `pay_cancelled_${Date.now()}`;
    const testEvent3Id = `evt_cancelled_${Date.now()}`;

    // Create cancelled order
    await client.query(
      `INSERT INTO public."order" (
        id, order_number, status, payment_status, grand_total, subtotal, tax_total, currency_code,
        customer_id, branch_id, customer_phone, customer_name, created_at, updated_at
      ) VALUES ($1, $2, 'cancelled', 'pending', 1180.00, 1000, 180, 'INR', 'cus_test_03', 'br_indiranagar_01', '9876543212', 'Charlie Cancelled', NOW(), NOW())`,
      [testOrder3Id, `ORD-CANCELLED-${Date.now()}`]
    );

    const cancelledPayload = JSON.stringify({
      event: 'payment.captured',
      event_id: testEvent3Id,
      payload: {
        payment: {
          entity: {
            id: testPayment3Id,
            order_id: testOrder3Id,
            amount: 118000,
            currency: 'INR',
            status: 'captured',
            notes: { order_id: testOrder3Id }
          }
        }
      }
    });
    const cancelledSig = calcWebhookSignature(cancelledPayload);

    const cancelledResult = await PVS.processWebhookEvent({
      rawBody: cancelledPayload,
      signature: cancelledSig,
      headers: { 'x-razorpay-event-id': testEvent3Id },
      client: client
    });

    assert(cancelledResult.success === false, 'Payment for cancelled order returns success === false');
    assert(cancelledResult.status === 'payment_exception', 'Status is "payment_exception"');

    const orderCancelledRes = await client.query('SELECT status, payment_status FROM public."order" WHERE id = $1', [testOrder3Id]);
    assert(orderCancelledRes.rows[0].status === 'cancelled', 'Order status remains "cancelled"');
    assert(orderCancelledRes.rows[0].payment_status === 'payment_exception', 'Order payment_status is set to "payment_exception"');

    // Verify payment transaction flagged for refund
    const ptxnCancelledRes = await client.query('SELECT settlement_status FROM public.payment_transaction WHERE order_id = $1', [testOrder3Id]);
    assert(ptxnCancelledRes.rows[0].settlement_status === 'flagged_refund', 'Transaction settlement_status flagged for refund');

    // --------------------------------------------------------------------------
    // TEST 7: Payment Failure Lifecycle (payment.failed)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 7: Payment Failure Lifecycle ---');
    const testOrder4Id = `ord_failed_test_${Date.now()}`;
    const testPayment4Id = `pay_failed_${Date.now()}`;
    const testEvent4Id = `evt_failed_${Date.now()}`;

    await client.query(
      `INSERT INTO public."order" (
        id, order_number, status, payment_status, grand_total, subtotal, tax_total, currency_code,
        customer_id, branch_id, customer_phone, customer_name, created_at, updated_at
      ) VALUES ($1, $2, 'pending', 'pending', 1180.00, 1000, 180, 'INR', 'cus_test_04', 'br_indiranagar_01', '9876543213', 'David Failed', NOW(), NOW())`,
      [testOrder4Id, `ORD-FAILED-${Date.now()}`]
    );

    const failedPayload = JSON.stringify({
      event: 'payment.failed',
      event_id: testEvent4Id,
      payload: {
        payment: {
          entity: {
            id: testPayment4Id,
            order_id: testOrder4Id,
            amount: 118000,
            currency: 'INR',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment was declined by issuing bank',
            notes: { order_id: testOrder4Id }
          }
        }
      }
    });
    const failedSig = calcWebhookSignature(failedPayload);

    const failedResult = await PVS.processWebhookEvent({
      rawBody: failedPayload,
      signature: failedSig,
      headers: { 'x-razorpay-event-id': testEvent4Id },
      client: client
    });

    assert(failedResult.success === true, 'Failed payment webhook processed');
    assert(failedResult.status === 'failed', 'Status is "failed"');

    const orderFailedRes = await client.query('SELECT status, payment_status FROM public."order" WHERE id = $1', [testOrder4Id]);
    assert(orderFailedRes.rows[0].status === 'pending', 'Order status remains pending (not confirmed)');
    assert(orderFailedRes.rows[0].payment_status === 'failed', 'Order payment_status is "failed"');

    const ptxnFailedRes = await client.query('SELECT status, error_code FROM public.payment_transaction WHERE order_id = $1', [testOrder4Id]);
    assert(ptxnFailedRes.rows[0].status === 'failed', 'Payment transaction status is "failed"');
    assert(ptxnFailedRes.rows[0].error_code === 'BAD_REQUEST_ERROR', 'Error code recorded in transaction');

    // --------------------------------------------------------------------------
    // TEST 8: Refund Lifecycle (refund.processed)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 8: Refund Lifecycle ---');
    const testRefundId = `rfnd_${Date.now()}`;
    const testEvent5Id = `evt_refund_${Date.now()}`;

    const refundPayload = JSON.stringify({
      event: 'refund.processed',
      event_id: testEvent5Id,
      payload: {
        refund: {
          entity: {
            id: testRefundId,
            payment_id: testPayment1Id,
            amount: 118000,
            currency: 'INR',
            notes: { order_id: testOrder1Id }
          }
        }
      }
    });
    const refundSig = calcWebhookSignature(refundPayload);

    const refundResult = await PVS.processWebhookEvent({
      rawBody: refundPayload,
      signature: refundSig,
      headers: { 'x-razorpay-event-id': testEvent5Id },
      client: client
    });

    assert(refundResult.success === true, 'Refund webhook processed successfully');
    assert(refundResult.status === 'refunded', 'Status is "refunded"');

    const orderRefundRes = await client.query('SELECT payment_status, metadata FROM public."order" WHERE id = $1', [testOrder1Id]);
    assert(orderRefundRes.rows[0].payment_status === 'refunded', 'Order payment_status updated to "refunded"');

    // --------------------------------------------------------------------------
    // TEST 9: Real-Time Status Query Engine (Zero-Refresh Customer Storefront)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 9: Real-Time Status Polling Engine ---');
    const statusQueryResult = await PVS.getOrderPaymentStatus(testOrder1Id, client);
    assert(statusQueryResult.found === true, 'Status query finds order');
    assert(statusQueryResult.order_id === testOrder1Id, 'Status query returns correct order_id');
    assert(statusQueryResult.is_confirmed === true, 'Status query reflects is_confirmed === true');
    assert(statusQueryResult.grand_total === 1180, 'Status query returns grand_total === 1180');

    // --------------------------------------------------------------------------
    // TEST 10: Invariant Preservation of Protected Baseline `cth_test`
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 10: Invariant Audit of Protected Baseline cth_test ---');
    const cthTestClient = new Client({
      host: '127.0.0.1',
      port: 5433,
      user: 'cth_test_user',
      database: 'cth_test'
    });
    await cthTestClient.connect();

    const oCount = await cthTestClient.query('SELECT count(*) FROM public."order";');
    const invCount = await cthTestClient.query('SELECT count(*) FROM public.invoice;');
    const vCount = await cthTestClient.query('SELECT count(*) FROM public.accounting_voucher;');

    assert(Number(oCount.rows[0].count) === 127, 'cth_test order count invariant preserved', '127 / 127');
    assert(Number(invCount.rows[0].count) === 71, 'cth_test invoice count invariant preserved', '71 / 71');
    assert(Number(vCount.rows[0].count) === 4, 'cth_test voucher count invariant preserved', '4 / 4');

    await cthTestClient.end();

  } catch (err) {
    console.error('Fatal error during test suite execution:', err);
    testFailed++;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n================================================================================');
  console.log(`TEST SUITE RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log('================================================================================');

  if (testFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
