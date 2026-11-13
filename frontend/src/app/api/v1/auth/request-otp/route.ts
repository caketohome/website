import { NextRequest, NextResponse } from "next/server";
import { PhoneAuthError, requestContext, requestPhoneOtp } from "@frontend/lib/auth/phone-auth";
import { normalizeIndianMobile } from "@frontend/lib/auth/phone";
import { takeToken } from "@frontend/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const TEN_MIN = 10 * 60 * 1000;

function err(e: PhoneAuthError) {
  const res = NextResponse.json({ success: false, code: e.code, error: e.message }, { status: e.status });
  if (e.retryAfter) res.headers.set("Retry-After", String(e.retryAfter));
  return res;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeIndianMobile(body?.phone ?? body?.mobile);
  if (!phone) return err(new PhoneAuthError("invalid_phone", "Enter a valid 10-digit Indian mobile number."));

  const ip = requestContext(req).ip || "unknown";
  for (const [key, limit] of [[`otp-req:ip:${ip}`, 10], [`otp-req:ph:${phone}`, 4]] as const) {
    const t = takeToken(key, limit, TEN_MIN);
    if (!t.ok) return err(new PhoneAuthError("rate_limited", "Too many OTP requests. Please wait and try again.", 429, t.retryAfter));
  }

  try {
    await requestPhoneOtp(phone);
    return NextResponse.json({ success: true, message: "If this number can receive SMS, a code has been sent.", resend_after: 60 });
  } catch (e) {
    return err(e instanceof PhoneAuthError ? e : new PhoneAuthError("auth_failed", "Could not send OTP.", 500));
  }
}
