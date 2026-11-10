import { NextRequest, NextResponse } from "next/server";
import { PaymentGatewayConfigService } from "@/lib/services/payment-gateway-config.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/payments/razorpay/test-connection
 * Hardened Diagnostic Connection Probe (SSRF Prevention, 5s timeout, manual redirect)
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body may be empty if testing saved credentials
    }

    const result = await PaymentGatewayConfigService.testConnection({
      key_id: body.key_id,
      key_secret: body.key_secret,
      environment: body.environment
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[RazorpayTestConnectionAPI] Error:", err.message);
    return NextResponse.json(
      {
        success: false,
        status_code: 500,
        environment: "TEST",
        category: "NETWORK_FAILURE",
        message: err.message || "Failed to execute diagnostic connection probe",
        tested_at: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

