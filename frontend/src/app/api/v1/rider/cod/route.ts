import { NextRequest, NextResponse } from "next/server";
import { requireRider } from "@frontend/lib/security/rider-session";
import { dbQuery } from "@frontend/lib/db";
import { DeliveryHandoverService } from "@frontend/lib/services/delivery-handover.service";

export const dynamic = "force-dynamic";

/** GET — the rider's cash: collected and not yet settled, what can be handed over, recent handovers. */
export async function GET(req: NextRequest) {
  const r = requireRider(req);
  if (r instanceof NextResponse) return r;
  try {
    const held = await dbQuery(
      `SELECT id, display_id, metadata->>'order_number' AS order_number, metadata->>'branch_id' AS branch_id,
              (metadata->'cod_custody_event'->>'collected_amount')::numeric AS amount,
              metadata->'cod_custody_event'->>'collected_at' AS collected_at
         FROM public."order"
        WHERE deleted_at IS NULL
          AND metadata->'cod_custody_event'->>'delivery_partner_id' = $1
          AND (metadata->'cod_custody_event'->>'settlement_voucher_id') IS NULL
        ORDER BY metadata->'cod_custody_event'->>'collected_at' ASC`,
      [r.riderId]
    );
    const branchIds = Array.from(new Set(held.rows.map((o: any) => o.branch_id).filter(Boolean))) as string[];
    const handoverable: Record<string, { amount: number; orders: number }> = {};
    for (const b of branchIds) {
      const e = await DeliveryHandoverService.getEligibleCollections(r.riderId, b);
      if (e.orders.length) handoverable[b] = { amount: e.expectedCash, orders: e.orders.length };
    }
    const { handovers } = await DeliveryHandoverService.listHandovers({ deliveryPartnerId: r.riderId, limit: 10, offset: 0 });
    const total = held.rows.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
    return NextResponse.json(
      {
        success: true,
        cash_in_hand: Math.round(total * 100) / 100,
        orders: held.rows.map((o: any) => ({
          order_id: o.id,
          order_number: o.order_number || (o.display_id ? String(o.display_id) : o.id),
          branch_id: o.branch_id,
          amount: Number(o.amount || 0),
          collected_at: o.collected_at,
        })),
        handoverable,
        handovers,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Could not load cash" }, { status: 500 });
  }
}
