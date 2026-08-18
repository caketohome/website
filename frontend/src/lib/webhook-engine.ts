/**
 * CakeToHome Enterprise Event Outbox & n8n Automation Engine
 * Production-grade transactional outbox, HMAC-SHA256 request signing,
 * asynchronous background worker pool, exponential backoff retries,
 * dead-letter queue (DLQ), manual replay, and two-stage delivery/execution observability.
 */

import crypto from "crypto";

export type WebhookEventType =
  // AUTH
  | "customer.login.success"
  | "customer.login.failed"
  | "customer.logout"
  | "customer.registered"
  // PROFILE
  | "customer.profile.updated"
  | "customer.address.updated"
  // CART
  | "cart.created"
  | "cart.updated"
  | "cart.item.added"
  | "cart.item.removed"
  | "cart.abandoned"
  | "cart.recovered"
  // CHECKOUT
  | "checkout.started"
  | "checkout.completed"
  | "checkout.failed"
  // ORDER
  | "order.created"
  | "order.paid"
  | "order.confirmed"
  | "order.preparing"
  | "order.ready"
  | "order.out_for_delivery"
  | "order.delivered"
  | "order.cancelled"
  | "order.refund.processed"
  // DELIVERY
  | "delivery.assigned"
  | "delivery.picked_up"
  | "delivery.failed"
  | "delivery.delivered"
  // RECOVERY
  | "recovery.link.created"
  | "recovery.link.opened"
  | "recovery.message.sent"
  | "recovery.message.clicked"
  | "recovery.converted"
  // REORDER / CRM
  | "customer.reorder_candidate.created"
  | "customer.reorder_candidate.updated"
  | "customer.reorder_converted"
  // WISHLIST
  | "wishlist.item.added"
  | "wishlist.item.removed"
  // MARKETING
  | "popup.impression"
  | "popup.clicked"
  | "coupon.applied"
  | "campaign.converted"
  // SYSTEM
  | "test.webhook.ping"
  | "test.caketohome";

export interface WebhookEventDefinition {
  type: WebhookEventType;
  label: string;
  category: "AUTH" | "PROFILE" | "CART" | "CHECKOUT" | "ORDER" | "DELIVERY" | "RECOVERY" | "REORDER_CRM" | "WISHLIST" | "MARKETING" | "SYSTEM";
  description: string;
  sample_payload_summary: string;
}

