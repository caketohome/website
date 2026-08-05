import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  try {
    const response = NextResponse.next();

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

