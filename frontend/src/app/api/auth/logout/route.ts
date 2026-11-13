import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE, clearSessionCookies, revokeSupabaseSession } from "@frontend/lib/auth/phone-auth";

export const dynamic = "force-dynamic";

const EXTRA_CLIENT_COOKIES = [
  "_cth_cart_id", "_medusa_cart_id", "_cth_customer_phone", "_cth_email", "_cth_session_expiry",
  "_cth_device_fp", "caketohome_customer_phone", "caketohome_customer_name", "cth_customer_uid",
];

/** Revokes the Supabase session and clears every auth cookie. */
export async function POST(req: NextRequest) {
  await revokeSupabaseSession(req.cookies.get(REFRESH_COOKIE)?.value);

  const res = NextResponse.json({ success: true, message: "Logged out." });
  clearSessionCookies(res);
  for (const name of EXTRA_CLIENT_COOKIES) res.cookies.set(name, "", { path: "/", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