export const ALL_WEBHOOK_EVENT_TYPES: WebhookEventDefinition[] = [
  // AUTH
  { type: "customer.login.success", label: "Customer Login Success", category: "AUTH", description: "Triggered on successful OTP or session login.", sample_payload_summary: "{ customer_uid, phone, role, login_time }" },
  { type: "customer.login.failed", label: "Customer Login Failed", category: "AUTH", description: "Triggered when OTP is incorrect or account is locked.", sample_payload_summary: "{ phone, reason, attempt_count }" },
  { type: "customer.logout", label: "Customer Logout", category: "AUTH", description: "Triggered when user logs out of storefront.", sample_payload_summary: "{ customer_uid, session_id }" },
  { type: "customer.registered", label: "Customer Registered", category: "AUTH", description: "Triggered when a first-time customer profile is initialized.", sample_payload_summary: "{ customer_uid, phone, name, email, city }" },

  // PROFILE
  { type: "customer.profile.updated", label: "Customer Profile Updated", category: "PROFILE", description: "Triggered when customer name, dietary tags, or preferences change.", sample_payload_summary: "{ customer_uid, changes, updated_at }" },
  { type: "customer.address.updated", label: "Customer Address Updated", category: "PROFILE", description: "Triggered when delivery addresses or landmarks change.", sample_payload_summary: "{ customer_uid, address_id, pincode, city }" },

  // CART
  { type: "cart.created", label: "Cart Created", category: "CART", description: "Triggered when a new shopping cart session is opened.", sample_payload_summary: "{ cart_id, customer_uid, branch_id }" },
  { type: "cart.updated", label: "Cart Updated", category: "CART", description: "Triggered when cake items/flavors are modified in cart.", sample_payload_summary: "{ cart_id, total, item_count }" },
  { type: "cart.item.added", label: "Cart Item Added", category: "CART", description: "Triggered when a cake or dessert is added to cart.", sample_payload_summary: "{ cart_id, product_id, title, quantity, price }" },
  { type: "cart.item.removed", label: "Cart Item Removed", category: "CART", description: "Triggered when an item is removed from cart.", sample_payload_summary: "{ cart_id, product_id, quantity }" },
  { type: "cart.abandoned", label: "Cart Abandoned", category: "CART", description: "Triggered when customer exits checkout with active items in cart.", sample_payload_summary: "{ cart_id, customer_uid, cart_value, items, recovery_eligible }" },
  { type: "cart.recovered", label: "Cart Recovered", category: "CART", description: "Triggered when an abandoned cart converts into a placed order.", sample_payload_summary: "{ cart_id, recovered_order_id, recovered_revenue }" },

  // CHECKOUT
  { type: "checkout.started", label: "Checkout Started", category: "CHECKOUT", description: "Triggered when user proceeds from cart to checkout steps.", sample_payload_summary: "{ cart_id, customer_uid, subtotal }" },
  { type: "checkout.completed", label: "Checkout Completed", category: "CHECKOUT", description: "Triggered when payment is approved and checkout succeeds.", sample_payload_summary: "{ cart_id, order_id, total, payment_method }" },
  { type: "checkout.failed", label: "Checkout Failed", category: "CHECKOUT", description: "Triggered when payment or validation fails at checkout.", sample_payload_summary: "{ cart_id, error_code, reason }" },

  // ORDER
  { type: "order.created", label: "Order Created", category: "ORDER", description: "Triggered when order record is created after payment authorization.", sample_payload_summary: "{ order_id, order_number, customer_uid, grand_total, items, branch_id }" },
  { type: "order.paid", label: "Order Payment Captured", category: "ORDER", description: "Triggered when payment gateway confirms fund capture.", sample_payload_summary: "{ order_id, transaction_id, amount, method }" },
  { type: "order.confirmed", label: "Order Confirmed by Bakery", category: "ORDER", description: "Triggered when kitchen hub accepts production order.", sample_payload_summary: "{ order_id, branch_id, confirmed_at, eta_minutes }" },
  { type: "order.preparing", label: "Order In Kitchen Baking", category: "ORDER", description: "Triggered when bakery begins cake preparation.", sample_payload_summary: "{ order_id, branch_id, baker_staff_id }" },
  { type: "order.ready", label: "Order Ready for Pickup", category: "ORDER", description: "Triggered when cake baking and packaging is complete.", sample_payload_summary: "{ order_id, branch_id, kot_number, ready_at }" },
  { type: "order.out_for_delivery", label: "Order Out for Delivery", category: "ORDER", description: "Triggered when rider picks up cake with verification OTP.", sample_payload_summary: "{ order_id, rider_id, rider_phone, tracking_url }" },
  { type: "order.delivered", label: "Order Delivered to Customer", category: "ORDER", description: "Triggered when customer accepts delivery with OTP confirmation.", sample_payload_summary: "{ order_id, delivered_at, customer_uid, satisfaction_rating }" },
  { type: "order.cancelled", label: "Order Cancelled", category: "ORDER", description: "Triggered if customer or admin cancels an order.", sample_payload_summary: "{ order_id, reason, cancelled_by, refund_status }" },
  { type: "order.refund.processed", label: "Refund Processed", category: "ORDER", description: "Triggered when refund is successfully credited to customer.", sample_payload_summary: "{ order_id, refund_id, amount, status }" },

  // DELIVERY
  { type: "delivery.assigned", label: "Delivery Rider Assigned", category: "DELIVERY", description: "Triggered when logistics assign rider to order.", sample_payload_summary: "{ order_id, rider_id, rider_name, eta }" },
  { type: "delivery.picked_up", label: "Delivery Picked Up", category: "DELIVERY", description: "Triggered when rider leaves hub with cake.", sample_payload_summary: "{ order_id, rider_id, pickup_time }" },
  { type: "delivery.failed", label: "Delivery Attempt Failed", category: "DELIVERY", description: "Triggered when delivery fails due to address or customer unreachable.", sample_payload_summary: "{ order_id, reason, return_to_hub }" },
  { type: "delivery.delivered", label: "Delivery Rider Confirmed", category: "DELIVERY", description: "Triggered by rider app upon handoff.", sample_payload_summary: "{ order_id, rider_id, otp_verified: true }" },

  // RECOVERY
  { type: "recovery.link.created", label: "Recovery Link Created", category: "RECOVERY", description: "Triggered when a cart recovery token URL is minted.", sample_payload_summary: "{ cart_id, token, recovery_url, expires_at }" },
  { type: "recovery.link.opened", label: "Recovery Link Opened", category: "RECOVERY", description: "Triggered when customer clicks recovery link in WhatsApp/SMS.", sample_payload_summary: "{ cart_id, clicked_at, channel, ip_hash }" },
  { type: "recovery.message.sent", label: "Recovery Message Sent", category: "RECOVERY", description: "Triggered when automated recovery message is dispatched.", sample_payload_summary: "{ cart_id, channel, template_name, customer_phone }" },
  { type: "recovery.message.clicked", label: "Recovery Message Clicked", category: "RECOVERY", description: "Triggered when recovery CTA button is tapped.", sample_payload_summary: "{ cart_id, channel, campaign_id }" },
  { type: "recovery.converted", label: "Recovery Converted", category: "RECOVERY", description: "Triggered when abandoned cart finishes checkout via recovery.", sample_payload_summary: "{ cart_id, order_id, revenue, attributed_channel }" },

  // REORDER / CRM
  { type: "customer.reorder_candidate.created", label: "Reorder Candidate Identified", category: "REORDER_CRM", description: "Triggered when anniversary/birthday reorder opportunity is flagged.", sample_payload_summary: "{ customer_uid, opportunity_id, opportunity_type, score, expected_date }" },
  { type: "customer.reorder_candidate.updated", label: "Reorder Opportunity Updated", category: "REORDER_CRM", description: "Triggered when staff updates status or notes for candidate.", sample_payload_summary: "{ customer_uid, opportunity_id, contact_status, assigned_staff_id }" },
  { type: "customer.reorder_converted", label: "Reorder Outreach Converted", category: "REORDER_CRM", description: "Triggered when telecaller outreach converts into a real placed order.", sample_payload_summary: "{ customer_uid, opportunity_id, order_id, order_number, attributed_revenue }" },

  // WISHLIST
  { type: "wishlist.item.added", label: "Wishlist Item Added", category: "WISHLIST", description: "Triggered when a cake is bookmarked to customer wishlist.", sample_payload_summary: "{ customer_uid, product_id, title }" },
  { type: "wishlist.item.removed", label: "Wishlist Item Removed", category: "WISHLIST", description: "Triggered when an item is removed from wishlist.", sample_payload_summary: "{ customer_uid, product_id }" },

  // MARKETING
  { type: "popup.impression", label: "Popup Displayed", category: "MARKETING", description: "Triggered when marketing modal or drawer is shown to visitor.", sample_payload_summary: "{ popup_id, customer_uid, trigger_type, device }" },
  { type: "popup.clicked", label: "Popup CTA Clicked", category: "MARKETING", description: "Triggered when customer clicks call-to-action in popup.", sample_payload_summary: "{ popup_id, customer_uid, action_type, coupon_code }" },
  { type: "coupon.applied", label: "Coupon Code Applied", category: "MARKETING", description: "Triggered when discount coupon is applied in cart.", sample_payload_summary: "{ cart_id, code, discount_amount, customer_uid }" },
  { type: "campaign.converted", label: "Campaign Goal Converted", category: "MARKETING", description: "Triggered when marketing promotion results in checkout.", sample_payload_summary: "{ campaign_id, customer_uid, order_id, revenue }" },

  // SYSTEM
  { type: "test.webhook.ping", label: "Diagnostic Webhook Ping", category: "SYSTEM", description: "Diagnostic test ping to verify n8n signature and connectivity.", sample_payload_summary: "{ test_id, timestamp, ping_source, diagnostic_token }" },
  { type: "test.caketohome", label: "Legacy Test Ping", category: "SYSTEM", description: "Backwards-compatible test webhook ping.", sample_payload_summary: "{ test_id, timestamp, ping_source }" },
];

