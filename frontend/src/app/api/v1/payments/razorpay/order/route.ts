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
    let statusCode = 500;
    let errorCode = "RAZORPAY_ORDER_CREATION_FAILED";

    if (err.message?.includes("ORDER_NOT_FOUND")) {
      statusCode = 404;
      errorCode = "ORDER_NOT_FOUND";
    } else if (err.message?.includes("CANNOT_PAY_CANCELLED_ORDER")) {
      statusCode = 400;
      errorCode = "CANNOT_PAY_CANCELLED_ORDER";
    } else if (err.message?.includes("ORDER_ALREADY_PAID")) {
      statusCode = 400;
      errorCode = "ORDER_ALREADY_PAID";
    } else if (err.message?.includes("MISSING_ORDER_SUBTOTAL")) {
      statusCode = 422;
      errorCode = "MISSING_ORDER_SUBTOTAL";
    } else if (err.message?.includes("INVALID_ORDER_AMOUNT")) {
      statusCode = 422;
      errorCode = "INVALID_ORDER_AMOUNT";
    } else if (err.message?.includes("MISSING_ORDER_ITEMS")) {
      statusCode = 422;
      errorCode = "MISSING_ORDER_ITEMS";
    } else if (err.message?.includes("INVALID_ORDER_LINE_ITEM")) {
      statusCode = 422;
      errorCode = "INVALID_ORDER_LINE_ITEM";
    } else if (err.message?.includes("SUBTOTAL_LINE_MISMATCH")) {
      statusCode = 422;
      errorCode = "SUBTOTAL_LINE_MISMATCH";
    } else if (err.message?.includes("GRAND_TOTAL_MISMATCH")) {
      statusCode = 422;
      errorCode = "GRAND_TOTAL_MISMATCH";
    } else if (err.message?.includes("CURRENCY_MISMATCH")) {
      statusCode = 422;
      errorCode = "CURRENCY_MISMATCH";
    }

    return NextResponse.json(
      {
        success: false,
        error: errorCode,
        message: err.message || "Failed to create Razorpay payment order",
      },
      { status: statusCode }
    );
  }
}

