import { NextRequest, NextResponse } from "next/server";
import { PhoneAuthError, reissueSessionToken, updateOwnProfile } from "@frontend/lib/auth/phone-auth";
import { resolveServerSession } from "@frontend/lib/security/auth-session";

export const dynamic = "force-dynamic";

/** PATCH { name, email? } — the signed-in user's own descriptive profile fields only. */
export async function PATCH(req: NextRequest) {
  const session = resolveServerSession(req);
  if (!session?.userId) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  try {
    const phoneDigits = (session.phone || "").slice(-10);
    await updateOwnProfile(session.userId, phoneDigits, { name: body?.name, email: body?.email });
    const res = NextResponse.json({ success: true });
    await reissueSessionToken(res, session.userId, phoneDigits).catch(() => null);
    return res;
  } catch (e) {
    const pe = e instanceof PhoneAuthError ? e : new PhoneAuthError("update_failed", "Could not save profile.", 500);
    return NextResponse.json({ success: false, code: pe.code, error: pe.message }, { status: pe.status });
  }
}
