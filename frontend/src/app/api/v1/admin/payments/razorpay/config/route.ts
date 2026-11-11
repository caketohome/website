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
 * GET /api/v1/admin/payments/razorpay/config
 * Retrieves Sanitized Gateway Config (Secrets Redacted)
 */
export async function GET(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const config = await PaymentGatewayConfigService.getAdminConfig("razorpay");
    return NextResponse.json({ success: true, config }, { status: 200 });
  } catch (err: any) {
    console.error("[RazorpayConfigAPI GET] Error:", err.message);
    return NextResponse.json(
      { success: false, error: "FAILED_TO_LOAD_CONFIG", message: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/payments/razorpay/config
 * Saves Gateway Config with Versioned AES-256-GCM Authenticated Encryption
 */
export async function POST(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { provider, environment, key_id, key_secret, webhook_secret, is_active } = body;

    if (!key_id || !key_id.trim()) {
      return NextResponse.json(
        { success: false, error: "KEY_ID_REQUIRED", message: "Razorpay Key ID is required." },
        { status: 400 }
      );
    }

    // Gate E: Block Live Mode Activation pending formal Merchant KYC & Legal Entity Alignment
    if (environment?.toUpperCase() === "LIVE" && process.env.MERCHANT_KYC_APPROVED !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "LIVE_PAYMENT_ACTIVATION_BLOCKED",
          message: "Live payment activation is strictly blocked pending formal merchant KYC, legal entity alignment (Kerala Proprietorship vs Karnataka Pvt Ltd), settlement bank verification, and CFO signoff. Gateway must remain in TEST mode.",
          release_gate: "GATE_E_BLOCKED"
        },
        { status: 403 }
      );
    }

    const result = await PaymentGatewayConfigService.saveAdminConfig({
      provider: provider || "razorpay",
      environment: (environment?.toUpperCase() === "LIVE" ? "LIVE" : "TEST"),
      key_id: key_id.trim(),
      key_secret: key_secret ? key_secret.trim() : undefined,
      webhook_secret: webhook_secret ? webhook_secret.trim() : undefined,
      is_active: is_active ?? true,
      updated_by: "admin_user"
    });

    return NextResponse.json({ success: true, message: "Configuration saved securely.", id: result.id }, { status: 200 });
  } catch (err: any) {
    console.error("[RazorpayConfigAPI POST] Error:", err.message);
    return NextResponse.json(
      { success: false, error: "FAILED_TO_SAVE_CONFIG", message: err.message },
      { status: 500 }
    );
  }
}

