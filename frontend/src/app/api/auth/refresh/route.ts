import { NextRequest, NextResponse } from "next/server";
import {
  PhoneAuthError, REFRESH_COOKIE, clearSessionCookies, refreshAppSession, requestContext, setSessionCookies,
} from "@frontend/lib/auth/phone-auth";

export const dynamic = "force-dynamic";

/** Only same-site relative paths, so this can't be used as an open redirect. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/api/") ? raw : "/";
}

/**
 * GET  /api/auth/refresh?next=/dashboard  — middleware sends expired app sessions here.
 * POST /api/auth/refresh                  — client-side silent refresh (JSON).
 */
async function refresh(req: NextRequest) {
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!rt) throw new PhoneAuthError("session_expired", "Session expired.", 401);
  return refreshAppSession(rt, requestContext(req));
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  try {
    const session = await refresh(req);
    const res = NextResponse.redirect(new URL(next, req.url));
    setSessionCookies(res, session);
    return res;
  } catch {
    const login = new URL("/login", req.url);
    login.searchParams.set("reason", "session_expired");
    login.searchParams.set("next", next);
    const res = NextResponse.redirect(login);
    clearSessionCookies(res);
    return res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await refresh(req);
    const res = NextResponse.json({ success: true, role: session.role });
    setSessionCookies(res, session);
    return res;
  } catch (e) {
    const res = NextResponse.json(
      { success: false, code: e instanceof PhoneAuthError ? e.code : "session_expired" },
      { status: 401 }
    );
    clearSessionCookies(res);
    return res;
  }
}
