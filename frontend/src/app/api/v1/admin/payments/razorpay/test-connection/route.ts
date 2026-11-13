import { NextRequest, NextResponse } from "next/server";
import { PaymentGatewayConfigService } from "@/lib/services/payment-gateway-config.service";
import { resolveServerSession } from "@/lib/security/auth-session";

export const dynamic = "force-dynamic";

function requireAdmin(req: NextRequest): { error: NextResponse } | { userId: string } {
  const session = resolveServerSession(req);
  if (!session || !session.userId) {
    return { error: NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Admin authentication required." }, { status: 401 }) };
  }
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
    return { error: NextResponse.json({ success: false, error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 }) };
  }
  return { userId: session.userId };
}

/**
 * POST /api/v1/admin/payments/razorpay/test-connection
 * Hardened Diagnostic Connection Probe (SSRF Prevention, 5s timeout, manual redirect)
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if ("error" in auth) return auth.error;

  let environment: "TEST" | "LIVE" | undefined;
  try {
    const body = await req.json();
    const raw = String(body?.environment || "").toUpperCase();
    if (raw === "TEST" || raw === "LIVE") environment = raw;
  } catch {
    // empty body: probe the active environment
  }

  try {
    // Only STORED credentials are probed; secrets are never accepted from or returned to the browser.
    const result = await PaymentGatewayConfigService.testConnection({ key_id: "", environment });
    await PaymentGatewayConfigService.recordAudit({
      actor: auth.userId, action: "PROBE", status: result.success ? "SUCCESS" : "FAILURE", environment: result.environment, code: result.category
    });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, status_code: 500, environment: environment || "TEST", category: "NETWORK_FAILURE", message: "The diagnostic probe could not be executed.", tested_at: new Date().toISOString() },
      { status: 500 }
    );
  }
}
