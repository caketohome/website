import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/cashfree/webhook
 * [DECOMMISSIONED in Phase 9]
 * Razorpay Standard Web Checkout is the sole active payment gateway for CakeToHome.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "CASHFREE_DECOMMISSIONED",
      message: "Cashfree payment gateway has been fully decommissioned. Webhooks are routed to /api/v1/payments/razorpay/webhook.",
    },
    { status: 410 }
  );
}
