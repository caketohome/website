import { NextRequest, NextResponse } from "next/server";
import { RazorpayPaymentService } from "@/lib/services/razorpay-payment.service";
import { MetaCapiService } from "@/lib/services/meta-capi.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/razorpay/verify
 * Authoritative Server-Side HMAC-SHA256 Verification & Full-Capture Confirmation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const razorpay_order_id = body.razorpay_order_id || body.razorpayOrderId;
    const razorpay_payment_id = body.razorpay_payment_id || body.razorpayPaymentId;
    const razorpay_signature = body.razorpay_signature || body.razorpaySignature;
    const order_id = body.order_id || body.orderId;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_REQUIRED_PARAMETERS",
          message: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
        },
        { status: 400 }
      );
    }

    const result = await RazorpayPaymentService.verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id
    });

    if (result.success && result.status === "paid" && result.order_id) {
      // Non-blocking Meta Conversions API (CAPI) server-side event dispatch
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
      const userAgent = req.headers.get("user-agent") || undefined;

      MetaCapiService.sendPurchase({
        order_id: result.order_id,
        amount: Number(body.amount || 0),
        email: body.email || body.customer_email,
        phone: body.phone || body.customer_phone,
        clientIp,
        userAgent,
      }).catch((capiErr) => {
        console.warn("[RazorpayVerifyAPI] Meta CAPI non-blocking notice:", capiErr.message);
      });
    }

    const statusCode = result.success ? 200 : (result.status === "payment_exception" ? 422 : 400);
    return NextResponse.json(result, { status: statusCode });
  } catch (err: any) {
    console.error("[RazorpayVerifyAPI] Error:", err.message);
    return NextResponse.json(
      {
        success: false,
        error: "PAYMENT_VERIFICATION_FAILED",
        message: err.message || "Failed to verify Razorpay payment",
      },
      { status: 500 }
    );
  }
}

