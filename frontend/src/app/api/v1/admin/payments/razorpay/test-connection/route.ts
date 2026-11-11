import { NextRequest, NextResponse } from "next/server";
import { PaymentGatewayConfigService } from "@/lib/services/payment-gateway-config.service";
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
 * POST /api/v1/admin/payments/razorpay/test-connection
 * Hardened Diagnostic Connection Probe (SSRF Prevention, 5s timeout, manual redirect)
 */
export async function POST(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

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

