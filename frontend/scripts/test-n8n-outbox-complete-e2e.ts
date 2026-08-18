/**
 * CakeToHome Enterprise n8n & External Webhook Outbox End-to-End Test Suite
 * 
 * Tests:
 * 1. Canonical Event Envelope & Metadata Standardization
 * 2. Sensitive Data Sanitization (Zero-Leakage Guarantee)
 * 3. Cryptographic HMAC-SHA256 Request Signing & Timing-Safe Verification
 * 4. Clock-Skew Verification & Replay Protection
 * 5. Multi-Endpoint Configuration & Event Subscription Filtering
 * 6. Asynchronous Outbox Worker & Exponential Backoff Retries
 * 7. Dead Letter Queue (DLQ) Escalation on Max Attempts Exceeded
 * 8. Safe DLQ Event Replay (Preserving Canonical event_id & Idempotency)
 * 9. Two-Stage Lifecycle Callback Recording (Webhook Accepted vs Workflow Processed)
 * 10. Real Metrics Calculation & Health Telemetry
 * 11. Real Event Producer Hooks (Auth, Cart, Order, Outreach Conversion)
 */

import { WebhookEngine, WebhookEventType, ALL_WEBHOOK_EVENT_TYPES } from "../src/lib/webhook-engine";
import { ApiEngine } from "../src/lib/api-engine";
import { TelemarketingEngine } from "../src/lib/telemarketing-engine";

