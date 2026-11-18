import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { takeToken } from "@frontend/lib/auth/rate-limit";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { TRACKABLE_EVENTS, recordStorefrontEvent, type TrackableEvent } from "@frontend/lib/services/storefront-events.service";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "_cth_vid";

/** POST /api/v1/store/track — storefront behaviour beacon (page/cake views, add-to-cart, search). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const eventType = String(body?.event_type || "") as TrackableEvent;
  if (!TRACKABLE_EVENTS.includes(eventType)) {
    return NextResponse.json({ success: false, error: "unknown event" }, { status: 400 });
  }

  let visitorId = req.cookies.get(VISITOR_COOKIE)?.value || "";
  const isNewVisitor = !/^v_[0-9a-f-]{36}$/.test(visitorId);
  if (isNewVisitor) visitorId = `v_${randomUUID()}`;

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (!takeToken(`track:${visitorId}:${ip}`, 120, 10 * 60 * 1000).ok) {
    return new NextResponse(null, { status: 204 });
  }

  const session = resolveServerSession(req);
  const isCustomer = session?.role === "CUSTOMER";
  const digits = isCustomer ? String(session?.phone || "").replace(/\D/g, "").slice(-10) : "";
  const p = body?.payload && typeof body.payload === "object" ? body.payload : {};

  try {
    await recordStorefrontEvent({
      visitorId,
      customerId: isCustomer ? session!.userId : null,
      phone: digits.length === 10 ? `+91${digits}` : null,
      eventType,
      productId: typeof p.product_id === "string" ? p.product_id : null,
      path: typeof body?.path === "string" ? body.path : null,
      metadata: eventType === "search" && typeof p.query === "string" ? { query: p.query.slice(0, 120) } : {},
    });
  } catch (e: any) {
    console.error("[store/track]", e.message);
  }

  const res = new NextResponse(null, { status: 204 });
  if (isNewVisitor) {
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
