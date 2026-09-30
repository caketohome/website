import { NextRequest, NextResponse } from "next/server";
import { resolveVerifiedCustomer } from "@frontend/lib/security/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const verified = resolveVerifiedCustomer(req);

    if (!verified) {
      return NextResponse.json(
        { success: true, customer: null, message: "No active authenticated session." },
        { status: 200 }
      );
    }

    const { ApiEngine } = await import("@frontend/lib/api-engine");
    const customer = ApiEngine.getCustomerMe({ customerUid: verified.customerUid, userId: verified.userId, phone: verified.phone });
    if (!customer) {
      return NextResponse.json(
        { success: true, customer: null, message: "Customer profile not found." },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      customer,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err.message || "Failed to retrieve customer identity." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const verified = resolveVerifiedCustomer(req);

    if (!verified) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    // Sanitize body: prevent tampering with verified identity
    delete body.id;
    delete body.customer_uid;
    delete body.phone;
    delete body.normalized_phone;
    delete body.role;

    const { ApiEngine } = await import("@frontend/lib/api-engine");
    const result: any = ApiEngine.updateCustomerProfile(verified.customerUid, body);
    if (!result || !result.success) {
      return NextResponse.json(
        { success: false, error: "UPDATE_FAILED", message: result?.error || "Failed to update profile." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: result.customer,
      message: "Customer profile updated successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err.message || "Failed to update customer profile." },
      { status: 500 }
    );
  }
}
