import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { removeSubscription, saveSubscription } from "@frontend/lib/services/push-notification.service";

export const dynamic = "force-dynamic";

/**
 * POST   /api/push/subscribe  { endpoint, keys: { p256dh, auth } }  — save this device for push
 * DELETE /api/push/subscribe  { endpoint }                          — stop push on this device
 * Who gets what is taken from the verified session only (role, branch, partner, customer),
 * never from the request body.
 */
export async function POST(req: NextRequest) {
  const session = resolveServerSession(req);
  if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ success: false, error: "INVALID_SUBSCRIPTION" }, { status: 400 });
  }

  await saveSubscription(
    { endpoint, keys: { p256dh, auth } },
    {
      userId: session.userId,
      role: session.role,
      branchId: session.branchId,
      partnerId: session.partnerId,
      customerUid: session.customerUid || null,
    },
    req.headers.get("user-agent")
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = resolveServerSession(req);
  if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint === "string") await removeSubscription(body.endpoint, session.userId);
  return NextResponse.json({ success: true });
}
