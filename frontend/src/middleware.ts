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
        rawRole === "INTERNAL_ADMIN" ||
        rawRole === "FINANCE_CONTROLLER" ||
        rawRole === "FINANCE" ||
        rawRole === "PLANNER" ||
        rawRole === "DELIVERY_MANAGER" ||
        rawRole === "BRANCH_STAFF" ||
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
          if (request.nextUrl.searchParams.get("tab") === "teller_custody") {
            return NextResponse.next();
          }
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
      if (
        rawRole !== "DELIVERY_PARTNER" &&
        rawRole !== "DLP" &&
        rawRole !== "SUPER_ADMIN" &&
        rawRole !== "ADMIN" &&
        rawRole !== "INTERNAL_ADMIN" &&
        rawRole !== "DELIVERY_MANAGER"
      ) {
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
      if (
        rawRole !== "BRANCH_MANAGER" &&
        rawRole !== "SHOP_MANAGER" &&
        rawRole !== "SHOP" &&
        rawRole !== "SHPMGR" &&
        rawRole !== "SUPER_ADMIN" &&
        rawRole !== "ADMIN" &&
        rawRole !== "INTERNAL_ADMIN"
      ) {
        if (rawRole === "DELIVERY_PARTNER" || rawRole === "DLP") {
          return NextResponse.redirect(new URL("/dashboard/delivery-partner", request.url));
        }
        return NextResponse.redirect(new URL("/account", request.url));
      }
    }

    // 4. /account protection
    if ((pathname === "/account" || pathname.startsWith("/account/"))) {
      if (!hasAuthSession) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (rawRole === "DELIVERY_PARTNER" || rawRole === "DLP") {
        return NextResponse.redirect(new URL("/dashboard/delivery-partner", request.url));
      }
      if (rawRole === "BRANCH_MANAGER" || rawRole === "SHOP_MANAGER" || rawRole === "SHOP" || rawRole === "SHPMGR") {
        return NextResponse.redirect(new URL("/dashboard/shop", request.url));
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
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
  ],
};

