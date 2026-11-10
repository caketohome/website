import { NextRequest, NextResponse } from "next/server";
import { RazorpayPaymentService } from "@/lib/services/razorpay-payment.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/razorpay/webhook
 * Ingests Raw Razorpay Webhook with 90-Day Retention & Idempotency Safeguards
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-razorpay-signature") || "";
    const rawBody = await req.text();

    if (!signature || !rawBody) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_WEBHOOK_PAYLOAD_OR_SIGNATURE",
          message: "x-razorpay-signature header and non-empty body are required.",
        },
        { status: 400 }
      );
    }

    const result = await RazorpayPaymentService.processWebhook({
      rawBody,
      signature
    });

    return NextResponse.json(result, { status: result.statusCode || 200 });
  } catch (err: any) {
    console.error("[RazorpayWebhookAPI] Error:", err.message);
    return NextResponse.json(
      {
        success: false,
        error: "WEBHOOK_PROCESSING_FAILED",
        message: err.message || "Failed to process Razorpay webhook",
      },
      { status: 500 }
    );
  }
}
