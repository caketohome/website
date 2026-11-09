import { NextRequest, NextResponse } from "next/server";
import { CashfreePaymentService } from "@/lib/services/cashfree-payment.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/cashfree/webhook
 * Official Authoritative Cashfree Webhook Ingestion Endpoint (v2023-08-01)
 * 
 * Verifies HMAC-SHA256 Base64 signature from raw request text + timestamp,
 * deduplicates via payment_webhook_event table, and triggers atomic order confirmation.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature") || "";
    const timestamp = req.headers.get("x-webhook-timestamp") || "";

    if (!signature || !timestamp) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_CASHFREE_WEBHOOK_HEADERS",
          message: "Headers 'x-webhook-signature' and 'x-webhook-timestamp' are mandatory",
        },
        { status: 400 }
      );
    }

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch (parseErr) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_JSON_PAYLOAD",
          message: "Could not parse JSON body",
        },
        { status: 400 }
      );
    }

    const result = await CashfreePaymentService.processCashfreeWebhookEvent({
      rawBody,
      signature,
      timestamp,
      parsedPayload,
    });

    return NextResponse.json(
      {
        success: result.success,
        event_id: result.event_id,
        order_id: result.orderId,
        payment_id: result.payment_id,
        status: result.status,
        message: result.message,
        idempotent: result.idempotent || false,
        downstream: result.downstream,
      },
      { status: result.statusCode || (result.success ? 200 : 400) }
    );
  } catch (err: any) {
    console.error("[Cashfree Webhook API] Unhandled exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_WEBHOOK_ERROR",
        message: err.message || "An unexpected error occurred processing the Cashfree webhook",
      },
      { status: 500 }
    );
  }
}

