import { NextRequest, NextResponse } from "next/server";

interface VerifiedEdgeJwt {
  userId?: string;
  role?: string;
  exp?: number;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyJwtEdge(token: string | undefined): Promise<VerifiedEdgeJwt | null> {
  if (!token) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null; // fail closed: no hardcoded fallback secret

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = base64UrlToUint8Array(sigB64);
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    // Pass the Uint8Array, not .buffer: on Node 22 WebCrypto rejects an ArrayBuffer from the
    // edge sandbox's realm, which made every session look invalid (login redirect loop).
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    const payload = JSON.parse(payloadJson) as VerifiedEdgeJwt;
    if (payload.exp && typeof payload.exp === "number" && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    if (!payload.userId && !(payload as any).actor_id && !(payload as any).sub) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    // Behind Render's proxy request.url is the internal https://localhost:10000; redirect to the public site.
    const base = process.env.NEXT_PUBLIC_SITE_URL || request.url;

    const verifiedSession = await verifyJwtEdge(request.cookies.get("_cth_jwt")?.value);
    const hasAuthSession = Boolean(verifiedSession);
    const rawRole = (verifiedSession?.role || "").toUpperCase();

    // Privileged APIs: verified staff session required (handlers may narrow further).
    if (pathname.startsWith("/api/")) {
      const deny = (status: number, error: string) =>
        NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });
      if (pathname.startsWith("/api/v1/test/")) {
        if (process.env.NODE_ENV === "production") return deny(404, "NOT_FOUND");
        if (rawRole !== "SUPER_ADMIN") return deny(hasAuthSession ? 403 : 401, hasAuthSession ? "FORBIDDEN" : "UNAUTHORIZED");
        return NextResponse.next();
      }
      if (!hasAuthSession) return deny(401, "UNAUTHORIZED");
      if (!rawRole || rawRole === "CUSTOMER") return deny(403, "FORBIDDEN");
      return NextResponse.next();
    }

    // App session expired but Supabase refresh token present -> silent refresh, then come back.
    if (!hasAuthSession && request.cookies.get("_cth_sb_rt")?.value) {
      const refreshUrl = new URL("/api/auth/refresh", base);
      refreshUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(refreshUrl);
    }

    const STAFF_ADMIN_ROLES = new Set([
      "SUPER_ADMIN",
      "ADMIN",
      "INTERNAL_ADMIN",
      "FINANCE_CONTROLLER",
      "FINANCE",
      "PLANNER",
      "DELIVERY_MANAGER",
      "BRANCH_STAFF",
      "STAFF",
      "TELECALLER",
      "DIGITAL_MARKETING",
      "SEO_MANAGER",
      "CONTENT_MANAGER",
      "CUSTOMER_SUPPORT",
    ]);

    const MANAGER_ROLES = new Set(["BRANCH_MANAGER", "SHOP_MANAGER", "SHOP", "SHPMGR"]);
    const DELIVERY_ROLES = new Set(["DELIVERY_PARTNER", "DLP"]);

    // 1. /dashboard (staff & admin) and /admin/* protection
    if (
      pathname === "/dashboard" ||
      pathname === "/dashboard/" ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/")
    ) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", base));
      }
      const isStaffOrAdmin = STAFF_ADMIN_ROLES.has(rawRole);

      if (!isStaffOrAdmin) {
        if (DELIVERY_ROLES.has(rawRole)) {
          return NextResponse.redirect(new URL("/dashboard/delivery-partner", base));
        }
        if (MANAGER_ROLES.has(rawRole)) {
          if (
            pathname.startsWith("/admin/orders") ||
            request.nextUrl.searchParams.get("tab") === "teller_custody"
          ) {
            return NextResponse.next();
          }
          return NextResponse.redirect(new URL("/dashboard/shop", base));
        }
        return NextResponse.redirect(new URL("/account", base));
      }
    }

    // 2. /dashboard/delivery-partner protection
    if (pathname.startsWith("/dashboard/delivery-partner")) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", base));
      }
      if (
        !DELIVERY_ROLES.has(rawRole) &&
        rawRole !== "SUPER_ADMIN" &&
        rawRole !== "ADMIN" &&
        rawRole !== "INTERNAL_ADMIN" &&
        rawRole !== "DELIVERY_MANAGER"
      ) {
        if (MANAGER_ROLES.has(rawRole)) {
          return NextResponse.redirect(new URL("/dashboard/shop", base));
        }
        return NextResponse.redirect(new URL("/account", base));
      }
    }

    // 3. /dashboard/shop protection
    if (pathname.startsWith("/dashboard/shop")) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", base));
      }
      if (
        !MANAGER_ROLES.has(rawRole) &&
        rawRole !== "SUPER_ADMIN" &&
        rawRole !== "ADMIN" &&
        rawRole !== "INTERNAL_ADMIN"
      ) {
        if (DELIVERY_ROLES.has(rawRole)) {
          return NextResponse.redirect(new URL("/dashboard/delivery-partner", base));
        }
        return NextResponse.redirect(new URL("/account", base));
      }
    }

    // 4. /account protection
    if (pathname === "/account" || pathname.startsWith("/account/")) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", base));
      }
      if (DELIVERY_ROLES.has(rawRole)) {
        return NextResponse.redirect(new URL("/dashboard/delivery-partner", base));
      }
      if (MANAGER_ROLES.has(rawRole)) {
        return NextResponse.redirect(new URL("/dashboard/shop", base));
      }
      if (
        rawRole === "SUPER_ADMIN" ||
        rawRole === "ADMIN" ||
        rawRole === "INTERNAL_ADMIN" ||
        rawRole === "FINANCE_CONTROLLER" ||
        rawRole === "FINANCE" ||
        rawRole === "PLANNER" ||
        rawRole === "DELIVERY_MANAGER"
      ) {
        return NextResponse.redirect(new URL("/dashboard", base));
      }
    }

    return NextResponse.next();
  } catch {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || request.url));
  }
}

export const config = {
  matcher: [
    "/api/v1/admin/:path*",
    "/api/admin/:path*",
    "/api/v1/test/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/account/:path*",
  ],
};