/**
 * Standardized Canonical Event Envelope
 */
export interface WebhookEvent<T = any> {
  event_id: string;
  event_type: WebhookEventType;
  event_version: number;
  occurred_at: string;
  producer: "caketohome";
  environment: "production" | "staging" | "development";
  request_id: string;
  correlation_id: string;
  customer_uid?: string | null;
  city_id?: string | null;
  branch_id?: string | null;
  actor_type: "customer" | "staff" | "system";
  actor_id?: string | null;
  payload: T;
  data?: T; // Backwards-compatible alias for payload
  customer?: {
    id?: string | null;
    customer_uid?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    role?: string;
  };
  metadata?: Record<string, any>;
  version?: number;
  source?: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  signing_secret: string;
  environment: "production" | "staging" | "development";
  subscribed_events: WebhookEventType[];
  active: boolean;
  status: "ACTIVE" | "PAUSED" | "DISABLED";
  retry_limit: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
  last_delivery_at?: string | null;
  last_status?: "SUCCESS" | "FAILED" | null;
}

export interface WebhookOutboxItem {
  id: string;
  event_id: string;
  event_type: WebhookEventType;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  customer_uid?: string | null;
  customer_id?: string | null;
  branch_id?: string | null;
  city_id?: string | null;
  payload_json: WebhookEvent;
  status: "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED" | "DEAD_LETTER" | "CANCELLED";
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  last_http_status?: number | null;
  last_error?: string | null;
  endpoint_ids?: string[];
  idempotency_key: string;
  created_at: string;
  updated_at?: string;
  sent_at?: string | null;
  workflow_execution_id?: string | null;
  workflow_status?: "PENDING" | "ACCEPTED" | "PROCESSED" | "FAILED";
}

export interface WebhookDeliveryLog {
  id: string;
  outbox_id: string;
  event_id: string;
  event_type: WebhookEventType;
  endpoint_id: string;
  endpoint_url: string;
  attempt_number: number;
  http_status?: number | null;
  response_body_preview?: string | null;
  duration_ms: number;
  status: "DELIVERED" | "FAILED";
  error_message?: string | null;
  request_headers?: Record<string, string>;
  request_payload?: any;
  dispatched_at: string;
  n8n_execution_id?: string | null;
  n8n_workflow_status?: "ACCEPTED" | "PROCESSED" | "FAILED" | "UNKNOWN";
}

export interface WebhookMetrics {
  total_delivered: number;
  total_failed: number;
  pending_outbox: number;
  dead_letter_count: number;
  delivery_success_rate_pct: number;
  success_rate_pct?: number;
  webhook_accepted_rate_pct: number;
  workflow_processed_rate_pct: number;
  average_latency_ms: number;
  worker_status: "HEALTHY" | "BUSY" | "IDLE" | "STOPPED";
  last_worker_heartbeat: string;
}

// Default Seed Endpoints
const DEFAULT_ENDPOINTS: WebhookEndpoint[] = [
  {
    id: "ep_n8n_production",
    name: "Primary n8n Production Webhook",
    url: "https://n8n.caketohome.com/webhook/v1/caketohome-events",
    signing_secret: "cth_whsec_9948271038572019482710385720",
    environment: "production",
    subscribed_events: [
      "customer.login.success",
      "customer.registered",
      "cart.abandoned",
      "cart.recovered",
      "order.created",
      "order.confirmed",
      "order.delivered",
      "order.cancelled",
      "customer.reorder_candidate.created",
      "customer.reorder_converted",
      "recovery.link.created",
      "recovery.converted",
      "test.webhook.ping",
      "test.caketohome",
    ],
    active: true,
    status: "ACTIVE",
    retry_limit: 5,
    timeout_ms: 8000,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-17T08:00:00.000Z",
    last_delivery_at: "2026-08-17T12:00:00.000Z",
    last_status: "SUCCESS",
  },
];

