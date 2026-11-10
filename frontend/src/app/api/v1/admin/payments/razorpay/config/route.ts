import { NextRequest, NextResponse } from "next/server";
import { PaymentGatewayConfigService } from "@/lib/services/payment-gateway-config.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/payments/razorpay/config
 * Retrieves Sanitized Gateway Config (Secrets Redacted)
 */
export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const { provider, environment, key_id, key_secret, webhook_secret, is_active } = body;

    if (!key_id || !key_id.trim()) {
      return NextResponse.json(
        { success: false, error: "KEY_ID_REQUIRED", message: "Razorpay Key ID is required." },
        { status: 400 }
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
