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

// Only these codes are shown to the admin; anything else becomes a generic message so internals/secrets never leak.
const SAFE_ERRORS: Record<string, number> = {
  INVALID_KEY_ID_FORMAT: 400, KEY_ID_REQUIRED: 400, KEY_SECRET_REQUIRED: 400,
  ENVIRONMENT_NOT_CONFIGURED: 409, STALE_CONFIG: 409, INVALID_ENVIRONMENT: 400, INVALID_ACTION: 400
};
function safeError(err: any) {
  const msg = String(err?.message || "");
  const code = msg.split(":")[0];
  if (code in SAFE_ERRORS) return { code, message: msg.slice(code.length + 1).trim() || code, status: SAFE_ERRORS[code] };
  return { code: "CONFIG_FAILED", message: "The payment configuration could not be saved.", status: 500 };
}

/**
 * GET /api/v1/admin/payments/razorpay/config
 * Safe metadata for BOTH environments. Secrets are never returned.
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const config = await PaymentGatewayConfigService.getAdminConfigAll("razorpay");
    return NextResponse.json({ success: true, config }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: "FAILED_TO_LOAD_CONFIG", message: "Payment configuration could not be loaded." }, { status: 500 });
  }
}

/**
 * POST /api/v1/admin/payments/razorpay/config
 *  { action: "save", environment, key_id?, key_secret?, webhook_secret?, expected_updated_at? }
 *  { action: "activate", environment }
 * Empty secrets keep the stored value. The other environment is never modified by "save".
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_BODY", message: "Request body must be JSON." }, { status: 400 });
  }

  const environment = String(body?.environment || "").toUpperCase();
  const action = String(body?.action || "save");
  try {
    if (environment !== "TEST" && environment !== "LIVE") throw new Error("INVALID_ENVIRONMENT: Environment must be TEST or LIVE.");

    if (action === "activate") {
      await PaymentGatewayConfigService.setActiveEnvironment("razorpay", environment, auth.userId);
      await PaymentGatewayConfigService.recordAudit({ actor: auth.userId, action: "ACTIVATE", status: "SUCCESS", environment });
    } else if (action === "save") {
      const fields = ["key_id", "key_secret", "webhook_secret"].filter((f) => typeof body[f] === "string" && body[f].trim());
      await PaymentGatewayConfigService.saveEnvironmentCredentials({
        environment,
        key_id: body.key_id,
        key_secret: body.key_secret,
        webhook_secret: body.webhook_secret,
        expected_updated_at: body.expected_updated_at || null,
        updated_by: auth.userId
      });
      await PaymentGatewayConfigService.recordAudit({ actor: auth.userId, action: "SAVE", status: "SUCCESS", environment, fields });
    } else {
      throw new Error("INVALID_ACTION: Unknown action.");
    }

    const config = await PaymentGatewayConfigService.getAdminConfigAll("razorpay");
    return NextResponse.json({ success: true, config }, { status: 200 });
  } catch (err: any) {
    const e = safeError(err);
    await PaymentGatewayConfigService.recordAudit({ actor: auth.userId, action: action === "activate" ? "ACTIVATE" : "SAVE", status: "FAILURE", environment, code: e.code });
    return NextResponse.json({ success: false, error: e.code, message: e.message }, { status: e.status });
  }
}