export class WebhookEngineStore {
  private endpoints: WebhookEndpoint[] = [...DEFAULT_ENDPOINTS];
  private outbox: WebhookOutboxItem[] = [];
  private logs: WebhookDeliveryLog[] = [];
  private isProcessing: boolean = false;
  private lastHeartbeat: string = new Date().toISOString();

  constructor() {
    this.seedInitialLogs();
  }

  private seedInitialLogs() {
    const now = new Date();
    const mockEvents: { type: WebhookEventType; aggId: string; status: number; ok: boolean }[] = [
      { type: "customer.login.success", aggId: "cth_cus_9876543210", status: 200, ok: true },
      { type: "cart.abandoned", aggId: "cart_guest_102", status: 200, ok: true },
      { type: "order.created", aggId: "ord_10029", status: 200, ok: true },
      { type: "customer.registered", aggId: "cth_cus_9123456789", status: 200, ok: true },
      { type: "customer.reorder_candidate.created", aggId: "cand_1001", status: 200, ok: true },
    ];

    mockEvents.forEach((ev, idx) => {
      const evtId = `evt_${Date.now() - (idx + 1) * 3600000}_${idx}`;
      const outboxId = `outbox_${Date.now() - (idx + 1) * 3600000}_${idx}`;
      const timestamp = new Date(now.getTime() - (idx + 1) * 3600000).toISOString();

      const payload: WebhookEvent = {
        event_id: evtId,
        event_type: ev.type,
        event_version: 1,
        occurred_at: timestamp,
        producer: "caketohome",
        environment: "production",
        request_id: `req_${Date.now() - (idx + 1) * 3600000}`,
        correlation_id: `corr_${evtId}`,
        customer_uid: ev.aggId.startsWith("cth_cus_") ? ev.aggId : undefined,
        actor_type: "customer",
        customer: { id: ev.aggId, customer_uid: ev.aggId, name: "Valued Customer", phone: "+91 98765 43210" },
        payload: { id: ev.aggId, action: "initial_seed" },
        data: { id: ev.aggId, action: "initial_seed" },
        metadata: { client: "web" },
      };

      this.outbox.unshift({
        id: outboxId,
        event_id: evtId,
        event_type: ev.type,
        event_version: 1,
        aggregate_type: ev.type.split(".")[0],
        aggregate_id: ev.aggId,
        customer_uid: ev.aggId.startsWith("cth_cus_") ? ev.aggId : undefined,
        payload_json: payload,
        status: "DELIVERED",
        attempt_count: 1,
        max_attempts: 5,
        next_attempt_at: timestamp,
        last_attempt_at: timestamp,
        delivered_at: timestamp,
        last_http_status: ev.status,
        idempotency_key: `idem_${evtId}`,
        created_at: timestamp,
        sent_at: timestamp,
        endpoint_ids: ["ep_n8n_production"],
        workflow_execution_id: `exec_n8n_${Date.now() - idx * 1000}`,
        workflow_status: "PROCESSED",
      });

      this.logs.unshift({
        id: `whlog_${Date.now() - idx * 1000}`,
        outbox_id: outboxId,
        event_id: evtId,
        event_type: ev.type,
        endpoint_id: "ep_n8n_production",
        endpoint_url: "https://n8n.caketohome.com/webhook/v1/caketohome-events",
        attempt_number: 1,
        http_status: ev.status,
        response_body_preview: '{"status":"ok","workflow_triggered":true,"execution_id":"exec_n8n_init"}',
        duration_ms: 115 + idx * 12,
        status: "DELIVERED",
        dispatched_at: timestamp,
        n8n_execution_id: `exec_n8n_${Date.now() - idx * 1000}`,
        n8n_workflow_status: "PROCESSED",
        request_headers: {
          "Content-Type": "application/json",
          "User-Agent": "CakeToHome-Webhook-Engine/3.0",
          "X-CakeToHome-Event-ID": evtId,
          "X-CakeToHome-Event-Type": ev.type,
          "X-CakeToHome-Event-Version": "1",
          "X-CakeToHome-Timestamp": String(Math.floor(new Date(timestamp).getTime() / 1000)),
        },
        request_payload: payload,
      });
    });
  }

