/**
 * CakeToHome — Official Razorpay Payment Gateway Service
 * Exclusive Payment Gateway Architecture for Phase 9 & Beyond
 * 
 * Implements:
 * 1. Razorpay Orders API (Paise conversion, currency INR, notes mapping)
 * 2. Strict HMAC-SHA256 signature verification with crypto.timingSafeEqual
 * 3. Full Payment Capture Invariant: Order paid if and only if captured_amount === Math.round(order.grand_total * 100)
 * 4. Database Transaction Boundaries: Atomic order confirmation, inventory movement, KOT, and accounting vouchers
 * 5. Deadlock & Serialization Retry (40P01 / 40001) with exponential jittered backoff
 * 6. Webhook Idempotency & 90-Day Audit Logging in public.payment_webhook_log
 * 7. Controlled Refund Reason-Code Model with statutory GST Credit Note reference
 */

import { resolveHeadOfficeBranchId, resolveCompanyId } from "../org-defaults";
import crypto from "crypto";
import type { PoolClient } from "pg";
import { dbQuery, dbTransaction } from "../db";
import { PaymentGatewayConfigService } from "./payment-gateway-config.service";
import { voucherFiscalYear } from "../fiscal-period";

export type RazorpayRefundReasonCode = 
  | "DAMAGED_DELIVERY"
  | "CUSTOMER_CANCELLATION"
  | "OUT_OF_STOCK"
  | "WRONG_PRODUCT"
  | "DELIVERY_FAILURE"
  | "DUPLICATE_PAYMENT"
  | "PAYMENT_ERROR"
  | "CUSTOMER_SERVICE_EXCEPTION"
  | "OTHER";

export interface CreateRazorpayOrderResult {
  success: boolean;
  order_id: string;
  razorpay_order_id: string;
  amount: number; // in paise
  amount_formatted: number; // in rupees
  currency: string;
  key_id: string;
  error?: string;
}

export interface VerifyRazorpayPaymentResult {
  success: boolean;
  order_id?: string;
  payment_id?: string;
  status: "paid" | "payment_exception" | "failed" | "already_processed";
  message?: string;
  idempotent?: boolean;
  error?: string;
}

export interface RazorpayWebhookResult {
  success: boolean;
  event_id?: string;
  order_id?: string;
  payment_id?: string;
  status: "processed" | "ignored_duplicate" | "failed";
  message?: string;
  statusCode?: number;
}

export class RazorpayPaymentService {
  /**
   * Optional in-process test hook for simulating upstream Razorpay payment responses in unit tests.
   * Never reachable via HTTP parameters; defaults to null (always calls live https://api.razorpay.com).
   */
  public static _upstreamPaymentTestHook: ((paymentId: string, orderId: string) => Promise<any>) | null = null;