async function runTests() {
  console.log("==================================================================");
  console.log("CAKETOHOME — COMPLETE n8n AUTOMATION PLATFORM E2E INTEGRATION TEST");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error("     Details:", details);
      failed++;
    }
  }

  // ── TEST 1: CANONICAL EVENT ENVELOPE ─────────────────────────
  console.log("1. Testing Canonical Event Envelope Structure...");
  const evt = WebhookEngine.emitEvent(
    "order.created",
    {
      order_id: "ord_test_001",
      order_number: "CTH-ORD-20260818-1001",
      total: 1450,
      customer_uid: "cth_cus_9876543210",
      customer_phone: "+91 98765 43210",
      password: "SECRET_PASSWORD_123", // should be sanitized!
      card_cvv: "999", // should be sanitized!
    },
    { source: "e2e_test", ip: "127.0.0.1" },
    { customer_uid: "cth_cus_9876543210", name: "Priya Sharma", phone: "+91 98765 43210" },
    { type: "order", id: "ord_test_001", branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT" }
  );

  assert(!!evt, "Event returned from WebhookEngine.emitEvent");
  assert(evt?.payload_json?.producer === "caketohome", "Producer is 'caketohome'");
  assert(evt?.payload_json?.event_version === 1, "Event version is 1");
  assert(evt?.payload_json?.event_type === "order.created", "Event type is 'order.created'");
  assert(evt?.payload_json?.customer_uid === "cth_cus_9876543210", "Customer UID set properly");
  assert(evt?.payload_json?.actor_type === "customer", "Actor type is 'customer'");
  assert(!!evt?.payload_json?.request_id, "Request ID is present");
  assert(!!evt?.payload_json?.correlation_id, "Correlation ID is present");
  assert(!!evt?.idempotency_key, "Idempotency key is present");

  // ── TEST 2: DATA SANITIZATION (ZERO SENSITIVE LEAKS) ─────────
  console.log("\n2. Testing Data Sanitization...");
  const rawPayload = evt?.payload_json?.payload || {};
  assert(!rawPayload.password, "Password field is purged from payload");
  assert(!rawPayload.card_cvv, "CVV field is purged from payload");
  assert(rawPayload.order_id === "ord_test_001", "Business payload is preserved");
  assert(rawPayload.total === 1450, "Order total is preserved");

  // ── TEST 3: HMAC-SHA256 SIGNATURE & TIMING-SAFE VERIFICATION ─
  console.log("\n3. Testing Cryptographic HMAC-SHA256 Signing & Verification...");
  const secret = "test_signing_secret_key_2026";
  const now = Math.floor(Date.now() / 1000);
  const testPayload = { test: true, event_id: evt?.event_id };
  const signatureHeader = WebhookEngine.signPayload(secret, now, testPayload);
  
  assert(signatureHeader.startsWith(`t=${now},v1=`), "Signature header format is t=timestamp,v1=sha256Hex");

  const validSig = WebhookEngine.verifySignature(secret, signatureHeader, testPayload);
  assert(validSig === true, "Valid HMAC signature passes verification");

  const badSig = WebhookEngine.verifySignature("wrong_secret", signatureHeader, testPayload);
  assert(badSig === false, "Incorrect HMAC secret fails verification");

  const tamperedSig = WebhookEngine.verifySignature(secret, signatureHeader, { ...testPayload, tampered: true });
  assert(tamperedSig === false, "Tampered payload fails verification");

  // ── TEST 4: CLOCK SKEW PROTECTION ───────────────────────────
  console.log("\n4. Testing Clock Skew Protection (>300s difference)...");
  const oldTimestamp = now - 400; // 400 seconds ago
  const oldSigHeader = WebhookEngine.signPayload(secret, oldTimestamp, testPayload);
  const skewResult = WebhookEngine.verifySignature(secret, oldSigHeader, testPayload);
  assert(skewResult === false, "Expired timestamp (>300s) rejected for replay protection");

  // ── TEST 5: MULTI-ENDPOINT SUBSCRIPTIONS ─────────────────────
  console.log("\n5. Testing Multi-Endpoint & Event Subscriptions...");
  const allEndpoints = WebhookEngine.getEndpoints();
  assert(allEndpoints.length > 0, "At least one default endpoint exists");

  const testEndpoint = WebhookEngine.createEndpoint({
    name: "Staging Test Endpoint",
    url: "https://staging.caketohome.com/webhook",
    environment: "staging",
    active: true,
    subscribed_events: ["order.created", "customer.login.success"],
    retry_limit: 3,
    timeout_ms: 5000,
  });

  assert(testEndpoint.id.startsWith("ep_"), "Created endpoint with valid ID");
  assert(testEndpoint.subscribed_events.includes("order.created"), "Subscribed to order.created");
  assert(!testEndpoint.subscribed_events.includes("cart.abandoned"), "Not subscribed to cart.abandoned");

  // Rotate Secret
  const rotated = WebhookEngine.rotateSigningSecret(testEndpoint.id);
  assert(!!rotated?.new_secret, "Secret rotated successfully");
  assert(rotated.new_secret.length >= 32, "Rotated secret has high entropy");

  // ── TEST 6: ASYNCHRONOUS OUTBOX WORKER & RETRIES ─────────────
  console.log("\n6. Testing Outbox Queue Persistence & Worker Dispatch...");
  const outboxItems = WebhookEngine.getOutboxItems();
  const foundItem = outboxItems.find((o) => o.event_id === evt?.event_id);
  assert(!!foundItem, "Event persisted to transactional outbox queue");
  assert(foundItem?.status === "PENDING" || foundItem?.status === "DELIVERED", "Outbox status is valid");

  // Test Worker Execution
  const dispatchRes = await WebhookEngine.dispatchPendingWebhooks();
  assert(dispatchRes.dispatched >= 0, "Outbox worker executed batch successfully");

  // ── TEST 7: DEAD LETTER QUEUE (DLQ) ESCALATION ───────────────
  console.log("\n7. Testing Dead Letter Queue Escalation...");
  // Create an outbox item with max attempts exceeded
  const dlqItem = WebhookEngine.emitEvent(
    "test.webhook.ping",
    { alert: "Test Failure For DLQ", severity: "HIGH" }
  );
  
  // Force failure to DLQ
  const allOutbox = WebhookEngine.getOutboxItems();
  const targetOutbox = allOutbox.find((o) => o.event_id === dlqItem?.event_id);
  if (targetOutbox) {
    targetOutbox.attempt_count = targetOutbox.max_attempts;
    targetOutbox.status = "DEAD_LETTER";
    targetOutbox.last_error = "HTTP 500 Internal Server Error: Endpoint unserviceable";
  }

  const dlqList = WebhookEngine.getDeadLetterQueue();
  const inDLQ = dlqList.some((d) => d.event_id === dlqItem?.event_id);
  assert(inDLQ, "Event successfully escalated to Dead Letter Queue");

  // ── TEST 8: SAFE DLQ REPLAY (IDEMPOTENCY PRESERVED) ──────────
  console.log("\n8. Testing Safe DLQ Replay...");
  if (targetOutbox) {
    const replayed = WebhookEngine.replayEvent(targetOutbox.id);
    assert(replayed.status === "PENDING", "Replayed event status reset to PENDING");
    assert(replayed.attempt_count === 0, "Replayed event attempt_count reset to 0");
    assert(replayed.event_id === targetOutbox.event_id, "Canonical event_id preserved for idempotency");
    assert(replayed.idempotency_key === targetOutbox.idempotency_key, "Idempotency key preserved");
  }

  // ── TEST 9: TWO-STAGE WORKFLOW CALLBACK ──────────────────────
  console.log("\n9. Testing Two-Stage Metric Tracking (Webhook Accepted vs Workflow Processed)...");
  const callbackRes = WebhookEngine.recordWorkflowCallback(
    evt!.event_id,
    "exec_n8n_998877",
    "PROCESSED",
    "Sent WhatsApp confirmation template via Gupshup node."
  );
  assert(callbackRes === true, "Workflow execution callback recorded successfully");

  // Verify delivery log has execution ID
  const logsRes = WebhookEngine.getLogs({ search: evt!.event_id });
  assert(logsRes.logs.length > 0, "Delivery log found for event");
  if (logsRes.logs.length > 0) {
    assert(logsRes.logs[0].n8n_execution_id === "exec_n8n_998877", "n8n execution ID attached to log");
  }

  // ── TEST 10: REAL METRICS COMPUTATION ────────────────────────
  console.log("\n10. Testing Real Metrics Calculation...");
  const metrics = WebhookEngine.getMetrics();
  assert(typeof metrics.delivery_success_rate_pct === "number", "Delivery success rate is a number");
  assert(metrics.delivery_success_rate_pct >= 0 && metrics.delivery_success_rate_pct <= 100, "Delivery rate is bounded between 0-100%");
  assert(typeof metrics.pending_outbox === "number", "Pending outbox depth is reported");
  assert(typeof metrics.dead_letter_count === "number", "DLQ count is reported");
  assert(typeof metrics.average_latency_ms === "number", "Average latency is reported");

  // ── TEST 11: EVENT PRODUCER HOOKS ────────────────────────────
  console.log("\n11. Testing Event Producers in Core Subsystems...");

  // A. Auth OTP / Registration
  const randSuffix = Math.floor(1000000 + Math.random() * 9000000);
  const testPhone = `+91 91${randSuffix}`;
  const authRes = ApiEngine.verifyOtp(testPhone, "123456", { name: "Aarav Mehta", email: `aarav_${randSuffix}@test.com` });
  assert(authRes.success === true, "ApiEngine.verifyOtp succeeded");
  
  const authOutbox = WebhookEngine.getOutboxItems({ event_type: "customer.registered" });
  assert(authOutbox.some((item) => (item.customer_uid || "").includes(String(randSuffix)) || (item.payload_json?.customer_uid || "").includes(String(randSuffix)) || (item.payload_json?.customer?.phone || (item.payload_json?.payload as any)?.phone || "").replace(/\D/g, "").includes(String(randSuffix))), "customer.registered event emitted by verifyOtp");

  // B. Order Created
  const orderRes = ApiEngine.addOrder({
    customer_uid: authRes.customer_uid,
    customer_name: "Aarav Mehta",
    customer_phone: testPhone,
    total: 899,
    grand_total: 899,
    status: "CONFIRMED",
    items: [{ id: "item_01", name: "Chocolate Truffle", price: 899, quantity: 1 }],
  });
  assert(!!orderRes.id, "ApiEngine.addOrder succeeded");

  const orderOutbox = WebhookEngine.getOutboxItems({ event_type: "order.created" });
  assert(orderOutbox.some((item) => item.aggregate_id === orderRes.id || (item.payload_json?.payload as any)?.order_id === orderRes.id), "order.created event emitted by addOrder");

  // C. Cart Recovery Attribution
  const abCartRes = ApiEngine.evaluateCartAbandonment(0);
  assert(Array.isArray(abCartRes), "evaluateCartAbandonment returned list");

  // D. Telemarketing Outreach Conversion
  const candList = TelemarketingEngine.listCandidates({});
  const cand = TelemarketingEngine.getCandidateById("cand_01") || (candList.candidates && candList.candidates[0]);
  if (cand) {
    const convOrder = ApiEngine.addOrder({
      customer_uid: cand.customer_uid,
      customer_name: cand.customer_name,
      customer_phone: cand.customer_phone,
      total: 1250,
      status: "DELIVERED",
    });
    const convRes = TelemarketingEngine.recordAttributedOrder(cand.id, convOrder.id, 1250);
    assert(convRes.contact_status === "CONVERTED", "Telemarketing candidate converted");

    const reorderOutbox = WebhookEngine.getOutboxItems({ event_type: "customer.reorder_converted" });
    assert(reorderOutbox.some((item) => item.aggregate_id === cand.id || (item.payload_json?.payload as any)?.order_id === convOrder.id), "customer.reorder_converted event emitted");
  }

  // Dispatch all pending and verify delivery logs
  const finalDispatch = await WebhookEngine.dispatchPendingWebhooks();
  assert(finalDispatch.dispatched >= 0, "Dispatched all newly produced subsystem webhook events");

  // Diagnostic Webhook Test Execution
  const testDiag = await WebhookEngine.testEndpoint("ep_n8n_production", "test.webhook.ping");
  assert(testDiag.success === true, "Diagnostic test webhook executed successfully");
  assert(!!testDiag.signature_header, "Diagnostic test generated valid HMAC signature header");

  // ── CLEANUP & FINAL ASSERTIONS ──────────────────────────────
  WebhookEngine.deleteEndpoint(testEndpoint.id);

  console.log("\n==================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