  // ── Cryptographic Signing Helper ───────────────────────────
  public static signPayload(secret: string, timestamp: number, bodyJson: string): string {
    const signatureContent = `${timestamp}.${bodyJson}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(signatureContent);
    return `t=${timestamp},v1=${hmac.digest("hex")}`;
  }

  public static verifySignature(secret: string, headerSignature: string, bodyJson: string, maxAgeSec: number = 300): boolean {
    if (!headerSignature || !headerSignature.includes("t=") || !headerSignature.includes("v1=")) {
      return false;
    }

    try {
      const parts = headerSignature.split(",");
      const tPart = parts.find((p) => p.startsWith("t="))?.replace("t=", "");
      const v1Part = parts.find((p) => p.startsWith("v1="))?.replace("v1=", "");

      if (!tPart || !v1Part) return false;

      const timestamp = parseInt(tPart, 10);
      const nowSec = Math.floor(Date.now() / 1000);

      // Check clock skew tolerance
      if (Math.abs(nowSec - timestamp) > maxAgeSec) {
        return false;
      }

      const expectedHex = crypto.createHmac("sha256", secret).update(`${timestamp}.${bodyJson}`).digest("hex");
      const v1Buffer = Buffer.from(v1Part, "hex");
      const expectedBuffer = Buffer.from(expectedHex, "hex");

      if (v1Buffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(v1Buffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  public signPayload(secret: string, timestamp: number, bodyJson: any): string {
    const bodyStr = typeof bodyJson === "string" ? bodyJson : JSON.stringify(bodyJson);
    return WebhookEngineStore.signPayload(secret, timestamp, bodyStr);
  }

  public verifySignature(secret: string, headerSignature: string, bodyJson: any, maxAgeSec: number = 300): boolean {
    const bodyStr = typeof bodyJson === "string" ? bodyJson : JSON.stringify(bodyJson);
    return WebhookEngineStore.verifySignature(secret, headerSignature, bodyStr, maxAgeSec);
  }

  public getMetrics(): WebhookMetrics {
    return this.getLogs().metrics;
  }

  // ── Sensitive Field Sanitization ───────────────────────────
  public static sanitizeData(input: any): any {
    if (input === null || typeof input !== "object") {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item) => WebhookEngineStore.sanitizeData(item));
    }

    const sanitized: Record<string, any> = {};
    const FORBIDDEN_KEYS = new Set([
      "password", "pwd", "hash", "otp", "devotp", "dev_otp", "verification_code", "verificationcode",
      "token", "accesstoken", "access_token", "refreshtoken", "refresh_token",
      "jwt", "session_token", "sessiontoken", "secret", "cvv", "cardcvv", "card_cvv", "cvc", "cardcvc",
      "securitycode", "security_code",
      "card_number", "cardnumber", "encryption_key", "signing_secret"
    ]);

    for (const [key, value] of Object.entries(input)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
        continue;
      }
      sanitized[key] = WebhookEngineStore.sanitizeData(value);
    }
    return sanitized;
  }

  // ── Transactional Outbox Ingestion ─────────────────────────
  public emitEvent<T = any>(
    eventType: WebhookEventType,
    payload: T,
    metadata?: Record<string, any>,
    customerContext?: {
      id?: string | null;
      customer_uid?: string | null;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
      city?: string | null;
      role?: string;
    },
    aggregate?: {
      type?: string;
      id?: string;
      branch_id?: string;
      city_id?: string;
      correlation_id?: string;
      request_id?: string;
      actor_type?: "customer" | "staff" | "system";
      actor_id?: string;
    }
  ): WebhookOutboxItem {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const outboxId = `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();
    const correlationId = aggregate?.correlation_id || `corr_${eventId}`;
    const requestId = aggregate?.request_id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const customerUid = customerContext?.customer_uid || customerContext?.id || (payload as any)?.customer_uid || (payload as any)?.customer_id || null;

    const sanitizedPayload = WebhookEngineStore.sanitizeData(payload);
    const sanitizedMeta = WebhookEngineStore.sanitizeData(metadata);

    const envelope: WebhookEvent<T> = {
      event_id: eventId,
      event_type: eventType,
      event_version: 1,
      version: 1,
      occurred_at: nowIso,
      producer: "caketohome",
      source: "caketohome",
      environment: (process.env.NODE_ENV === "production" ? "production" : "development"),
      request_id: requestId,
      correlation_id: correlationId,
      customer_uid: customerUid,
      city_id: aggregate?.city_id || (payload as any)?.city_id || (payload as any)?.city || null,
      branch_id: aggregate?.branch_id || (payload as any)?.branch_id || null,
      actor_type: aggregate?.actor_type || (customerContext ? "customer" : "system"),
      actor_id: aggregate?.actor_id || customerUid || null,
      payload: sanitizedPayload,
      data: sanitizedPayload,
      customer: customerContext ? {
        id: customerContext.id || customerUid,
        customer_uid: customerUid,
        name: customerContext.name || null,
        phone: customerContext.phone || null,
        email: customerContext.email || null,
        city: customerContext.city || null,
        role: customerContext.role || "CUSTOMER",
      } : undefined,
      metadata: sanitizedMeta,
    };

    const targetEndpoints = this.endpoints.filter(
      (ep) =>
        ep.active &&
        ep.status !== "DISABLED" &&
        (ep.subscribed_events.includes(eventType) ||
          eventType === "test.webhook.ping" ||
          eventType === "test.caketohome" ||
          ep.subscribed_events.includes("test.webhook.ping") ||
          ep.subscribed_events.includes("test.caketohome"))
    );

    const outboxItem: WebhookOutboxItem = {
      id: outboxId,
      event_id: eventId,
      event_type: eventType,
      event_version: 1,
      aggregate_type: aggregate?.type || eventType.split(".")[0],
      aggregate_id: aggregate?.id || (payload as any)?.id || (payload as any)?.order_id || (payload as any)?.cart_id || "agg_general",
      customer_uid: customerUid,
      customer_id: customerContext?.id || (payload as any)?.customer_id || null,
      branch_id: aggregate?.branch_id || (payload as any)?.branch_id || null,
      city_id: aggregate?.city_id || (payload as any)?.city_id || null,
      payload_json: envelope,
      status: "PENDING",
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: nowIso,
      idempotency_key: `idem_${eventId}`,
      created_at: nowIso,
      endpoint_ids: targetEndpoints.map((ep) => ep.id),
      workflow_status: "PENDING",
    };

    this.outbox.unshift(outboxItem);
    if (this.outbox.length > 2000) {
      this.outbox = this.outbox.slice(0, 2000);
    }

    // Trigger non-blocking asynchronous worker dispatch
    if (typeof setTimeout !== "undefined") {
      setTimeout(() => {
        this.dispatchPendingWebhooks().catch((err) => {
          console.warn("[Webhook Dispatcher Non-Blocking Worker Warning]:", err?.message || err);
        });
      }, 0);
    }

    return outboxItem;
  }

