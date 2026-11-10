import { NextRequest, NextResponse } from "next/server";
import { RazorpayPaymentService } from "@/lib/services/razorpay-payment.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/payments/razorpay/status/[order_id]
 * Live Order Payment Status Poller
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { order_id: string } }
) {
  try {
    const orderId = params.order_id;
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "MISSING_ORDER_ID" },
        { status: 400 }
      );
    }

    const status = await RazorpayPaymentService.getOrderStatus(orderId);
    if (!status) {
      return NextResponse.json(
        { success: false, error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...status }, { status: 200 });
  } catch (err: any) {
    console.error("[RazorpayStatusAPI] Error:", err.message);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
