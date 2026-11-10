import { NextRequest, NextResponse } from "next/server";
import { RazorpayPaymentService } from "@/lib/services/razorpay-payment.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/razorpay/order
 * Initiates Razorpay Order for Checkout
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = body.order_id || body.orderId;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_PARAMETERS",
          message: "Valid order_id is required",
        },
        { status: 400 }
      );
    }

    const orderResult = await RazorpayPaymentService.createOrder(orderId);
    return NextResponse.json(orderResult, { status: 200 });
  } catch (err: any) {
    console.error("[RazorpayOrderAPI] Error:", err.message);
    const statusCode = err.message?.includes("ORDER_NOT_FOUND") ? 404 : 500;
    return NextResponse.json(
      {
        success: false,
        error: "RAZORPAY_ORDER_CREATION_FAILED",
        message: err.message || "Failed to create Razorpay payment order",
      },
      { status: statusCode }
    );
  }
}

