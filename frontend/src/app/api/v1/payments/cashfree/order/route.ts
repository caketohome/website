import { NextRequest, NextResponse } from "next/server";
import { CashfreePaymentService } from "@/lib/services/cashfree-payment.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/cashfree/order
 * Cashfree PG API v2023-08-01 - Create Order Session
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = body.order_id || body.orderId;
    const amount = Number(body.amount || body.order_amount || 0);

    if (!orderId || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_PARAMETERS",
          message: "Valid order_id and positive amount are required",
        },
        { status: 400 }
      );
    }

    const session = await CashfreePaymentService.createCashfreeOrder({
      orderId,
      amount,
      currency: body.currency || body.order_currency || "INR",
      customer: {
        id: body.customer_id || body.customerId || `cus_${Date.now()}`,
        phone: body.customer_phone || body.customerPhone || "9876543210",
        name: body.customer_name || body.customerName || "Customer",
        email: body.customer_email || body.customerEmail || "customer@caketohome.com",
      },
      returnUrl: body.return_url || body.returnUrl || `http://localhost:3000/your-order?order_id=${encodeURIComponent(orderId)}`,
      notifyUrl: body.notify_url || body.notifyUrl || `http://localhost:3000/api/v1/payments/cashfree/webhook`,
    });

    return NextResponse.json(session, { status: 200 });
  } catch (err: any) {
    console.error("[CashfreeOrderAPI] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "CASHFREE_ORDER_CREATION_FAILED",
        message: err.message || "Failed to create Cashfree payment order",
      },
      { status: 500 }
    );
  }
}

