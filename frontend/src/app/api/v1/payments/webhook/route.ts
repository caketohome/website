import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/webhook
 * [DECOMMISSIONED] Legacy Razorpay Webhook Endpoint
 * 
 * In accordance with CakeToHome Phase 5 Architecture Decisions:
 * Razorpay is decommissioned for all new payment operations.
 * Cashfree is the exclusive gateway for all new transactions (/api/v1/payments/cashfree/webhook).
 * Historical Razorpay transactions, accounting entries, and audit ledgers remain preserved.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "RAZORPAY_GATEWAY_DECOMMISSIONED",
      message: "The Razorpay payment processing endpoint is decommissioned. All new payments must use the Cashfree integration endpoint at /api/v1/payments/cashfree/webhook.",
      provider: "razorpay",
      status: "decommissioned",
      timestamp: new Date().toISOString(),
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      status: "decommissioned",
      provider: "razorpay",
      message: "Razorpay payment processing is decommissioned in CakeToHome Phase 5. Use Cashfree.",
    },
    { status: 410 }
  );
}