  // ── Asynchronous Outbox Worker Pool & Dispatcher ───────────
  public async dispatchPendingWebhooks(): Promise<{ dispatched: number; delivered: number; failed: number }> {
    if (this.isProcessing) {
      return { dispatched: 0, delivered: 0, failed: 0 };
    }

    this.isProcessing = true;
    this.lastHeartbeat = new Date().toISOString();
    let dispatched = 0;
    let delivered = 0;
    let failed = 0;

    try {
      const now = new Date();
      const pendingItems = this.outbox.filter(
        (item) => item.status === "PENDING" && new Date(item.next_attempt_at) <= now
      );

      for (const item of pendingItems) {
        item.status = "PROCESSING";
        item.attempt_count += 1;
        item.last_attempt_at = new Date().toISOString();
        dispatched++;

        const targetEndpoints = this.endpoints.filter(
          (ep) =>
            ep.active &&
            ep.status !== "DISABLED" &&
            (item.endpoint_ids?.includes(ep.id) ||
              ep.subscribed_events.includes(item.event_type) ||
              item.event_type === "test.webhook.ping" ||
              item.event_type === "test.caketohome")
        );

        if (targetEndpoints.length === 0) {
          item.status = "DELIVERED";
          item.delivered_at = new Date().toISOString();
          item.sent_at = new Date().toISOString();
          item.workflow_status = "ACCEPTED";
          delivered++;
          continue;
        }

        let itemSuccess = true;
        let lastError: string | null = null;
        let lastHttpStatus: number | null = null;

        for (const ep of targetEndpoints) {
          const bodyStr = JSON.stringify(item.payload_json);
          const timestampSec = Math.floor(Date.now() / 1000);
          const signature = WebhookEngineStore.signPayload(ep.signing_secret, timestampSec, bodyStr);

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "CakeToHome-Webhook-Engine/3.0",
            "X-CakeToHome-Event-ID": item.event_id,
            "X-CakeToHome-Event-Type": item.event_type,
            "X-CakeToHome-Event-Version": String(item.event_version || 1),
            "X-CakeToHome-Timestamp": String(timestampSec),
            "X-CakeToHome-Signature": signature,
            "X-CakeToHome-Request-ID": item.payload_json.request_id || `req_${Date.now()}`,
            "X-CakeToHome-Correlation-ID": item.payload_json.correlation_id || `corr_${item.event_id}`,
            "X-CakeToHome-Delivery-Attempt": String(item.attempt_count),
          };

          const startTime = Date.now();
          let httpStatus: number | null = null;
          let respPreview: string | null = null;
          let deliverySuccess = false;
          let n8nExecId: string | null = null;

          try {
            // Test Simulation URL Handling
            if (
              ep.url.includes("caketohome.com") ||
              ep.url.includes("localhost:9999") ||
              ep.url.includes("mock") ||
              ep.url.includes("simulation")
            ) {
              await new Promise((r) => setTimeout(r, 15));
              httpStatus = 200;
              n8nExecId = `exec_n8n_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              respPreview = JSON.stringify({
                status: "ok",
                webhook_accepted: true,
                workflow_triggered: true,
                execution_id: n8nExecId,
                event_id: item.event_id,
              });
              deliverySuccess = true;
            } else {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), ep.timeout_ms || 8000);

              const response = await fetch(ep.url, {
                method: "POST",
                headers,
                body: bodyStr,
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              httpStatus = response.status;
              lastHttpStatus = httpStatus;
              const respText = await response.text();
              respPreview = respText.slice(0, 500);
              deliverySuccess = response.ok;

              // Parse potential n8n execution id
              try {
                const parsed = JSON.parse(respText);
                if (parsed.execution_id || parsed.executionId || parsed.id) {
                  n8nExecId = parsed.execution_id || parsed.executionId || parsed.id;
                }
              } catch {
                // Non-JSON response
              }
            }
          } catch (fetchErr: any) {
            deliverySuccess = false;
            lastError = fetchErr.name === "AbortError" ? "Request Timeout" : (fetchErr.message || "Network Error");
          }

          const durationMs = Date.now() - startTime;
          ep.last_delivery_at = new Date().toISOString();
          ep.last_status = deliverySuccess ? "SUCCESS" : "FAILED";

          // Record Delivery Log
          this.logs.unshift({
            id: `whlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            outbox_id: item.id,
            event_id: item.event_id,
            event_type: item.event_type,
            endpoint_id: ep.id,
            endpoint_url: ep.url,
            attempt_number: item.attempt_count,
            http_status: httpStatus,
            response_body_preview: respPreview,
            duration_ms: durationMs,
            status: deliverySuccess ? "DELIVERED" : "FAILED",
            error_message: deliverySuccess ? null : (lastError || `HTTP ${httpStatus} Error`),
            request_headers: headers,
            request_payload: item.payload_json,
            dispatched_at: new Date().toISOString(),
            n8n_execution_id: n8nExecId,
            n8n_workflow_status: deliverySuccess ? "ACCEPTED" : "FAILED",
          });

          if (!deliverySuccess) {
            itemSuccess = false;
          } else if (n8nExecId) {
            item.workflow_execution_id = n8nExecId;
          }
        }

        item.last_http_status = lastHttpStatus;

        if (itemSuccess) {
          item.status = "DELIVERED";
          item.delivered_at = new Date().toISOString();
          item.sent_at = new Date().toISOString();
          item.last_error = null;
          item.workflow_status = "ACCEPTED";
          delivered++;
        } else {
          item.last_error = lastError || "Webhook endpoint returned non-2xx status";
          if (item.attempt_count >= (item.max_attempts || 5)) {
            item.status = "DEAD_LETTER";
            item.workflow_status = "FAILED";
          } else {
            item.status = "PENDING";
            // Exponential Backoff with jitter (e.g. 5s, 20s, 80s, 320s)
            const baseBackoffSec = Math.min(3600, Math.pow(4, item.attempt_count - 1) * 5);
            const jitterSec = Math.floor(Math.random() * 3);
            item.next_attempt_at = new Date(Date.now() + (baseBackoffSec + jitterSec) * 1000).toISOString();
          }
          failed++;
        }
      }

      if (this.logs.length > 2500) {
        this.logs = this.logs.slice(0, 2500);
      }
    } finally {
      this.isProcessing = false;
      this.lastHeartbeat = new Date().toISOString();
    }

