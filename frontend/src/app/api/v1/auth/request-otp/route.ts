import { NextRequest, NextResponse } from "next/server";
import { PhoneAuthError, requestContext, requestPhoneOtp } from "@frontend/lib/auth/phone-auth";
import { normalizeAnyE164, normalizePhone } from "@frontend/lib/auth/phone";
import { takeToken } from "@frontend/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const TEN_MIN = 10 * 60 * 1000;

function err(e: PhoneAuthError) {
  const res = NextResponse.json({ success: false, code: e.code, error: e.message }, { status: e.status });
  if (e.retryAfter) res.headers.set("Retry-After", String(e.retryAfter));
  return res;
}

/**
 * Normalize the incoming phone to E.164.
 *
 * Accepts:
 *   - Full E.164 string already formatted by the client (e.g. "+919876543210")
 *   - Legacy bare 10-digit Indian number (e.g. "9876543210") — backward compat
 */
function resolvePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Already E.164 from new international client
  if (trimmed.startsWith("+")) return normalizeAnyE164(trimmed);

  // Legacy bare Indian 10-digit — backward compat for existing customers
  const digits = trimmed.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return normalizePhone(digits, "91", "IN");

  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = resolvePhone(body?.phone ?? body?.mobile);
  if (!phone) return err(new PhoneAuthError("invalid_phone", "Enter a valid phone number."));

  const ip = requestContext(req).ip || "unknown";
  // Per visitor, per number, and a site-wide ceiling so SMS costs can never run away.
  for (const [key, limit] of [[`otp-req:ip:${ip}`, 10], [`otp-req:ph:${phone}`, 4], ["otp-req:all", 300]] as const) {
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