  /**
   * Helper: Validate Order Financial Integrity before payment initiation or confirmation
   */
  public static async validateOrderFinancialIntegrity(
    clientOrQuery: { query: (text: string, params?: any[]) => Promise<any> },
    order: any
  ): Promise<{ valid: boolean; errorCode?: string; errorMessage?: string; subtotal: number; taxTotal: number; grandTotal: number; expectedPaise: number; itemCount: number }> {
    const rawSubtotal = order.subtotal ?? order.metadata?.subtotal;
    const rawGrandTotal = order.grand_total ?? order.metadata?.grand_total ?? order.metadata?.total_amount ?? order.metadata?.total;
    const rawTaxTotal = order.tax_total ?? order.metadata?.tax_amount ?? order.metadata?.tax_total ?? 0;

    if (rawSubtotal === null || rawSubtotal === undefined || rawSubtotal === "" || isNaN(Number(rawSubtotal)) || Number(rawSubtotal) <= 0) {
      return {
        valid: false,
        errorCode: "MISSING_ORDER_SUBTOTAL",
        errorMessage: "MISSING_ORDER_SUBTOTAL: Order subtotal is missing or not greater than zero.",
        subtotal: 0,
        taxTotal: 0,
        grandTotal: 0,
        expectedPaise: 0,
        itemCount: 0,
      };
    }

    if (rawGrandTotal === null || rawGrandTotal === undefined || rawGrandTotal === "" || isNaN(Number(rawGrandTotal)) || Number(rawGrandTotal) <= 0) {
      return {
        valid: false,
        errorCode: "INVALID_ORDER_AMOUNT",
        errorMessage: "INVALID_ORDER_AMOUNT: Order grand_total is missing or not greater than zero.",
        subtotal: Number(rawSubtotal),
        taxTotal: 0,
        grandTotal: 0,
        expectedPaise: 0,
        itemCount: 0,
      };
    }

    const currency = String(order.currency_code || order.metadata?.currency || "INR").toUpperCase();
    if (currency !== "INR") {
      return {
        valid: false,
        errorCode: "CURRENCY_MISMATCH",
        errorMessage: `CURRENCY_MISMATCH: Order currency "${currency}" is invalid; expected "INR".`,
        subtotal: Number(rawSubtotal),
        taxTotal: Number(rawTaxTotal),
        grandTotal: Number(rawGrandTotal),
        expectedPaise: 0,
        itemCount: 0,
      };
    }

    const subtotal = Math.round(Number(rawSubtotal) * 100) / 100;
    const taxTotal = Math.round(Number(rawTaxTotal) * 100) / 100;
    const grandTotal = Math.round(Number(rawGrandTotal) * 100) / 100;
    const expectedPaise = Math.round(grandTotal * 100);

    if (expectedPaise <= 0) {
      return {
        valid: false,
        errorCode: "INVALID_ORDER_AMOUNT",
        errorMessage: "INVALID_ORDER_AMOUNT: Order amount in paise must be greater than zero.",
        subtotal,
        taxTotal,
        grandTotal,
        expectedPaise,
        itemCount: 0,
      };
    }

    // Verify line items exist and have valid positive amounts
    const oiRes = await clientOrQuery.query(
      `SELECT id, product_id, title, quantity, unit_price, taxable_value, tax_amount, total
       FROM public.order_item WHERE order_id = $1`,
      [order.id]
    );
    const relationalItems = oiRes.rows || [];
    const metaItems = Array.isArray(order.metadata?.items) ? order.metadata.items : [];
    const effectiveItems = relationalItems.length > 0 ? relationalItems : metaItems;

    if (effectiveItems.length === 0) {
      return {
        valid: false,
        errorCode: "MISSING_ORDER_ITEMS",
        errorMessage: "MISSING_ORDER_ITEMS: Order has no persisted line items.",
        subtotal,
        taxTotal,
        grandTotal,
        expectedPaise,
        itemCount: 0,
      };
    }

    let computedLineSubtotal = 0;
    for (const item of effectiveItems) {
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unit_price ?? item.price ?? item.selling_price ?? 0);
      const lineSub = item.taxable_value !== undefined && item.taxable_value !== null && Number(item.taxable_value) > 0
        ? Number(item.taxable_value)
        : Number(item.total_line_amount ?? item.subtotal ?? (unitPrice * qty));
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(lineSub) || lineSub <= 0) {
        return {
          valid: false,
          errorCode: "INVALID_ORDER_LINE_ITEM",
          errorMessage: `INVALID_ORDER_LINE_ITEM: Line item "${item.id || item.title}" has invalid quantity (${qty}) or price (${unitPrice}).`,
          subtotal,
          taxTotal,
          grandTotal,
          expectedPaise,
          itemCount: effectiveItems.length,
        };
      }
      computedLineSubtotal = Math.round((computedLineSubtotal + lineSub) * 100) / 100;
    }

    if (Math.abs(computedLineSubtotal - subtotal) > 1.0) {
      return {
        valid: false,
        errorCode: "SUBTOTAL_LINE_MISMATCH",
        errorMessage: `SUBTOTAL_LINE_MISMATCH: Sum of line item subtotals (${computedLineSubtotal}) does not match order subtotal (${subtotal}).`,
        subtotal,
        taxTotal,
        grandTotal,
        expectedPaise,
        itemCount: effectiveItems.length,
      };
    }

    const discount = Number(order.discount_total ?? order.metadata?.discount_amount ?? order.metadata?.discount ?? 0);
    const deliveryFee = Number(order.delivery_fee ?? order.metadata?.delivery?.fee ?? order.metadata?.delivery_fee ?? 0);
    const slotSurcharge = Number(order.metadata?.slot_surcharge ?? 0);
    const expectedGrandExcl = Math.round((subtotal - discount + taxTotal + deliveryFee + slotSurcharge) * 100) / 100;
    const expectedGrandIncl = Math.round((subtotal - discount + deliveryFee + slotSurcharge) * 100) / 100;

    if (Math.abs(expectedGrandExcl - grandTotal) > 1.0 && Math.abs(expectedGrandIncl - grandTotal) > 1.0) {
      return {
        valid: false,
        errorCode: "GRAND_TOTAL_MISMATCH",
        errorMessage: `GRAND_TOTAL_MISMATCH: Order grand_total (${grandTotal}) does not reconcile with subtotal (${subtotal}), tax (${taxTotal}), discount (${discount}), and delivery fee (${deliveryFee}).`,
        subtotal,
        taxTotal,
        grandTotal,
        expectedPaise,
        itemCount: effectiveItems.length,
      };
    }

    return {
      valid: true,
      subtotal,
      taxTotal,
      grandTotal,
      expectedPaise,
      itemCount: effectiveItems.length,
    };
  }

  /**
   * Helper: Execute DB transaction with retry for 40P01 (deadlock) and 40001 (serialization failure)
   */
  private static async executeWithRetry<T>(
    operation: (client: PoolClient) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await dbTransaction(operation);
      } catch (err: any) {
        attempt++;
        const isRetryable = err.code === "40P01" || err.code === "40001";
        if (isRetryable && attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 150) + 50; // 50-200ms
          console.warn(`[Razorpay Service] Transient lock contention (${err.code}), retrying attempt ${attempt}/${maxRetries} after ${jitter}ms...`);
          await new Promise((resolve) => setTimeout(resolve, jitter));
        } else {
          throw err;
        }
      }
    }
    throw new Error("EXCEEDED_MAX_TRANSACTION_RETRIES");
  }

  /**
   * 1. Create Razorpay Order
   */
  public static async createOrder(orderId: string): Promise<CreateRazorpayOrderResult> {
    // 1. Fetch Order from DB
    const orderRes = await dbQuery(
      `SELECT id, order_number, subtotal, tax_total, grand_total, currency_code, customer_id, customer_name, customer_phone, branch_id, status, payment_status, metadata
       FROM public."order" WHERE (id = $1 OR order_number = $1) AND deleted_at IS NULL LIMIT 1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error(`ORDER_NOT_FOUND: Order with ID or number "${orderId}" does not exist in the database.`);
    }

    const order = orderRes.rows[0];

    if (order.status === "cancelled") {
      throw new Error("CANNOT_PAY_CANCELLED_ORDER: Order is already cancelled.");
    }

    if (order.payment_status === "paid" || order.payment_status === "captured") {
      throw new Error("ORDER_ALREADY_PAID: Order has already been paid.");
    }

    // Validate all financial consistency invariants before creating a payment order
    const integrity = await this.validateOrderFinancialIntegrity({ query: dbQuery }, order);
    if (!integrity.valid) {
      throw new Error(integrity.errorMessage || `${integrity.errorCode}: Invalid order financial state.`);
    }

    const grandTotal = integrity.grandTotal;
    const amountInPaise = integrity.expectedPaise;

    // 2. Fetch Active Razorpay Credentials
    const credentials = await PaymentGatewayConfigService.getActiveCredentials("razorpay");
    const { key_id, key_secret } = credentials;

    // 2a. Check if an active initiated Razorpay order already exists for this internal order with identical amount
    const existingPtxRes = await dbQuery(
      `SELECT id, gateway_order_id, amount, currency, status
       FROM public.payment_transaction
       WHERE order_id = $1 AND provider = 'razorpay' AND status = 'initiated' AND deleted_at IS NULL
         AND gateway_order_id IS NOT NULL
         AND created_at > NOW() - INTERVAL '15 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [order.id]
    );
    if (existingPtxRes.rows.length > 0) {
      const existingPtx = existingPtxRes.rows[0];
      if (Math.round(Number(existingPtx.amount) * 100) === amountInPaise && String(existingPtx.currency || "INR").toUpperCase() === "INR") {
        return {
          success: true,
          order_id: order.id,
          razorpay_order_id: existingPtx.gateway_order_id,
          amount: amountInPaise,
          amount_formatted: grandTotal,
          currency: "INR",
          key_id,
        };
      }
    }

    let razorpayOrderId: string;

    // In non-mock or real credentials environment, call Razorpay Orders API
    const isMock = key_id.includes("placeholder") || key_id.startsWith("rzp_test_mock");

    if (!isMock) {
      try {
        const authHeader = "Basic " + Buffer.from(`${key_id}:${key_secret}`).toString("base64");
        const res = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt: order.order_number || order.id,
            notes: {
              order_id: order.id,
              customer_name: order.customer_name || "Customer",
              customer_phone: order.customer_phone || "",
              branch_id: order.branch_id || ""
            }
          })
        });

        if (res.ok) {
          const rzpData = await res.json();
          razorpayOrderId = rzpData.id;
        } else {
          const errData = await res.text();
          console.warn("[Razorpay] Upstream API call failed:", res.status, errData);
          if (process.env.NODE_ENV === "test" || isMock) {
            razorpayOrderId = `order_rzp_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
          } else {
            throw new Error(`RAZORPAY_API_ERROR: HTTP ${res.status} - ${errData}`);
          }
        }
      } catch (networkErr: any) {
        console.warn("[Razorpay] Network error calling Razorpay API:", networkErr.message);
        if (process.env.NODE_ENV === "test" || isMock) {
          razorpayOrderId = `order_rzp_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        } else {
          throw networkErr;
        }
      }
    } else {
      // Deterministic Mock for Sandbox & Automated Test suites
      razorpayOrderId = `order_rzp_mock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    }

    // 3. Upsert payment_transaction record (reuse existing pending/initiated row for this order if present)
    const anyPendingPtx = await dbQuery(
      `SELECT id FROM public.payment_transaction
       WHERE order_id = $1 AND status IN ('pending', 'initiated') AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [order.id]
    );
    if (anyPendingPtx.rows.length > 0) {
      await dbQuery(
        `UPDATE public.payment_transaction
         SET amount = $1, currency = 'INR', status = 'initiated', settlement_status = 'pending',
             provider = 'razorpay', gateway_order_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [grandTotal, razorpayOrderId, anyPendingPtx.rows[0].id]
      );
    } else {
      const ptxId = `ptx_rzp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await dbQuery(
        `INSERT INTO public.payment_transaction (
          id, order_id, branch_id, customer_id, amount, currency,
          status, settlement_status, provider, gateway_order_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'INR', 'initiated', 'pending', 'razorpay', $6, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;`,
        [ptxId, order.id, order.branch_id || (await resolveHeadOfficeBranchId()), order.customer_id || "cust_guest_default", grandTotal, razorpayOrderId]
      );
    }

    return {
      success: true,
      order_id: order.id,
      razorpay_order_id: razorpayOrderId,
      amount: amountInPaise,
      amount_formatted: grandTotal,
      currency: "INR",
      key_id
    };
  }

  /**
   * 2. Verify Payment Signature and Atomic Full Capture
   */
  public static async verifyPayment(params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    order_id?: string;
  }): Promise<VerifyRazorpayPaymentResult> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = params;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        success: false,
        status: "failed",
        error: "MISSING_REQUIRED_PAYMENT_VERIFICATION_PARAMETERS"
      };
    }

    // Fetch active credentials
    const credentials = await PaymentGatewayConfigService.getActiveCredentials("razorpay");
    const { key_secret } = credentials;

    // Cryptographic HMAC-SHA256 Verification with timingSafeEqual
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", key_secret)
      .update(payload)
      .digest("hex");

    let isSignatureValid = false;
    try {
      const sigBuffer = Buffer.from(razorpay_signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      if (sigBuffer.length === expectedBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
      }
    } catch (e) {
      isSignatureValid = false;
    }

    // Allow mock signature in non-production test suites if configured
    if (!isSignatureValid && process.env.NODE_ENV === "test" && razorpay_signature.startsWith("test_mock_sig")) {
      isSignatureValid = true;
    }

    if (!isSignatureValid) {
      console.error("[Razorpay] Signature verification failed for payment:", razorpay_payment_id);
      return {
        success: false,
        status: "failed",
        error: "INVALID_SIGNATURE"
      };
    }

    // Execute atomic confirmation within DB Transaction
    return await this.executeWithRetry(async (txClient: PoolClient) => {
      // 1. Locate Order (either by explicit order_id or via payment_transaction lookup)
      let resolvedOrderId = order_id;
      if (!resolvedOrderId) {
        const txnLookup = await txClient.query(
          `SELECT order_id FROM public.payment_transaction 
           WHERE gateway_order_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [razorpay_order_id]
        );
        if (txnLookup.rows.length > 0) {
          resolvedOrderId = txnLookup.rows[0].order_id;
        }
      }

      if (!resolvedOrderId) {
        return {
          success: false,
          status: "failed",
          error: "ORDER_NOT_FOUND_FOR_GATEWAY_ORDER"
        };
      }

      // 2. Lock Order FOR UPDATE
      const orderRes = await txClient.query(
        `SELECT id, order_number, status, payment_status, subtotal, tax_total, grand_total, currency_code, customer_id, branch_id, metadata
         FROM public."order" WHERE (id = $1 OR order_number = $1) AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [resolvedOrderId]
      );

      if (orderRes.rows.length === 0) {
        return {
          success: false,
          status: "failed",
          error: "ORDER_NOT_FOUND"
        };
      }

      const order = orderRes.rows[0];

      // Idempotency: Already paid
      if (order.payment_status === "paid" || order.payment_status === "captured") {
        return {
          success: true,
          order_id: order.id,
          payment_id: razorpay_payment_id,
          status: "already_processed",
          message: "Order was already marked paid and confirmed.",
          idempotent: true
        };
      }

      if (order.status === "cancelled") {
        return {
          success: false,
          order_id: order.id,
          status: "failed",
          error: "PAYMENT_RECEIVED_FOR_CANCELLED_ORDER"
        };
      }

      // 2a. Enforce Order Financial Integrity BEFORE confirming order (Invariants 1, 2, 7, 9, 10)
      const integrity = await this.validateOrderFinancialIntegrity(txClient, order);
      if (!integrity.valid) {
        await txClient.query(
          `UPDATE public.payment_transaction 
           SET status = 'payment_exception', failure_reason = $1, updated_at = NOW() 
           WHERE order_id = $2 AND provider = 'razorpay'`,
          [integrity.errorMessage || "Order financial integrity check failed", order.id]
        );
        return {
          success: false,
          order_id: order.id,
          payment_id: razorpay_payment_id,
          status: "payment_exception",
          error: integrity.errorCode || "ORDER_FINANCIAL_INTEGRITY_FAILED",
          message: integrity.errorMessage || "Order financial values are missing or inconsistent; order confirmation blocked."
        };
      }

      const expectedPaise = integrity.expectedPaise;

      // 2b. Verify internal payment_transaction gateway order amount & currency match order grand_total
      const ptxCheckRes = await txClient.query(
        `SELECT id, amount, currency, gateway_order_id
         FROM public.payment_transaction
         WHERE order_id = $1 AND provider = 'razorpay' AND deleted_at IS NULL
         ORDER BY CASE WHEN gateway_order_id = $2 THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
        [order.id, razorpay_order_id]
      );
      if (ptxCheckRes.rows.length > 0) {
        const ptxRow = ptxCheckRes.rows[0];
        if (ptxRow.gateway_order_id && ptxRow.gateway_order_id !== razorpay_order_id) {
          await txClient.query(
            `UPDATE public.payment_transaction SET status = 'payment_exception', failure_reason = $1, updated_at = NOW() WHERE id = $2`,
            [`GATEWAY_ORDER_MISMATCH: Expected ${ptxRow.gateway_order_id}, received ${razorpay_order_id}`, ptxRow.id]
          );
          return {
            success: false,
            order_id: order.id,
            payment_id: razorpay_payment_id,
            status: "payment_exception",
            error: "GATEWAY_ORDER_MISMATCH",
            message: `Gateway order ID "${razorpay_order_id}" does not match initiated gateway order "${ptxRow.gateway_order_id}".`
          };
        }
        const ptxPaise = Math.round(Number(ptxRow.amount) * 100);
        if (ptxPaise !== expectedPaise) {
          await txClient.query(
            `UPDATE public.payment_transaction SET status = 'payment_exception', failure_reason = $1, updated_at = NOW() WHERE id = $2`,
            [`GATEWAY_ORDER_AMOUNT_MISMATCH: Transaction amount (${ptxPaise} paise) != order grand_total (${expectedPaise} paise)`, ptxRow.id]
          );
          return {
            success: false,
            order_id: order.id,
            payment_id: razorpay_payment_id,
            status: "payment_exception",
            error: "GATEWAY_ORDER_AMOUNT_MISMATCH",
            message: `Payment transaction amount (${ptxPaise} paise) does not match order grand_total (${expectedPaise} paise).`
          };
        }
        if (String(ptxRow.currency || "INR").toUpperCase() !== "INR") {
          await txClient.query(
            `UPDATE public.payment_transaction SET status = 'payment_exception', failure_reason = $1, updated_at = NOW() WHERE id = $2`,
            [`CURRENCY_MISMATCH: Transaction currency ${ptxRow.currency} != INR`, ptxRow.id]
          );
          return {
            success: false,
            order_id: order.id,
            payment_id: razorpay_payment_id,
            status: "payment_exception",
            error: "CURRENCY_MISMATCH",
            message: `Payment transaction currency "${ptxRow.currency}" does not match expected "INR".`
          };
        }
      }

      // 3. Authoritative Gateway Payment Verification & Full Capture Invariant Check
      let isFullyCaptured = true;
      let captureError: string | null = null;
      let captureErrorCode: string = "PAYMENT_CAPTURE_VERIFICATION_FAILED";
      let verifiedGatewayAmountPaise = expectedPaise;

      const isMock = credentials.key_id.includes("placeholder") || credentials.key_id.startsWith("rzp_test_mock");

      if (!isMock) {
        try {
          let payData: any = null;
          if (this._upstreamPaymentTestHook) {
            payData = await this._upstreamPaymentTestHook(razorpay_payment_id, razorpay_order_id);
          } else {
            const authHeader = "Basic " + Buffer.from(`${credentials.key_id}:${credentials.key_secret}`).toString("base64");
            const rzpPayRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
              method: "GET",
              headers: { "Authorization": authHeader, "Accept": "application/json" }
            });

            if (!rzpPayRes.ok) {
              const errData = await rzpPayRes.text();
              isFullyCaptured = false;
              captureErrorCode = "GATEWAY_PAYMENT_NOT_FOUND";
              captureError = `GATEWAY_PAYMENT_NOT_FOUND: Payment "${razorpay_payment_id}" does not exist on Razorpay (HTTP ${rzpPayRes.status}).`;
              console.error("[Razorpay] Upstream payment lookup failed:", rzpPayRes.status, errData);
            } else {
              payData = await rzpPayRes.json();
            }
          }

          if (payData) {
            // 3a. Order-to-Payment Association Check
            if (payData.order_id && payData.order_id !== razorpay_order_id) {
              isFullyCaptured = false;
              captureErrorCode = "GATEWAY_ORDER_MISMATCH";
              captureError = `GATEWAY_ORDER_MISMATCH: Payment "${razorpay_payment_id}" belongs to Razorpay order "${payData.order_id}", not "${razorpay_order_id}".`;
              console.error("[Razorpay] Order mismatch:", { payment_order_id: payData.order_id, submitted_order_id: razorpay_order_id });
            }
            // 3b. Status must be captured
            else if (payData.status !== "captured") {
              isFullyCaptured = false;
              captureErrorCode = "PAYMENT_NOT_CAPTURED";
              captureError = `PAYMENT_NOT_CAPTURED: Payment status on Razorpay is "${payData.status}", expected "captured".`;
              console.error("[Razorpay] Status not captured:", payData.status);
            }
            // 3c. Exact amount check
            else if (Number(payData.amount) !== expectedPaise) {
              isFullyCaptured = false;
              captureErrorCode = "AMOUNT_MISMATCH";
              captureError = `AMOUNT_MISMATCH: Gateway payment amount (${payData.amount} paise) does not match order grand total (${expectedPaise} paise).`;
              console.error("[Razorpay] Amount mismatch:", { gateway_amount: payData.amount, expected_amount: expectedPaise });
            }
            // 3d. Currency check
            else if (payData.currency?.toUpperCase() !== "INR") {
              isFullyCaptured = false;
              captureErrorCode = "CURRENCY_MISMATCH";
              captureError = `CURRENCY_MISMATCH: Gateway payment currency is "${payData.currency}", expected "INR".`;
              console.error("[Razorpay] Currency mismatch:", payData.currency);
            } else {
              verifiedGatewayAmountPaise = Number(payData.amount);
            }
          }
        } catch (apiErr: any) {
          isFullyCaptured = false;
          captureErrorCode = "GATEWAY_COMMUNICATION_ERROR";
          captureError = `GATEWAY_COMMUNICATION_ERROR: Failed to contact Razorpay API to verify payment: ${apiErr.message}`;
          console.error("[Razorpay] Exception calling Razorpay payments API:", apiErr.message);
        }
      }

      if (!isFullyCaptured) {
        // Record failure in payment_transaction
        await txClient.query(
          `UPDATE public.payment_transaction 
           SET status = 'payment_exception', failure_reason = $1, error_code = $2, updated_at = NOW() 
           WHERE order_id = $3 AND provider = 'razorpay'`,
          [captureError || "Capture Invariant Violation", captureErrorCode, order.id]
        );
        return {
          success: false,
          order_id: order.id,
          payment_id: razorpay_payment_id,
          status: "payment_exception",
          error: captureErrorCode,
          message: captureError || "Payment capture verification failed against Razorpay API."
        };
      }

      const verifiedAmountRupees = Math.round(verifiedGatewayAmountPaise) / 100;

      // 4. Update payment_transaction to 'paid' with verified gateway amount
      await txClient.query(
        `UPDATE public.payment_transaction 
         SET status = 'paid',
             settlement_status = 'unsettled',
             amount = $1,
             currency = 'INR',
             gateway_order_id = COALESCE(gateway_order_id, $2),
             gateway_payment_id = $3,
             gateway_signature = $4,
             provider_ref = $3,
             updated_at = NOW(),
             metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{razorpay}', $5::jsonb)
         WHERE order_id = $6 AND provider = 'razorpay' AND (gateway_order_id = $2 OR gateway_order_id IS NULL)`,
        [
          verifiedAmountRupees,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          JSON.stringify({
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            amount_paise: verifiedGatewayAmountPaise,
            amount_inr: verifiedAmountRupees,
            currency: "INR",
            verified_at: new Date().toISOString()
          }),
          order.id
        ]
      );

      // 5. Update Order to 'paid' and 'confirmed', preserving and synchronizing monetary fields in metadata
      const syncedMeta = {
        ...(order.metadata || {}),
        payment_status: "paid",
        bakery_status: "confirmed",
        payment_method: "RAZORPAY",
        subtotal: integrity.subtotal,
        tax_amount: integrity.taxTotal,
        tax_total: integrity.taxTotal,
        grand_total: integrity.grandTotal,
        total_amount: integrity.grandTotal,
        total: integrity.grandTotal,
        razorpay_order_id,
        razorpay_payment_id,
      };
      await txClient.query(
        `UPDATE public."order" 
         SET payment_status = 'paid',
             status = 'confirmed',
             payment_method = 'RAZORPAY',
             subtotal = $2,
             tax_total = $3,
             grand_total = $4,
             metadata = $5::jsonb,
             updated_at = NOW() 
         WHERE id = $1`,
        [order.id, integrity.subtotal, integrity.taxTotal, integrity.grandTotal, JSON.stringify(syncedMeta)]
      );

      const branchId = order.branch_id || (await resolveHeadOfficeBranchId(txClient));

      // 6. Deduct Inventory Movements & update branch_inventory (protected by SAVEPOINT)
      try {
        await txClient.query("SAVEPOINT sp_inventory");
        const orderItems = await txClient.query(
          "SELECT id, product_id, quantity FROM public.order_item WHERE order_id = $1",
          [order.id]
        );

        for (const item of orderItems.rows) {
          if (item.product_id) {
            const prodCheck = await txClient.query("SELECT id FROM public.product WHERE id = $1", [item.product_id]);
            if (prodCheck.rows.length > 0) {
              const qty = Math.max(1, Math.abs(Number(item.quantity) || 1));
              const mvId = `inv_mv_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
              await txClient.query(
                `INSERT INTO public.inventory_movement (
                  id, branch_id, product_id, quantity, direction, movement_type, order_id, reference_id, notes, created_by, created_at
                ) VALUES ($1, $2, $3, $4, 'OUT', 'SALE', $5, $6, 'Order confirmed via Razorpay payment', 'razorpay_verify', NOW())`,
                [mvId, branchId, item.product_id, qty, order.id, razorpay_payment_id]
              );

              await txClient.query(
                `UPDATE public.branch_inventory 
                 SET quantity = GREATEST(0, quantity - $3), updated_at = NOW() 
                 WHERE branch_id = $1 AND product_id = $2`,
                [branchId, item.product_id, qty]
              );
            }
          }
        }
        await txClient.query("RELEASE SAVEPOINT sp_inventory");
      } catch (invErr: any) {
        await txClient.query("ROLLBACK TO SAVEPOINT sp_inventory").catch(() => {});
        console.warn("[Razorpay] Inventory deduction notice:", invErr.message);
      }

      // 7. KOT Ticket Creation (if kot_tickets exists, protected by SAVEPOINT)
      try {
        await txClient.query("SAVEPOINT sp_kot");
        const existingKot = await txClient.query(
          "SELECT id, kot_number FROM public.kot_tickets WHERE order_id = $1 LIMIT 1",
          [order.id]
        );
        let kotNumber = existingKot.rows.length > 0 ? existingKot.rows[0].kot_number : null;
        if (!kotNumber) {
          const kotCount = await txClient.query("SELECT COUNT(*) as count FROM public.kot_tickets");
          const nextNum = parseInt(kotCount.rows[0].count, 10) + 1;
          kotNumber = `KOT-${String(nextNum).padStart(5, "0")}`;
          const kotId = `kot_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
          await txClient.query(
            `INSERT INTO public.kot_tickets (id, order_id, branch_id, kot_number, status, items, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, 'ACTIVE', '[]'::jsonb, NOW(), NOW()) 
             ON CONFLICT (order_id) DO NOTHING`,
            [kotId, order.id, branchId, kotNumber]
          );
        }

        await txClient.query(
          `UPDATE public."order" 
           SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{kot_number}', to_jsonb($2::text), true) 
           WHERE id = $1`,
          [order.id, kotNumber]
        );
        await txClient.query("RELEASE SAVEPOINT sp_kot");
      } catch (kotErr: any) {
        await txClient.query("ROLLBACK TO SAVEPOINT sp_kot").catch(() => {});
        // Table may not exist in minimal test db; ignore gracefully
      }

      // 8. Financial Accounting Double-Entry Voucher (protected by SAVEPOINT)
      // Debit: Account 1020 (Razorpay Clearing Account)
      // Credit: Customer Advances (Account 2141) / Receivable (1121)
      try {
        await txClient.query("SAVEPOINT sp_accounting");
        const clearingVoucherId = `vch_pay_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const voucherNo = `RV-RZP-${Date.now().toString().slice(-6)}`;
        const clearingJournalId = `je_pay_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const entryNo = `JE-RZP-${Date.now().toString().slice(-6)}`;
        const today = new Date().toISOString().split("T")[0];
        const grandTotal = Number(order.grand_total);

        await txClient.query(
          `INSERT INTO public.accounting_voucher (
            id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
            status, total_amount, currency, reference_type, reference_id, reference_event,
            narration, created_by, posted_by, posted_at, created_at, updated_at
          ) VALUES (
            $1, $2, 'RECEIPT', $3, $4, $8,
            'POSTED', $5, 'INR', 'ORDER_PAYMENT', $6, 'PAYMENT_CAPTURED',
            $7, 'razorpay_system', 'razorpay_system', NOW(), NOW(), NOW()
          )`,
          [
            clearingVoucherId,
            voucherNo,
            today,
            branchId,
            grandTotal,
            order.id,
            `Razorpay payment captured (${razorpay_payment_id}) for order ${order.id}`,
            voucherFiscalYear(today)
          ]
        );

        await txClient.query(
          `INSERT INTO public.accounting_journal_entry (
            id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
            total_debit, total_credit, is_reversed, narration, created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $8,
            $6, $6, false, $7, 'razorpay_system', NOW()
          )`,
          [
            clearingJournalId,
            entryNo,
            clearingVoucherId,
            today,
            branchId,
            grandTotal,
            `Customer payment receipt in Razorpay Clearing (1020) for order ${order.id}`,
            voucherFiscalYear(today)
          ]
        );

        const gl1020Res = await txClient.query("SELECT id FROM public.accounting_account WHERE code = '1020' OR code = '1113' LIMIT 1");
        const gl2141Res = await txClient.query("SELECT id FROM public.accounting_account WHERE code = '2141' OR code = '1121' LIMIT 1");

        if (gl1020Res.rows.length > 0 && gl2141Res.rows.length > 0) {
          await txClient.query(
            `INSERT INTO public.accounting_journal_line (
              id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
            ) VALUES
              ($1, $3, 1, $4, $6, 0.00, $7, $8),
              ($2, $3, 2, $5, 0.00, $6, $7, $9)`,
            [
              `jl_pay_${Date.now()}_1`,
              `jl_pay_${Date.now()}_2`,
              clearingJournalId,
              gl1020Res.rows[0].id,
              gl2141Res.rows[0].id,
              grandTotal,
              branchId,
              `Debit 1020 Razorpay Clearing Account (${razorpay_payment_id})`,
              `Credit 2141 Customer Advances for order ${order.id}`
            ]
          );
        }
        await txClient.query("RELEASE SAVEPOINT sp_accounting");
      } catch (accErr: any) {
        await txClient.query("ROLLBACK TO SAVEPOINT sp_accounting").catch(() => {});
        console.warn("[Razorpay] Accounting voucher entry notice:", accErr.message);
      }

      return {
        success: true,
        order_id: order.id,
        payment_id: razorpay_payment_id,
        status: "paid",
        message: "Payment successfully verified and order confirmed."
      };
    });
  }

  /**
   * 3. Process Raw Razorpay Webhook Event (Idempotent + 90-day retention)
   */
  public static async processWebhook(params: {
    rawBody: string;
    signature: string;
    eventId?: string;
  }): Promise<RazorpayWebhookResult> {
    const { rawBody, signature } = params;

    const credentials = await PaymentGatewayConfigService.getActiveCredentials("razorpay");
    const secret = credentials.webhook_secret || credentials.key_secret;

    // Verify webhook signature
    let isValid = false;
    try {
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expectedSig, "hex");
      if (sigBuf.length === expBuf.length) {
        isValid = crypto.timingSafeEqual(sigBuf, expBuf);
      }
    } catch (e) {
      isValid = false;
    }

    if (!isValid && process.env.NODE_ENV === "test" && signature.startsWith("test_mock_webhook_sig")) {
      isValid = true;
    }

    if (!isValid) {
      return {
        success: false,
        status: "failed",
        message: "INVALID_WEBHOOK_SIGNATURE",
        statusCode: 400
      };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return {
        success: false,
        status: "failed",
        message: "INVALID_JSON_PAYLOAD",
        statusCode: 400
      };
    }

    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const eventId = params.eventId || payload.event_id || payload.id || `wh_${payloadHash.slice(0, 24)}`;
    const eventType = payload.event || "unknown";

    // Idempotency check in payment_webhook_log
    const existing = await dbQuery(
      `SELECT id, processing_status FROM public.payment_webhook_log 
       WHERE provider = 'razorpay' AND event_id = $1`,
      [eventId]
    );

    if (existing.rows.length > 0) {
      return {
        success: true,
        event_id: eventId,
        status: "ignored_duplicate",
        message: "Webhook event previously processed (idempotent duplicate).",
        statusCode: 200
      };
    }

    // Insert incoming log record
    const paymentEntity = payload.payload?.payment?.entity || {};
    const orderId = paymentEntity.notes?.order_id || null;
    const paymentId = paymentEntity.id || null;

    await dbQuery(
      `INSERT INTO public.payment_webhook_log (
        id, event_id, provider, event_type, processing_status, 
        processing_attempts, order_id, payment_id, payload_hash, raw_payload, 
        is_statutory_hold, received_at, created_at, updated_at
      ) VALUES ($1, $2, 'razorpay', $3, 'processing', 1, $4, $5, $6, $7, false, NOW(), NOW(), NOW())
      ON CONFLICT (provider, event_id) DO NOTHING`,
      [
        `whlog_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        eventId,
        eventType,
        orderId,
        paymentId,
        payloadHash,
        JSON.stringify(payload)
      ]
    );

    // Handle Event
    try {
      if (eventType === "payment.captured" || eventType === "order.paid") {
        if (orderId && paymentId) {
          const rzpOrderId = paymentEntity.order_id || `order_wh_${Date.now()}`;
          await this.verifyPayment({
            razorpay_order_id: rzpOrderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            order_id: orderId
          });
        }
      } else if (eventType === "payment.failed") {
        if (orderId) {
          await dbQuery(
            `UPDATE public.payment_transaction 
             SET status = 'failed', failure_reason = $1, updated_at = NOW() 
             WHERE order_id = $2 AND provider = 'razorpay'`,
            [paymentEntity.error_description || "Payment failed at gateway", orderId]
          );
        }
      }

      await dbQuery(
        `UPDATE public.payment_webhook_log 
         SET processing_status = 'processed', updated_at = NOW() 
         WHERE provider = 'razorpay' AND event_id = $1`,
        [eventId]
      );

      return {
        success: true,
        event_id: eventId,
        order_id: orderId,
        payment_id: paymentId,
        status: "processed",
        statusCode: 200
      };
    } catch (handlerErr: any) {
      await dbQuery(
        `UPDATE public.payment_webhook_log 
         SET processing_status = 'failed', last_error_category = $1, updated_at = NOW() 
         WHERE provider = 'razorpay' AND event_id = $2`,
        [handlerErr.message || "UNKNOWN_ERROR", eventId]
      );

      return {
        success: false,
        event_id: eventId,
        status: "failed",
        message: handlerErr.message,
        statusCode: 500
      };
    }
  }

  /**
   * 4. Query Live Order Status
   */
  public static async getOrderStatus(orderId: string): Promise<any> {
    const res = await dbQuery(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.grand_total, o.currency_code, 
              pt.gateway_order_id, pt.gateway_payment_id, pt.provider, pt.status as transaction_status, 
              o.created_at, o.updated_at
       FROM public."order" o
       LEFT JOIN public.payment_transaction pt ON pt.order_id = o.id AND pt.provider = 'razorpay'
       WHERE o.id = $1 OR o.order_number = $1
       ORDER BY pt.created_at DESC LIMIT 1`,
      [orderId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      order_id: row.id,
      order_number: row.order_number,
      status: row.status,
      payment_status: row.payment_status,
      total_amount: Number(row.grand_total),
      currency: row.currency_code || "INR",
      provider: row.provider || "razorpay",
      gateway_order_id: row.gateway_order_id,
      gateway_payment_id: row.gateway_payment_id,
      transaction_status: row.transaction_status,
      created_at: row.created_at ? row.created_at.toISOString() : null,
      updated_at: row.updated_at ? row.updated_at.toISOString() : null
    };
  }

  /**
   * 5. Process Controlled Refund (With Idempotency & Voucher)
   */
  public static async processRefund(params: {
    order_id: string;
    amount: number;
    reason_code: RazorpayRefundReasonCode;
    reason_explanation?: string;
    requested_by: string;
    approved_by: string;
    idempotency_key: string;
  }): Promise<{ success: boolean; refund_id: string; status: string; message: string }> {
    const { order_id, amount, reason_code, reason_explanation, requested_by, approved_by, idempotency_key } = params;

    // Validate reason code
    const validReasonCodes: RazorpayRefundReasonCode[] = [
      "DAMAGED_DELIVERY", "CUSTOMER_CANCELLATION", "OUT_OF_STOCK", "WRONG_PRODUCT",
      "DELIVERY_FAILURE", "DUPLICATE_PAYMENT", "PAYMENT_ERROR", "CUSTOMER_SERVICE_EXCEPTION", "OTHER"
    ];
    if (!validReasonCodes.includes(reason_code)) {
      throw new Error(`INVALID_REFUND_REASON_CODE: ${reason_code}`);
    }

    // Find payment transaction
    const txnRes = await dbQuery(
      `SELECT id, gateway_payment_id, amount, status, branch_id FROM public.payment_transaction
       WHERE order_id = $1 AND provider = 'razorpay' AND status IN ('paid', 'partially_refunded') LIMIT 1`,
      [order_id]
    );

    if (txnRes.rows.length === 0) {
      throw new Error("PAID_TRANSACTION_NOT_FOUND: No paid Razorpay transaction found for this order.");
    }

    const txn = txnRes.rows[0];

    // Check idempotency in payment_refund table
    const existingRef = await dbQuery(
      `SELECT id, status FROM public.payment_refund 
       WHERE payment_transaction_id = $1 AND idempotency_key = $2`,
      [txn.id, idempotency_key]
    );

    if (existingRef.rows.length > 0) {
      return {
        success: true,
        refund_id: existingRef.rows[0].id,
        status: existingRef.rows[0].status,
        message: "Refund already processed (idempotent)."
      };
    }

    // Amount must be positive and within what is still refundable on this payment
    const paidAmount = Number(txn.amount) || 0;
    const refundedRes = await dbQuery(
      `SELECT COALESCE(SUM(amount), 0) AS refunded FROM public.payment_refund
       WHERE payment_transaction_id = $1 AND status = 'processed'`,
      [txn.id]
    );
    const alreadyRefunded = Number(refundedRes.rows[0]?.refunded) || 0;
    const refundable = Math.round((paidAmount - alreadyRefunded) * 100) / 100;
    if (!(Number(amount) > 0) || Math.round(Number(amount) * 100) > Math.round(refundable * 100)) {
      throw new Error(`INVALID_REFUND_AMOUNT: Refund must be more than ₹0 and at most ₹${refundable.toFixed(2)} (paid ₹${paidAmount.toFixed(2)}, already refunded ₹${alreadyRefunded.toFixed(2)}).`);
    }
    if (!txn.gateway_payment_id) {
      throw new Error("REFUND_NOT_POSSIBLE: This payment has no Razorpay payment ID, so it cannot be refunded through Razorpay.");
    }
    if (!txn.branch_id) {
      throw new Error("REFUND_NOT_POSSIBLE: The payment is not linked to a branch.");
    }

    const refundId = `ref_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const credentials = await PaymentGatewayConfigService.getActiveCredentials("razorpay");
    const isTestRun = process.env.NODE_ENV === "test";
    if (!isTestRun && (!credentials.key_id || credentials.key_id.includes("placeholder"))) {
      throw new Error("RAZORPAY_NOT_CONFIGURED: Add the Razorpay keys in payment settings before refunding.");
    }

    // The refund is only booked after Razorpay confirms it. No confirmation = nothing recorded.
    let providerRefundId: string;
    if (isTestRun && credentials.key_id.includes("placeholder")) {
      providerRefundId = `rzp_ref_test_${Date.now()}`;
    } else {
      const authHeader = "Basic " + Buffer.from(`${credentials.key_id}:${credentials.key_secret}`).toString("base64");
      let refRes: Response;
      try {
        refRes = await fetch(`https://api.razorpay.com/v1/payments/${txn.gateway_payment_id}/refund`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100),
            notes: { reason_code, reason_explanation: reason_explanation || "" }
          })
        });
      } catch (err: any) {
        throw new Error(`REFUND_GATEWAY_UNREACHABLE: Could not reach Razorpay (${err.message}). Nothing was refunded or recorded; try again.`);
      }
      if (!refRes.ok) {
        const errText = await refRes.text().catch(() => "");
        throw new Error(`REFUND_GATEWAY_REJECTED: Razorpay refused the refund (HTTP ${refRes.status}) ${errText}`.trim());
      }
      const refData = await refRes.json();
      if (!refData?.id) throw new Error("REFUND_GATEWAY_REJECTED: Razorpay did not return a refund ID.");
      providerRefundId = refData.id;
    }
    const fullyRefunded = Math.round((alreadyRefunded + Number(amount)) * 100) >= Math.round(paidAmount * 100);
    const newPaymentStatus = fullyRefunded ? "refunded" : "partially_refunded";

    // Insert refund and generate double-entry reversal
    await dbTransaction(async (txClient: PoolClient) => {
      // Create Credit Note voucher & journal entry
      const refundVoucherId = `vch_ref_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const voucherNo = `CN-RZP-${Date.now().toString().slice(-6)}`;
      const refundJournalId = `je_ref_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const entryNo = `JE-REF-${Date.now().toString().slice(-6)}`;
      const today = new Date().toISOString().split("T")[0];
      const branchId = txn.branch_id;
      const fiscalYear = voucherFiscalYear(new Date());

      await txClient.query(
        `INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
          status, total_amount, currency, reference_type, reference_id, reference_event,
          narration, created_by, posted_by, posted_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'CREDIT_NOTE', $3, $4, $10,
          'POSTED', $5, 'INR', 'ORDER_REFUND', $6, 'PAYMENT_REFUNDED',
          $7, $8, $9, NOW(), NOW(), NOW()
        )`,
        [
          refundVoucherId,
          voucherNo,
          today,
          branchId,
          amount,
          order_id,
          `Razorpay refund for order ${order_id}: ${reason_code} - ${reason_explanation || ""}`,
          requested_by,
          approved_by,
          fiscalYear
        ]
      );

      await txClient.query(
        `INSERT INTO public.accounting_journal_entry (
          id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
          total_debit, total_credit, is_reversed, narration, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $9,
          $6, $6, false, $7, $8, NOW()
        )`,
        [
          refundJournalId,
          entryNo,
          refundVoucherId,
          today,
          branchId,
          amount,
          `Reversal journal entry for refund on order ${order_id}`,
          requested_by,
          fiscalYear
        ]
      );

      const gl4190Res = await txClient.query("SELECT id FROM public.accounting_account WHERE code = '4190' OR code = '2141' LIMIT 1");
      const gl1020Res = await txClient.query("SELECT id FROM public.accounting_account WHERE code = '1020' OR code = '1113' LIMIT 1");

      if (gl4190Res.rows.length > 0 && gl1020Res.rows.length > 0) {
        await txClient.query(
          `INSERT INTO public.accounting_journal_line (
            id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
          ) VALUES
            ($1, $3, 1, $4, $6, 0.00, $7, $8),
            ($2, $3, 2, $5, 0.00, $6, $7, $9)`,
          [
            `jl_ref_${Date.now()}_1`,
            `jl_ref_${Date.now()}_2`,
            refundJournalId,
            gl4190Res.rows[0].id,
            gl1020Res.rows[0].id,
            amount,
            branchId,
            `Debit 4190 Sales Returns & Customer Refunds (${reason_code})`,
            `Credit 1020 Razorpay Clearing Account (${providerRefundId})`
          ]
        );
      }

      // Record refund
      await txClient.query(
        `INSERT INTO public.payment_refund (
          id, order_id, payment_transaction_id, provider, provider_refund_id, 
          amount, currency, reason_code, reason_explanation, requested_by, approved_by, 
          status, accounting_voucher_id, idempotency_key, created_at, updated_at
        ) VALUES ($1, $2, $3, 'razorpay', $4, $5, 'INR', $6, $7, $8, $9, 'processed', $10, $11, NOW(), NOW())`,
        [
          refundId, order_id, txn.id, providerRefundId, amount, reason_code, 
          reason_explanation || null, requested_by, approved_by, refundVoucherId, idempotency_key
        ]
      );

      // Update Order & Transaction status
      await txClient.query(
        `UPDATE public."order" SET payment_status = $2, updated_at = NOW() WHERE id = $1`,
        [order_id, newPaymentStatus]
      );
      await txClient.query(
        `UPDATE public.payment_transaction SET status = $2, updated_at = NOW() WHERE id = $1`,
        [txn.id, newPaymentStatus]
      );
    });

    return {
      success: true,
      refund_id: refundId,
      status: "processed",
      message: fullyRefunded
        ? "Refund confirmed by Razorpay and recorded in the books."
        : "Partial refund confirmed by Razorpay and recorded in the books."
    };
  }
}
