import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { getRiderLocationForOrder } from "@frontend/lib/services/rider-location.service";

export const dynamic = "force-dynamic";

/** GET — the rider's live position for the signed-in customer's own order, while it is out for delivery. */
export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const session = resolveServerSession(req);
  if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  const ids = [session.customerUid, session.customerId, session.userId].filter(Boolean) as string[];
  const r = await getRiderLocationForOrder(decodeURIComponent(params.orderId), { customerIds: ids, phone: session.phone });
  if (r.status !== 200) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, ...r.data }, { headers: { "Cache-Control": "no-store" } });
}
