import { NextRequest, NextResponse } from "next/server";
import { PhoneAuthError, requestContext, setSessionCookies, verifyPhoneOtp } from "@frontend/lib/auth/phone-auth";
import { normalizeIndianMobile } from "@frontend/lib/auth/phone";
import { takeToken } from "@frontend/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Where each server-resolved role lands after login. */
function destinationFor(role: string): string {
  if (role === "DELIVERY_PARTNER") return "/dashboard/delivery-partner";
  if (role === "BRANCH_MANAGER") return "/dashboard/shop";
  if (role === "CUSTOMER") return "/account";
  return "/dashboard";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeIndianMobile(body?.phone ?? body?.mobile);
  const code = body?.code ?? body?.otp ?? body?.token;
  const ctx = requestContext(req);

  if (!phone) {
    return NextResponse.json({ success: false, code: "invalid_phone", error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }
  const t = takeToken(`otp-verify:${phone}`, 8, 10 * 60 * 1000);
  if (!t.ok) {
    return NextResponse.json(
      { success: false, code: "rate_limited", error: "Too many attempts. Request a new code later." },
      { status: 429, headers: { "Retry-After": String(t.retryAfter) } }
    );
  }

  try {
    const session = await verifyPhoneOtp(phone, code, ctx);
    const res = NextResponse.json({
      success: true,
      role: session.role,
      redirect_to: destinationFor(session.role),
      is_new_customer: session.isNewProfile,
      needs_profile: session.needsProfile,
    });
    setSessionCookies(res, session);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    const pe = e instanceof PhoneAuthError ? e : new PhoneAuthError("auth_failed", "Verification failed.", 500);
    if (!(e instanceof PhoneAuthError)) console.error("[verify-otp]", (e as Error)?.message);
    return NextResponse.json({ success: false, code: pe.code, error: pe.message }, { status: pe.status });
  }
}
