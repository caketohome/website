import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSessionParams(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const authHeader = req.headers.get("authorization") || "";

  const cookiesObj: Record<string, string> = {};
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.trim().split("=");
    if (k) cookiesObj[k] = decodeURIComponent(v.join("="));
  });

  const customerUid = req.cookies.get("_cth_customer_uid")?.value || cookiesObj["_cth_customer_uid"] || req.headers.get("x-customer-uid") || "";
  const userId = req.cookies.get("_cth_user_id")?.value || cookiesObj["_cth_user_id"] || req.headers.get("x-user-id") || "";
  const phone = req.cookies.get("_cth_phone")?.value || cookiesObj["_cth_phone"] || req.headers.get("x-phone") || "";
  const token = req.cookies.get("_cth_jwt")?.value || cookiesObj["_cth_jwt"] || authHeader.replace(/^Bearer\s+/i, "");

  return { customerUid, userId, phone, token };
}

export async function GET(req: NextRequest) {
  try {
    const { customerUid, userId, phone, token } = getSessionParams(req);

    if (!customerUid && !userId && !phone && !token) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const { ApiEngine } = await import("@frontend/lib/api-engine");
    const customer = ApiEngine.getCustomerMe({ customerUid, userId, phone, token });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Customer profile not found." },
        { status: 404 }
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
    const { customerUid, userId, phone, token } = getSessionParams(req);

    if (!customerUid && !userId && !phone && !token) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const targetUid = customerUid || (userId && userId.startsWith("cth_cus_") ? userId : "") || (phone ? `cth_cus_${phone.replace(/\D/g, "").slice(-10)}` : "");
    if (!targetUid) {
      return NextResponse.json(
        { success: false, error: "BAD_REQUEST", message: "Unable to identify customer account." },
        { status: 400 }
      );
    }

    const { ApiEngine } = await import("@frontend/lib/api-engine");
    const result: any = ApiEngine.updateCustomerProfile(targetUid, body);
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