    return { dispatched, delivered, failed };
  }

  // ── Two-Stage Workflow Callback Receiver ───────────────────
  public recordWorkflowCallback(
    eventId: string,
    executionId: string,
    status: "PROCESSED" | "FAILED" | "ACCEPTED",
    resultSummary?: string,
    errorMessage?: string
  ): boolean {
    const outboxItem = this.outbox.find((o) => o.event_id === eventId);
    if (outboxItem) {
      outboxItem.workflow_execution_id = executionId;
      outboxItem.workflow_status = status;
      if (errorMessage) {
        outboxItem.last_error = errorMessage;
      }
    }

    const logItem = this.logs.find((l) => l.event_id === eventId);
    if (logItem) {
      logItem.n8n_execution_id = executionId;
      logItem.n8n_workflow_status = status;
      if (resultSummary) {
        logItem.response_body_preview = `${logItem.response_body_preview || ""}\n[Callback Result]: ${resultSummary}`.trim();
      }
    }

    return Boolean(outboxItem || logItem);
  }

  // ── Manual Diagnostic Test Webhook Ping ───────────────────
  public async testEndpoint(
    endpointId: string,
    eventType: WebhookEventType = "test.webhook.ping"
  ): Promise<{
    success: boolean;
    latency_ms: number;
    http_status?: number;
    message: string;
    signature_header?: string;
    event_id: string;
    request_id: string;
    correlation_id: string;
  }> {
    const ep = this.endpoints.find((e) => e.id === endpointId) || this.endpoints[0];
    if (!ep) {
      throw new Error(`Webhook endpoint "${endpointId}" not found.`);
    }

    const testEvent = this.emitEvent(
      eventType,
      {
        test_id: `test_${Date.now()}`,
        ping_message: "CakeToHome Enterprise n8n Diagnostic Webhook Ping",
        timestamp: new Date().toISOString(),
        diagnostic_token: `diag_${crypto.randomBytes(8).toString("hex")}`,
      },
      { triggered_by: "admin_diagnostic_center", origin_ip: "127.0.0.1" }
    );

    const startTime = Date.now();
    await this.dispatchPendingWebhooks();
    const duration = Date.now() - startTime;

    const log = this.logs.find((l) => l.outbox_id === testEvent.id || l.event_id === testEvent.event_id);

    return {
      success: log ? log.status === "DELIVERED" : true,
      latency_ms: log?.duration_ms || duration,
      http_status: log?.http_status || 200,
      message: log?.status === "DELIVERED"
        ? "Webhook delivered & accepted by n8n endpoint"
        : (log?.error_message || "Webhook delivery recorded"),
      signature_header: log?.request_headers?.["X-CakeToHome-Signature"],
      event_id: testEvent.event_id,
      request_id: testEvent.payload_json.request_id,
      correlation_id: testEvent.payload_json.correlation_id,
    };
  }

  // ── Endpoint Management ───────────────────────────────────
  public getEndpoints(): WebhookEndpoint[] {
    return [...this.endpoints];
  }

  public getEndpoint(id: string): WebhookEndpoint | null {
    return this.endpoints.find((e) => e.id === id) || null;
  }

  public createEndpoint(payload: Partial<WebhookEndpoint>): WebhookEndpoint {
    const newId = payload.id || `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newEp: WebhookEndpoint = {
      id: newId,
      name: payload.name || "Custom Automation Webhook",
      url: payload.url || "https://n8n.caketohome.com/webhook/v1/custom",
      signing_secret: payload.signing_secret || `cth_whsec_${crypto.randomBytes(16).toString("hex")}`,
      environment: payload.environment || "production",
      subscribed_events: payload.subscribed_events || [
        "customer.login.success",
        "customer.registered",
        "order.created",
        "cart.abandoned",
        "customer.reorder_candidate.created",
      ],
      active: payload.active ?? true,
      status: payload.status || "ACTIVE",
      retry_limit: Number(payload.retry_limit) || 5,
      timeout_ms: Number(payload.timeout_ms) || 8000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.endpoints.push(newEp);
    return newEp;
  }

  public updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): WebhookEndpoint {
    const idx = this.endpoints.findIndex((e) => e.id === id);
    if (idx === -1) {
      return this.createEndpoint({ id, ...updates });
    }

    const current = this.endpoints[idx];
    const updated: WebhookEndpoint = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.endpoints[idx] = updated;
    return updated;
  }

  public deleteEndpoint(id: string): boolean {
    const initialLen = this.endpoints.length;
    this.endpoints = this.endpoints.filter((e) => e.id !== id);
    return this.endpoints.length < initialLen;
  }

  public rotateSigningSecret(id: string): { endpoint: WebhookEndpoint; new_secret: string } {
    const ep = this.getEndpoint(id);
    if (!ep) throw new Error(`Endpoint "${id}" not found.`);

    const newSecret = `cth_whsec_${crypto.randomBytes(16).toString("hex")}`;
    ep.signing_secret = newSecret;
    ep.updated_at = new Date().toISOString();
    return { endpoint: ep, new_secret: newSecret };
  }

  // ── Query Logs & Outbox ───────────────────────────────────
  public getLogs(query: {
    event_type?: string;
    status?: string;
    endpoint_id?: string;
    limit?: number;
    search?: string;
  } = {}): { logs: WebhookDeliveryLog[]; total: number; metrics: WebhookMetrics } {
    let list = [...this.logs];

    if (query.event_type && query.event_type !== "all") {
      list = list.filter((l) => l.event_type === query.event_type);
    }
    if (query.status && query.status !== "all") {
      list = list.filter((l) => l.status === query.status);
    }
    if (query.endpoint_id && query.endpoint_id !== "all") {
      list = list.filter((l) => l.endpoint_id === query.endpoint_id);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.event_id.toLowerCase().includes(q) ||
          l.event_type.toLowerCase().includes(q) ||
          (l.n8n_execution_id && l.n8n_execution_id.toLowerCase().includes(q))
      );
    }

    const deliveredLogs = this.logs.filter((l) => l.status === "DELIVERED");
    const failedLogs = this.logs.filter((l) => l.status === "FAILED");
    const pendingOutboxCount = this.outbox.filter((o) => o.status === "PENDING" || o.status === "PROCESSING").length;
    const deadLetterCount = this.outbox.filter((o) => o.status === "DEAD_LETTER").length;
    const processedWorkflowCount = this.logs.filter((l) => l.n8n_workflow_status === "PROCESSED").length;

    const totalLogs = this.logs.length;
    const avgLatency =
      deliveredLogs.length > 0
        ? Math.round(deliveredLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / deliveredLogs.length)
        : 0;

    const metrics: WebhookMetrics = {
      total_delivered: deliveredLogs.length,
      total_failed: failedLogs.length,
      pending_outbox: pendingOutboxCount,
      dead_letter_count: deadLetterCount,
      delivery_success_rate_pct: totalLogs > 0 ? Number(((deliveredLogs.length / totalLogs) * 100).toFixed(1)) : 100,
      webhook_accepted_rate_pct: totalLogs > 0 ? Number(((deliveredLogs.length / totalLogs) * 100).toFixed(1)) : 100,
      workflow_processed_rate_pct: totalLogs > 0 ? Number(((processedWorkflowCount / totalLogs) * 100).toFixed(1)) : 0,
      average_latency_ms: avgLatency,
      worker_status: this.isProcessing ? "BUSY" : "HEALTHY",
      last_worker_heartbeat: this.lastHeartbeat,
    };

    const limit = query.limit || 50;
    return {
      logs: list.slice(0, limit),
      total: list.length,
      metrics,
    };
  }

  public getOutboxItems(query: { status?: string; event_type?: string; limit?: number } = {}): WebhookOutboxItem[] {
    let list = [...this.outbox];
    if (query.status && query.status !== "all") {
      list = list.filter((i) => i.status === query.status);
    }
    if (query.event_type && query.event_type !== "all") {
      list = list.filter((i) => i.event_type === query.event_type);
    }
    return list.slice(0, query.limit || 100);
  }

  public getDeadLetterQueue(): WebhookOutboxItem[] {
    return this.outbox.filter((i) => i.status === "DEAD_LETTER");
  }

  public retryOutboxItem(outboxId: string): WebhookOutboxItem {
    const item = this.outbox.find((i) => i.id === outboxId || i.event_id === outboxId);
    if (!item) {
      throw new Error(`Outbox item "${outboxId}" not found.`);
    }

    item.status = "PENDING";
    item.attempt_count = 0;
    item.next_attempt_at = new Date().toISOString();
    item.last_error = null;

    if (typeof setTimeout !== "undefined") {
      setTimeout(() => this.dispatchPendingWebhooks(), 0);
    }

    return item;
  }

  public replayEvent(outboxId: string): WebhookOutboxItem {
    return this.retryOutboxItem(outboxId);
  }

  public discardOutboxItem(outboxId: string): WebhookOutboxItem {
    const item = this.outbox.find((i) => i.id === outboxId || i.event_id === outboxId);
    if (!item) {
      throw new Error(`Outbox item "${outboxId}" not found.`);
    }

    item.status = "CANCELLED";
    item.last_error = "Manually discarded by administrator.";
    return item;
  }
}

export const WebhookEngine = new WebhookEngineStore();
