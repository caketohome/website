import { NextRequest, NextResponse } from "next/server";
import { requireRider } from "@frontend/lib/security/rider-session";
import { dbQuery } from "@frontend/lib/db";
import { CodCollectionService } from "@frontend/lib/services/cod-collection.service";

export const dynamic = "force-dynamic";

/** POST { order_id, amount } — the assigned rider confirms the cash collected at the door. */
export async function POST(req: NextRequest) {
  const r = requireRider(req);
  if (r instanceof NextResponse) return r;
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.order_id || "");
  if (!orderId) return NextResponse.json({ success: false, error: "order_id is required." }, { status: 400 });

  const o = await dbQuery(
    `SELECT id, branch_id, metadata FROM public."order"
      WHERE (id = $1 OR metadata->>'order_number' = $1) AND deleted_at IS NULL LIMIT 1`,
    [orderId]
  );
  const order = o.rows[0];
  if (!order) return NextResponse.json({ success: false, error: "ORDER_NOT_FOUND" }, { status: 404 });
  const assigned = order.metadata?.delivery_partner_id || order.metadata?.delivery?.partner_id;
  if (assigned !== r.riderId) {
    return NextResponse.json({ success: false, error: "FORBIDDEN: This order is not assigned to you." }, { status: 403 });
  }

  try {
    const snapshot = await CodCollectionService.confirmCodCollection({
      orderId: order.id,
      deliveryPartnerId: r.riderId,
      amount: typeof body.amount === "number" ? body.amount : undefined,
      branchId: order.branch_id || order.metadata?.branch_id,
      actorContext: { id: r.riderId, userId: r.riderId, user_id: r.riderId, role: "DELIVERY_PARTNER" },
    } as any);
    return NextResponse.json({ success: true, snapshot });
  } catch (err: any) {
    const status = err.code === "DUPLICATE_COLLECTION_EVENT" ? 409 : 400;
    return NextResponse.json({ success: false, error: err.code || "COLLECTION_FAILED", message: err.message }, { status });
  }
}
