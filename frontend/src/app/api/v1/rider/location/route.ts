import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { saveRiderLocation, setRiderOffDuty } from "@frontend/lib/services/rider-location.service";

export const dynamic = "force-dynamic";

/** The logged-in rider only — a location can never be posted for someone else. */
function riderIdFrom(req: NextRequest): string | NextResponse {
  const session = resolveServerSession(req);
  if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  const role = String(session.role || "").toUpperCase();
  const id = (session as any).partnerId || "";
  if ((role !== "DELIVERY_PARTNER" && role !== "DLP") || !id) {
    return NextResponse.json({ success: false, error: "FORBIDDEN: Only a delivery partner can share location." }, { status: 403 });
  }
  return id;
}

/** POST { latitude, longitude, accuracy?, heading?, speed? } — rider shares their position while on duty. */
export async function POST(req: NextRequest) {
  const rider = riderIdFrom(req);
  if (rider instanceof NextResponse) return rider;
  try {
    const b = await req.json().catch(() => ({}));
    await saveRiderLocation(rider, {
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      accuracy: b.accuracy == null ? null : Number(b.accuracy),
      heading: b.heading == null ? null : Number(b.heading),
      speed: b.speed == null ? null : Number(b.speed),
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Could not save location" }, { status: 400 });
  }
}

/** DELETE — rider goes off duty; their position stops being shown. */
export async function DELETE(req: NextRequest) {
  const rider = riderIdFrom(req);
  if (rider instanceof NextResponse) return rider;
  await setRiderOffDuty(rider);
  return NextResponse.json({ success: true });
}
