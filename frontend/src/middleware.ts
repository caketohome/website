import { NextRequest, NextResponse } from "next/server";

async function setCacheId(request: NextRequest, response: NextResponse) {
  const cacheId = request.cookies.get("_medusa_cache_id")?.value;

  if (cacheId) {
    return cacheId;
  }

  const newCacheId = crypto.randomUUID();
  response.cookies.set("_medusa_cache_id", newCacheId, {
    maxAge: 60 * 60 * 24,
  });

  return newCacheId;
}

/**
 * Resolve a CMS redirect for the given path by calling the backend.
 * Returns the redirect target + type, or null if no redirect exists.
 */
async function resolveCmsRedirect(
  fromPath: string
): Promise<{ to_url: string; redirect_type: number } | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000";
  try {
    const publishableKey =
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    const res = await fetch(
      `${backendUrl}/store/cms/redirect?from=${encodeURIComponent(fromPath)}`,
      {
        headers: {
          "x-publishable-api-key": publishableKey,
        },
        signal: controller.signal,
        next: { revalidate: 60, tags: ["cms_redirect"] },
      }
    ).finally(() => clearTimeout(timeoutId));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.redirect ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const cacheId = await setCacheId(request, response);
  response.headers.set("x-medusa-cache-id", cacheId);

  // ── CMS Redirect Manager ──────────────────────────────────────────────
  // Check for a redirect before serving the page. Only check GET requests
  // to non-API, non-static paths.
  const { pathname } = request.nextUrl;
  const shouldCheckRedirect =
    request.method === "GET" &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/favicon.ico";

  if (shouldCheckRedirect) {
    const redirect = await resolveCmsRedirect(pathname);
    if (redirect) {
      const status = redirect.redirect_type === 302 ? 302 : 301;
      // Preserve the destination as-is (could be internal or external).
      const toUrl = redirect.to_url.startsWith("http")
        ? redirect.to_url
        : new URL(redirect.to_url, request.url).toString();
      return NextResponse.redirect(toUrl, status);
    }
  }

  return response;
}

export const config = {
  // Match all paths except for the ones that are static assets
  matcher: "/((?!api|_next/static|_next/image|favicon.ico).*)",
};
