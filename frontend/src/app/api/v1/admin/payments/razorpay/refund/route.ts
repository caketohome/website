import { NextRequest, NextResponse } from "next/server";
import { RazorpayPaymentService, RazorpayRefundReasonCode } from "@/lib/services/razorpay-payment.service";
import { resolveServerSession } from "@/lib/security/auth-session";

export const dynamic = "force-dynamic";

function requireAdmin(req: NextRequest): NextResponse | null {
  const session = resolveServerSession(req);
  if (!session || !session.userId) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED", message: "Admin authentication required." },
      { status: 401 }
    );
  }
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "FORBIDDEN", message: "Admin privileges required." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * POST /api/v1/admin/payments/razorpay/refund
 * Admin Initiated Controlled Refund with Reason Code & Accounting Reversal
 */
export async function POST(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { order_id, amount, reason_code, reason_explanation, requested_by, approved_by, idempotency_key } = body;

    if (!order_id || !amount || !reason_code || !idempotency_key) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_REQUIRED_PARAMETERS",
          message: "order_id, amount, reason_code, and idempotency_key are required.",
        },
        { status: 400 }
      );
    }

    const result = await RazorpayPaymentService.processRefund({
      order_id,
      amount: Number(amount),
      reason_code: reason_code as RazorpayRefundReasonCode,
      reason_explanation,
      requested_by: requested_by || "admin_user",
      approved_by: approved_by || "admin_super",
      idempotency_key
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[RazorpayRefundAPI] Error:", err.message);
    const statusCode = err.message?.includes("INVALID_REFUND_REASON_CODE") ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: "REFUND_FAILED",
        message: err.message || "Failed to process refund",
      },
      { status: statusCode }
    );
  }
}

