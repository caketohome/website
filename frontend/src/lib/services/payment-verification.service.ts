/**
 * CakeToHome — Payment Verification, Status Synchronization & Order Confirmation Service
 * 
 * Implements:
 * 1. Cryptographic signature verification for Razorpay Webhooks and Client Checkouts (HMAC-SHA256).
 * 2. Strict webhook idempotency, replay protection, and audit logging via `payment_webhook_event`.
 * 3. Atomic database state transitions: order payment status, order confirmation status, and transaction ledger.
 * 4. Business rule validation: amount match, currency match, cancelled order protection, and duplicate avoidance.
 * 5. Downstream operational triggers: inventory movement deduction, KOT ticket generation, and notification queueing.
 */

import crypto from "crypto";
import { dbQuery, dbTransaction, getDbPool } from "../db";

export type PaymentStatus = 
  | "initiated"
  | "pending"
  | "captured"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type OrderPaymentStatus = 
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "payment_exception";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface WebhookProcessingResult {
  success: boolean;
  event_id?: string;
  order_id?: string;
  payment_id?: string;
  status: string;
  message?: string;
  idempotent?: boolean;
  statusCode?: number;
  downstream?: {
    kot_number?: string;
    inventory_deducted?: boolean;
    notifications_queued?: string[];
  };
}

export class PaymentVerificationService {
  /**
   * Secret resolution helper: retrieves webhook secret from environment with graceful fallbacks
   */
  static getWebhookSecret(customSecret?: string): string {
    if (customSecret) return customSecret;
    return (
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.WEBHOOK_SIGNING_SECRET ||
      "rzp_test_webhook_secret_cake2home_2026"
    );
  }

  /**
   * Secret resolution helper: retrieves key secret for client payment verification
   */
  static getKeySecret(customSecret?: string): string {
    if (customSecret) return customSecret;
    return (
      process.env.RAZORPAY_KEY_SECRET ||
      "rzp_test_key_secret_cake2home_2026"
    );
  }

