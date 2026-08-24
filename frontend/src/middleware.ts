import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // Role-based route protection
    const token = request.cookies.get("_cth_jwt")?.value || request.cookies.get("_medusa_jwt")?.value;
    const rawRole = (request.cookies.get("_cth_role")?.value || "").toUpperCase();
    const hasAuthSession = Boolean(token || request.cookies.get("_cth_user_id")?.value || request.cookies.get("_cth_phone")?.value);

    // 1. /dashboard (staff & admin) protection
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      const isStaffOrAdmin =
        rawRole === "SUPER_ADMIN" ||
        rawRole === "ADMIN" ||
        rawRole === "STAFF" ||
        rawRole === "TELECALLER" ||
        rawRole === "DIGITAL_MARKETING" ||
        rawRole === "SEO_MANAGER" ||
        rawRole === "CONTENT_MANAGER" ||
        rawRole === "CUSTOMER_SUPPORT";

      if (!isStaffOrAdmin) {
        if (rawRole === "DELIVERY_PARTNER" || rawRole === "DLP") {
          return NextResponse.redirect(new URL("/dashboard/delivery-partner", request.url));
        }
        if (rawRole === "BRANCH_MANAGER" || rawRole === "SHOP_MANAGER" || rawRole === "SHOP" || rawRole === "SHPMGR") {
          return NextResponse.redirect(new URL("/dashboard/shop", request.url));
        }
        return NextResponse.redirect(new URL("/account", request.url));
      }
    }

    // 2. /dashboard/delivery-partner protection
    if (pathname.startsWith("/dashboard/delivery-partner")) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (rawRole !== "DELIVERY_PARTNER" && rawRole !== "DLP" && rawRole !== "SUPER_ADMIN" && rawRole !== "ADMIN") {
        if (rawRole === "BRANCH_MANAGER" || rawRole === "SHOP_MANAGER" || rawRole === "SHOP") {
          return NextResponse.redirect(new URL("/dashboard/shop", request.url));
        }
        return NextResponse.redirect(new URL("/account", request.url));
      }
    }

    // 3. /dashboard/shop protection
    if (pathname.startsWith("/dashboard/shop")) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (rawRole !== "BRANCH_MANAGER" && rawRole !== "SHOP_MANAGER" && rawRole !== "SHOP" && rawRole !== "SHPMGR" && rawRole !== "SUPER_ADMIN" && rawRole !== "ADMIN") {
        if (rawRole === "DELIVERY_PARTNER" || rawRole === "DLP") {
          return NextResponse.redirect(new URL("/dashboard/delivery-partner", request.url));
        }
        return NextResponse.redirect(new URL("/account", request.url));
      }
    }

    // 4. /account protection
    if (pathname.startsWith("/account")) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (rawRole === "DELIVERY_PARTNER" || rawRole === "DLP") {
        return NextResponse.redirect(new URL("/dashboard/delivery-partner", request.url));
      }
      if (rawRole === "BRANCH_MANAGER" || rawRole === "SHOP_MANAGER" || rawRole === "SHOP" || rawRole === "SHPMGR") {
        return NextResponse.redirect(new URL("/dashboard/shop", request.url));
      }
    }

    const response = NextResponse.next();

    // Cache ID tracking
    const cacheId = request.cookies.get("_medusa_cache_id")?.value;
    if (!cacheId) {
      const newCacheId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      response.cookies.set("_medusa_cache_id", newCacheId, {
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      response.headers.set("x-medusa-cache-id", newCacheId);
    } else {
      response.headers.set("x-medusa-cache-id", cacheId);
    }

    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