  /**
   * Cryptographically verifies incoming Razorpay webhook signature using HMAC-SHA256
   * Uses timingSafeEqual to protect against side-channel timing attacks
   */
  static verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    secret?: string
  ): boolean {
    if (!rawBody || !signature) return false;
    const signingSecret = this.getWebhookSecret(secret);

    try {
      const hmac = crypto.createHmac("sha256", signingSecret);
      const digest = hmac.update(rawBody).digest("hex");

      const expectedBuffer = Buffer.from(digest, "utf8");
      const signatureBuffer = Buffer.from(signature, "utf8");

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (err) {
      console.error("[PaymentVerification] Webhook signature verification error:", err);
      return false;
    }
  }

  /**
   * Cryptographically verifies Razorpay checkout client callback signature
   * signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
   */
  static verifyPaymentSignature(
    params: { orderId: string; paymentId: string; signature: string },
    secret?: string
  ): boolean {
    const { orderId, paymentId, signature } = params;
    if (!orderId || !paymentId || !signature) return false;
    const keySecret = this.getKeySecret(secret);

    try {
      const data = `${orderId}|${paymentId}`;
      const digest = crypto.createHmac("sha256", keySecret).update(data).digest("hex");

      const expectedBuffer = Buffer.from(digest, "utf8");
      const signatureBuffer = Buffer.from(signature, "utf8");

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (err) {
      console.error("[PaymentVerification] Payment signature verification error:", err);
      return false;
    }
  }

  /**
   * Generates a new Razorpay Gateway Order for checkout initiation
   */
  static createGatewayOrder(params: {
    orderId: string;
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
  }) {
    const { orderId, amount, currency = "INR", receipt, notes = {} } = params;
    const amountInPaise = Math.round(amount * 100);
    const rzpOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      id: rzpOrderId,
      entity: "order",
      amount: amountInPaise,
      amount_paid: 0,
      amount_due: amountInPaise,
      currency,
      receipt: receipt || orderId,
      status: "created",
      attempts: 0,
      notes: {
        order_id: orderId,
        ...notes,
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Main Webhook Ingestion & Processing Pipeline
   * Handles signature validation, event deduplication, and transaction-safe dispatch.
   */
  static async processWebhookEvent(params: {
    rawBody: string | Buffer;
    signature: string;
    headers?: Record<string, string | string[] | undefined>;
    secret?: string;
    client?: any; // Optional pg client for testing/rehearsals
  }): Promise<WebhookProcessingResult> {
    const { rawBody, signature, secret } = params;
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");

    // 1. Cryptographic Signature Validation
    const isSignatureValid = this.verifyWebhookSignature(rawBody, signature, secret);

    let parsedPayload: any = {};
    try {
      parsedPayload = JSON.parse(bodyStr);
    } catch (e) {
      return {
        success: false,
        status: "invalid_json",
        message: "Failed to parse webhook JSON payload.",
        statusCode: 400,
      };
    }

    const event = parsedPayload.event || parsedPayload.type || "payment.captured";
    const paymentEntity = parsedPayload.payload?.payment?.entity || parsedPayload.payment || parsedPayload;
    const paymentId = paymentEntity.id || parsedPayload.payment_id || `pay_${Date.now()}`;
    const orderRef = paymentEntity.notes?.order_id || paymentEntity.order_id || parsedPayload.order_id;
    const eventId = 
      (params.headers?.["x-razorpay-event-id"] as string) ||
      parsedPayload.event_id ||
      `evt_${paymentId}_${event.replace(/\./g, "_")}`;

    const pool = getDbPool();
    const queryExecutor = params.client ? params.client : { query: (text: string, p?: any[]) => pool.query(text, p) };

    // Record Webhook Attempt in Ledger
    const webhookRecordId = `pwe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      await queryExecutor.query(
        `INSERT INTO public.payment_webhook_event (
          id, event_id, event_type, provider, provider_payment_id, provider_order_id,
          order_id, amount, currency, signature, signature_valid, payload, status, created_at
        ) VALUES ($1, $2, $3, 'razorpay', $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (event_id) DO NOTHING`,
        [
          webhookRecordId,
          eventId,
          event,
          paymentId,
          paymentEntity.order_id || null,
          orderRef || null,
          paymentEntity.amount ? Number(paymentEntity.amount) / 100 : 0,
          paymentEntity.currency || "INR",
          signature,
          isSignatureValid,
          JSON.stringify(parsedPayload),
          isSignatureValid ? "received" : "rejected_signature",
        ]
      );
    } catch (dbErr: any) {
      console.warn("[PaymentVerification] Error saving webhook entry:", dbErr.message);
    }

    // Fail-Closed on invalid cryptographic signature
    if (!isSignatureValid) {
      return {
        success: false,
        event_id: eventId,
        status: "rejected_signature",
        message: "Cryptographic signature verification failed. Request rejected.",
        statusCode: 400,
      };
    }

    // 2. Check for Duplicate Webhook Event (Idempotency)
    const existingProcessed = await queryExecutor.query(
      `SELECT id, status, processed_at FROM public.payment_webhook_event 
       WHERE event_id = $1 AND status IN ('processed', 'already_confirmed') AND id <> $2 
       LIMIT 1`,
      [eventId, webhookRecordId]
    );

    if (existingProcessed.rows.length > 0) {
      return {
        success: true,
        event_id: eventId,
        payment_id: paymentId,
        order_id: orderRef,
        status: "already_confirmed",
        idempotent: true,
        message: "Webhook event has already been processed (idempotent duplicate safely ignored).",
        statusCode: 200,
      };
    }

    // 3. Dispatch to Event-Specific Handlers
    let result: WebhookProcessingResult;
    try {
      if (event === "payment.captured" || event === "order.paid") {
        result = await this.confirmOrderPayment({
          orderRef,
          paymentId,
          gatewayOrderId: paymentEntity.order_id,
          amount: Number(paymentEntity.amount || 0),
          currency: paymentEntity.currency || "INR",
          signature,
          client: params.client,
          rawPayload: parsedPayload,
        });
      } else if (event === "payment.failed") {
        result = await this.handlePaymentFailed({
          orderRef,
          paymentId,
          gatewayOrderId: paymentEntity.order_id,
          errorCode: paymentEntity.error_code || "PAYMENT_FAILED",
          errorDescription: paymentEntity.error_description || "Payment failed via gateway",
          client: params.client,
          rawPayload: parsedPayload,
        });
      } else if (event === "refund.processed" || event === "refund.created") {
        const refundEntity = parsedPayload.payload?.refund?.entity || parsedPayload.refund || {};
        const refundPaymentId = refundEntity.payment_id || paymentId;
        const refundOrderRef = refundEntity.notes?.order_id || orderRef;
        result = await this.handlePaymentRefunded({
          orderRef: refundOrderRef,
          paymentId: refundPaymentId,
          refundId: refundEntity.id || `rfnd_${Date.now()}`,
          amount: Number(refundEntity.amount || paymentEntity.amount || 0),
          client: params.client,
          rawPayload: parsedPayload,
        });
      } else {
        result = {
          success: true,
          event_id: eventId,
          status: "event_acknowledged",
          message: `Event type ${event} acknowledged.`,
          statusCode: 200,
        };
      }

      // Mark webhook as processed
      await queryExecutor.query(
        `UPDATE public.payment_webhook_event 
         SET status = $1, error_message = $2, processed_at = NOW() 
         WHERE event_id = $3`,
        [result.status || "processed", result.message || null, eventId]
      );

      result.event_id = eventId;
      return result;
    } catch (err: any) {
      console.error("[PaymentVerification] Error during webhook processing:", err);
      await queryExecutor.query(
        `UPDATE public.payment_webhook_event 
         SET status = 'failed', error_message = $1, processed_at = NOW() 
         WHERE event_id = $2`,
        [err.message, eventId]
      );
      return {
        success: false,
        event_id: eventId,
        status: "processing_error",
        message: err.message,
        statusCode: 500,
      };
    }
  }

  /**
   * Authoritative, Transaction-Safe Order Confirmation & Synchronization Engine
   * Validates:
   * 1. Order existence
   * 2. Cancelled order guard (diverts to payment_exception workflow)
   * 3. Currency match
   * 4. Amount match
   * 5. Idempotent deduplication (safe double invocation)
   * 6. Downstream operations: stock deduction, KOT generation, notification queueing
   */
  static async confirmOrderPayment(params: {
    orderRef: string;
    paymentId: string;
    gatewayOrderId?: string;
    amount: number; // in paise or rupees
    currency?: string;
    signature?: string;
    client?: any;
    rawPayload?: any;
  }): Promise<WebhookProcessingResult> {
    const { orderRef, paymentId, gatewayOrderId, signature, rawPayload } = params;
    const currency = (params.currency || "INR").toUpperCase();

    // Standardize amount: if in paise (e.g., 118000), convert to rupees
    const rawAmount = Number(params.amount);
    const paidAmount = rawAmount > 5000 && rawAmount % 100 === 0 ? rawAmount / 100 : rawAmount;

    const executeInTransaction = async (txClient: any): Promise<WebhookProcessingResult> => {
      // 1. Fetch Order with Row-Level Lock (FOR UPDATE)
      const orderRes = await txClient.query(
        `SELECT id, order_number, status, payment_status, grand_total, currency_code, 
                metadata, customer_id, branch_id, customer_phone, customer_name, email
         FROM public."order"
         WHERE id = $1 
            OR order_number = $1 
            OR metadata->>'order_number' = $1 
            OR metadata->>'razorpay_order_id' = $1
         LIMIT 1
         FOR UPDATE`,
        [orderRef]
      );

      if (orderRes.rows.length === 0) {
        return {
          success: false,
          status: "rejected_missing_order",
          message: `Order reference '${orderRef}' does not exist in CakeToHome database.`,
          statusCode: 404,
        };
      }

      const order = orderRes.rows[0];
      const orderGrandTotal = Number(order.grand_total);
      const orderCurrency = (order.currency_code || "INR").toUpperCase();

      // 2. Cancelled Order Guard: Never confirm a cancelled order!
      if (order.status === "cancelled") {
        await txClient.query(
          `UPDATE public."order" 
           SET payment_status = 'payment_exception', 
               metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{payment_exception}', 
                 to_jsonb($1::text)
               ),
               updated_at = NOW() 
           WHERE id = $2`,
          [`Payment captured after cancellation (Payment ID: ${paymentId}). Flagged for refund.`, order.id]
        );

        // Record payment transaction as exception / flagged refund
        const ptxnId = `ptxn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await txClient.query(
          `INSERT INTO public.payment_transaction (
            id, company_id, branch_id, order_id, customer_id, amount, currency,
            status, settlement_status, provider, provider_ref, gateway_order_id,
            gateway_payment_id, gateway_signature, failure_reason, created_at, updated_at
          ) VALUES ($1, 'comp_cth_india', $2, $3, $4, $5, $6, 'captured', 'flagged_refund', 'razorpay', $7, $8, $7, $9, $10, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
          [
            ptxnId,
            order.branch_id || "br_indiranagar_01",
            order.id,
            order.customer_id || "cus_guest",
            paidAmount,
            currency,
            paymentId,
            gatewayOrderId || null,
            signature || null,
            "Payment received for cancelled order - flagged for human refund review",
          ]
        );

        // Audit log
        await txClient.query(
          `INSERT INTO public.order_status_history (
            id, order_id, from_status, to_status, actor_type, actor_id, reason, metadata, created_at, updated_at
          ) VALUES ($1, $2, 'cancelled', 'cancelled', 'payment_gateway', 'razorpay_webhook', $3, $4, NOW(), NOW())`,
          [
            `osh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            order.id,
            "Payment captured after cancellation - Diverted to payment_exception workflow",
            JSON.stringify({ payment_id: paymentId, paid_amount: paidAmount }),
          ]
        );

        return {
          success: false,
          order_id: order.id,
          payment_id: paymentId,
          status: "payment_exception",
          message: "Order was already cancelled. Payment recorded as exception and flagged for refund.",
          statusCode: 422,
        };
      }

      // 3. Currency Validation Guard
      if (currency !== orderCurrency) {
        await txClient.query(
          `UPDATE public."order" SET payment_status = 'payment_exception', updated_at = NOW() WHERE id = $1`,
          [order.id]
        );
        return {
          success: false,
          order_id: order.id,
          status: "payment_exception",
          message: `Currency mismatch: payment currency '${currency}' does not match order currency '${orderCurrency}'.`,
          statusCode: 400,
        };
      }

      // 4. Amount Mismatch Validation Guard
      if (Math.abs(paidAmount - orderGrandTotal) > 0.05) {
        await txClient.query(
          `UPDATE public."order" 
           SET payment_status = 'payment_exception', 
               metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{amount_mismatch_details}', 
                 to_jsonb($1::text)
               ),
               updated_at = NOW() 
           WHERE id = $2`,
          [`Expected INR ${orderGrandTotal}, but received INR ${paidAmount} via Razorpay ${paymentId}`, order.id]
        );

        const ptxnId = `ptxn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await txClient.query(
          `INSERT INTO public.payment_transaction (
            id, company_id, branch_id, order_id, customer_id, amount, currency,
            status, settlement_status, provider, provider_ref, gateway_order_id,
            gateway_payment_id, gateway_signature, failure_reason, created_at, updated_at
          ) VALUES ($1, 'comp_cth_india', $2, $3, $4, $5, $6, 'captured', 'amount_mismatch', 'razorpay', $7, $8, $7, $9, $10, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
          [
            ptxnId,
            order.branch_id || "br_indiranagar",
            order.id,
            order.customer_id || "cus_guest",
            paidAmount,
            currency,
            paymentId,
            gatewayOrderId || null,
            signature || null,
            `Amount mismatch: paid INR ${paidAmount} vs order due INR ${orderGrandTotal}`,
          ]
        );

        return {
          success: false,
          order_id: order.id,
          payment_id: paymentId,
          status: "payment_exception",
          message: `Amount mismatch: paid INR ${paidAmount} does not match order total INR ${orderGrandTotal}. Flagged for review.`,
          statusCode: 422,
        };
      }

      // 5. Idempotency Check: Already Confirmed & Paid
      if (order.status === "confirmed" && order.payment_status === "paid") {
        const existingTxn = await txClient.query(
          `SELECT id FROM public.payment_transaction WHERE gateway_payment_id = $1 OR provider_ref = $1 LIMIT 1`,
          [paymentId]
        );

        if (existingTxn.rows.length > 0) {
          return {
            success: true,
            order_id: order.id,
            payment_id: paymentId,
            status: "already_confirmed",
            idempotent: true,
            message: "Order has already been confirmed and paid. Idempotent request safely preserved.",
            statusCode: 200,
          };
        }
      }

      // 6. Execute State Transition: Confirm Order & Mark Paid
      const updatedMetadata = {
        ...(order.metadata || {}),
        payment_verified: true,
        payment_id: paymentId,
        gateway_order_id: gatewayOrderId || order.metadata?.razorpay_order_id || null,
        payment_captured_at: new Date().toISOString(),
        payment_gateway: "razorpay",
        amount_paid: paidAmount,
      };

      await txClient.query(
        `UPDATE public."order"
         SET status = 'confirmed',
             payment_status = 'paid',
             payment_method = 'razorpay',
             metadata = $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(updatedMetadata), order.id]
      );

      // Record / Update Payment Transaction Ledger
      const paymentTxnId = `ptxn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await txClient.query(
        `INSERT INTO public.payment_transaction (
          id, company_id, branch_id, order_id, customer_id, amount, currency,
          idempotency_key, status, settlement_status, provider, provider_ref,
          gateway_order_id, gateway_payment_id, gateway_signature, metadata, created_at, updated_at
        ) VALUES ($1, 'comp_cth_india', $2, $3, $4, $5, $6, $7, 'captured', 'settled', 'razorpay', $8, $9, $8, $10, $11, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE 
        SET status = 'captured', settlement_status = 'settled', updated_at = NOW()`,
        [
          paymentTxnId,
          order.branch_id || "br_indiranagar",
          order.id,
          order.customer_id || "cus_guest",
          paidAmount,
          currency,
          `webhook_${paymentId}`,
          paymentId,
          gatewayOrderId || null,
          signature || null,
          JSON.stringify({ raw: rawPayload || {} }),
        ]
      );

      // Record Order Status History
      const historyId = `osh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await txClient.query(
        `INSERT INTO public.order_status_history (
          id, order_id, from_status, to_status, actor_type, actor_id, reason, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, 'confirmed', 'payment_gateway', 'razorpay_webhook', $4, $5, NOW(), NOW())`,
        [
          historyId,
          order.id,
          order.status || "pending",
          "Payment verified and captured via Razorpay. Order confirmed automatically.",
          JSON.stringify({ payment_id: paymentId, amount: paidAmount, currency }),
        ]
      );

      // 7. Downstream Operations:
      // a) Inventory Deduction & Movement Recording (Idempotent)
      let inventoryDeducted = false;
      const existingMovement = await txClient.query(
        `SELECT id FROM public.inventory_movement WHERE order_id = $1 AND movement_type = 'SALE' LIMIT 1`,
        [order.id]
      );

      if (existingMovement.rows.length === 0) {
        const orderItems = await txClient.query(
          `SELECT id, product_id, quantity, metadata FROM public.order_item WHERE order_id = $1`,
          [order.id]
        );

        for (const item of orderItems.rows) {
          if (item.product_id) {
            // Check if product exists in database before recording inventory movement
            const prodExists = await txClient.query(
              `SELECT 1 FROM public.product WHERE id = $1 LIMIT 1`,
              [item.product_id]
            );

            if (prodExists.rows.length > 0) {
              const movementId = `im_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              await txClient.query(
                `INSERT INTO public.inventory_movement (
                  id, branch_id, product_id, variant_id, movement_type, quantity,
                  direction, order_id, reference_no, narration, created_by, created_at
                ) VALUES ($1, $2, $3, $4, 'SALE', $5, 'OUT', $6, $7, $8, 'system_payment_engine', NOW())`,
                [
                  movementId,
                  order.branch_id || "br_indiranagar_01",
                  item.product_id,
                  item.metadata?.variant_id || null,
                  Math.abs(Number(item.quantity) || 1),
                  order.id,
                  order.order_number || order.id,
                  `Automatic inventory deduction on payment confirmation for Order ${order.order_number || order.id}`,
                ]
              );

              // Update branch_inventory quantity if record exists
              await txClient.query(
                `UPDATE public.branch_inventory 
                 SET quantity = quantity - $1, updated_at = NOW() 
                 WHERE branch_id = $2 AND product_id = $3`,
                [
                  Math.abs(Number(item.quantity) || 1),
                  order.branch_id || "br_indiranagar_01",
                  item.product_id,
                ]
              );
            }
          }
        }
        inventoryDeducted = true;
      }

      // b) Kitchen Order Ticket (KOT) Generation
      const kotNumber = order.metadata?.kot_number || `KOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      // c) Queue Automated Customer Notifications (SMS, WhatsApp, Email)
      const notificationsQueued: string[] = [];
      const customerPhone = order.customer_phone || order.metadata?.phone || "9876543210";
      const customerEmail = order.email || order.metadata?.email || "customer@cakes2home.com";
      const customerName = order.customer_name || "Valued Customer";

      const existingNotifications = await txClient.query(
        `SELECT id FROM public.customer_notification_queue WHERE order_id = $1 AND template = 'order_confirmed_sms' LIMIT 1`,
        [order.id]
      );

      if (existingNotifications.rows.length === 0) {
        // SMS Notification
        const smsId = `cnq_sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await txClient.query(
          `INSERT INTO public.customer_notification_queue (
            id, order_id, customer_id, channel, recipient, template, payload, status, created_at
          ) VALUES ($1, $2, $3, 'sms', $4, 'order_confirmed_sms', $5, 'queued', NOW())`,
          [
            smsId,
            order.id,
            order.customer_id,
            customerPhone,
            JSON.stringify({
              order_number: order.order_number || order.id,
              customer_name: customerName,
              amount: paidAmount,
              delivery_date: order.metadata?.delivery_date || "Today",
              tracking_url: `https://cakes2home.com/your-order?order_id=${order.id}`,
            }),
          ]
        );
        notificationsQueued.push("sms");

        // WhatsApp Notification
        const waId = `cnq_wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await txClient.query(
          `INSERT INTO public.customer_notification_queue (
            id, order_id, customer_id, channel, recipient, template, payload, status, created_at
          ) VALUES ($1, $2, $3, 'whatsapp', $4, 'order_confirmed_whatsapp', $5, 'queued', NOW())`,
          [
            waId,
            order.id,
            order.customer_id,
            customerPhone,
            JSON.stringify({
              order_number: order.order_number || order.id,
              customer_name: customerName,
              amount: paidAmount,
              kot_number: kotNumber,
              tracking_url: `https://cakes2home.com/your-order?order_id=${order.id}`,
            }),
          ]
        );
        notificationsQueued.push("whatsapp");

        // Email Notification
        if (customerEmail) {
          const emailId = `cnq_em_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await txClient.query(
            `INSERT INTO public.customer_notification_queue (
              id, order_id, customer_id, channel, recipient, template, payload, status, created_at
            ) VALUES ($1, $2, $3, 'email', $4, 'order_receipt_email', $5, 'queued', NOW())`,
            [
              emailId,
              order.id,
              order.customer_id,
              customerEmail,
              JSON.stringify({
                order_number: order.order_number || order.id,
                customer_name: customerName,
                grand_total: paidAmount,
                payment_id: paymentId,
              }),
            ]
          );
          notificationsQueued.push("email");
        }
      }

      return {
        success: true,
        order_id: order.id,
        payment_id: paymentId,
        status: "confirmed",
        message: `Order ${order.order_number || order.id} successfully paid and automatically confirmed.`,
        statusCode: 200,
        downstream: {
          kot_number: kotNumber,
          inventory_deducted: inventoryDeducted,
          notifications_queued: notificationsQueued,
        },
      };
    };

    if (params.client) {
      return executeInTransaction(params.client);
    } else {
      return dbTransaction(executeInTransaction);
    }
  }

  /**
   * Handle Payment Failure
   * Updates payment_transaction to 'failed', order payment_status to 'failed', and logs event.
   */
  static async handlePaymentFailed(params: {
    orderRef: string;
    paymentId: string;
    gatewayOrderId?: string;
    errorCode?: string;
    errorDescription?: string;
    client?: any;
    rawPayload?: any;
  }): Promise<WebhookProcessingResult> {
    const { orderRef, paymentId, gatewayOrderId, errorCode, errorDescription } = params;

    const executeInTx = async (txClient: any): Promise<WebhookProcessingResult> => {
      const orderRes = await txClient.query(
        `SELECT id, order_number, status, payment_status, metadata, customer_phone 
         FROM public."order" 
         WHERE id = $1 OR order_number = $1 OR metadata->>'order_number' = $1 OR metadata->>'razorpay_order_id' = $1
         LIMIT 1`,
        [orderRef]
      );

      let order = orderRes.rows[0];
      let orderId = order ? order.id : orderRef;

      // If order not found directly by ref, lookup via payment_transaction using paymentId
      if (!order && paymentId) {
        const txnMatch = await txClient.query(
          `SELECT order_id FROM public.payment_transaction WHERE gateway_payment_id = $1 OR provider_ref = $1 LIMIT 1`,
          [paymentId]
        );
        if (txnMatch.rows.length > 0) {
          orderId = txnMatch.rows[0].order_id;
          const retryOrder = await txClient.query(
            `SELECT id, order_number, status, payment_status, metadata, customer_phone FROM public."order" WHERE id = $1 LIMIT 1`,
            [orderId]
          );
          order = retryOrder.rows[0];
        }
      }

      // Update payment_transaction
      const ptxnId = `ptxn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await txClient.query(
        `INSERT INTO public.payment_transaction (
          id, company_id, branch_id, order_id, customer_id, amount, currency,
          status, settlement_status, provider, provider_ref, gateway_order_id,
          gateway_payment_id, error_code, failure_reason, created_at, updated_at
        ) VALUES ($1, 'comp_cth_india', $2, $3, 'cus_guest', 0, 'INR', 'failed', 'failed', 'razorpay', $4, $5, $4, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING`,
        [
          ptxnId,
          order?.branch_id || "br_indiranagar",
          orderId,
          paymentId,
          gatewayOrderId || null,
          errorCode || "PAYMENT_FAILED",
          errorDescription || "Payment failed via gateway",
        ]
      );

      if (order && order.payment_status !== "paid") {
        await txClient.query(
          `UPDATE public."order"
           SET payment_status = 'failed',
               metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{payment_failure_reason}', to_jsonb($1::text)),
               updated_at = NOW()
           WHERE id = $2`,
          [errorDescription || errorCode || "Payment failed", order.id]
        );

        // Status history
        await txClient.query(
          `INSERT INTO public.order_status_history (
            id, order_id, from_status, to_status, actor_type, actor_id, reason, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $3, 'payment_gateway', 'razorpay_webhook', $4, $5, NOW(), NOW())`,
          [
            `osh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            order.id,
            order.status || "pending",
            `Payment attempt failed: ${errorDescription || errorCode}`,
            JSON.stringify({ payment_id: paymentId, error_code: errorCode }),
          ]
        );

        // Queue payment failed customer alert
        if (order.customer_phone) {
          const failAlertId = `cnq_fail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await txClient.query(
            `INSERT INTO public.customer_notification_queue (
              id, order_id, customer_id, channel, recipient, template, payload, status, created_at
            ) VALUES ($1, $2, $3, 'sms', $4, 'payment_failed_alert', $5, 'queued', NOW())`,
            [
              failAlertId,
              order.id,
              order.customer_id,
              order.customer_phone,
              JSON.stringify({
                order_number: order.order_number || order.id,
                reason: errorDescription || "Payment failed",
                retry_url: `https://cakes2home.com/checkout?order_id=${order.id}`,
              }),
            ]
          );
        }
      }

      return {
        success: true,
        order_id: orderId,
        payment_id: paymentId,
        status: "failed",
        message: `Payment failed recorded: ${errorDescription || errorCode}`,
        statusCode: 200,
      };
    };

    if (params.client) return executeInTx(params.client);
    return dbTransaction(executeInTx);
  }

  /**
   * Handle Refund Processed
   * Updates payment_transaction to 'refunded', order payment_status to 'refunded'.
   */
  static async handlePaymentRefunded(params: {
    orderRef: string;
    paymentId: string;
    refundId: string;
    amount: number;
    client?: any;
    rawPayload?: any;
  }): Promise<WebhookProcessingResult> {
    const { orderRef, paymentId, refundId } = params;
    const refundAmount = Number(params.amount) > 5000 ? Number(params.amount) / 100 : Number(params.amount);

    const executeInTx = async (txClient: any): Promise<WebhookProcessingResult> => {
      const orderRes = await txClient.query(
        `SELECT id, order_number, status, payment_status, metadata, customer_phone 
         FROM public."order" 
         WHERE id = $1 OR order_number = $1 OR metadata->>'order_number' = $1 OR metadata->>'razorpay_order_id' = $1
         LIMIT 1`,
        [orderRef]
      );

      let order = orderRes.rows[0];
      let orderId = order ? order.id : orderRef;

      // If order not found directly by ref, lookup via payment_transaction using paymentId
      if (!order && paymentId) {
        const txnMatch = await txClient.query(
          `SELECT order_id FROM public.payment_transaction WHERE gateway_payment_id = $1 OR provider_ref = $1 LIMIT 1`,
          [paymentId]
        );
        if (txnMatch.rows.length > 0) {
          orderId = txnMatch.rows[0].order_id;
          const retryOrder = await txClient.query(
            `SELECT id, order_number, status, payment_status, metadata, customer_phone FROM public."order" WHERE id = $1 LIMIT 1`,
            [orderId]
          );
          order = retryOrder.rows[0];
        }
      }

      // Update payment_transaction status to refunded
      await txClient.query(
        `UPDATE public.payment_transaction 
         SET status = 'refunded', refund_id = $1, updated_at = NOW() 
         WHERE provider_ref = $2 OR gateway_payment_id = $2 OR order_id = $3`,
        [refundId, paymentId, orderId]
      );

      if (order) {
        await txClient.query(
          `UPDATE public."order"
           SET payment_status = 'refunded',
               metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{refund_details}', 
                 $1::jsonb
               ),
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify({ refund_id: refundId, amount: refundAmount, refunded_at: new Date().toISOString() }), order.id]
        );

        // Status history
        await txClient.query(
          `INSERT INTO public.order_status_history (
            id, order_id, from_status, to_status, actor_type, actor_id, reason, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $3, 'payment_gateway', 'razorpay_webhook', 'Payment refunded via Razorpay', $4, NOW(), NOW())`,
          [
            `osh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            order.id,
            order.status,
            JSON.stringify({ payment_id: paymentId, refund_id: refundId, amount: refundAmount }),
          ]
        );
      }

      return {
        success: true,
        order_id: orderId,
        payment_id: paymentId,
        status: "refunded",
        message: `Refund of INR ${refundAmount} recorded successfully.`,
        statusCode: 200,
      };
    };

    if (params.client) return executeInTx(params.client);
    return dbTransaction(executeInTx);
  }

  /**
   * Status Query Engine for Frontend Real-time Polling & Live Watchers
   */
  static async getOrderPaymentStatus(orderId: string, client?: any) {
    const pool = getDbPool();
    const queryExecutor = client ? client : { query: (t: string, p?: any[]) => pool.query(t, p) };

    const res = await queryExecutor.query(
      `SELECT id, order_number, status, payment_status, payment_method, grand_total, currency_code, 
              metadata, created_at, updated_at
       FROM public."order"
       WHERE id = $1 OR order_number = $1 OR metadata->>'order_number' = $1
       LIMIT 1`,
      [orderId]
    );

    if (res.rows.length === 0) {
      return { found: false, error: "Order not found" };
    }

    const o = res.rows[0];
    const isPaid = (o.payment_status || "").toLowerCase() === "paid" || (o.payment_status || "").toLowerCase() === "captured";
    const isConfirmed = (o.status || "").toLowerCase() === "confirmed";

    return {
      found: true,
      order_id: o.id,
      order_number: o.order_number,
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      grand_total: Number(o.grand_total),
      currency: o.currency_code || "INR",
      is_paid: isPaid,
      is_confirmed: isConfirmed,
      delivery_otp: o.metadata?.delivery_otp || null,
      kot_number: o.metadata?.kot_number || null,
      updated_at: o.updated_at,
    };
  }
}
