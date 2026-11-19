import { NextRequest, NextResponse } from "next/server";
import { requireRider } from "@frontend/lib/security/rider-session";
import { DeliveryHandoverService } from "@frontend/lib/services/delivery-handover.service";

export const dynamic = "force-dynamic";

/**
 * POST { branch_id, declared_amount, discrepancy_reason? } — the rider hands over the cash for all
 * their collected orders of that branch. The branch then counts it and acknowledges the handover.
 */
export async function POST(req: NextRequest) {
  const r = requireRider(req);
  if (r instanceof NextResponse) return r;
  const body = await req.json().catch(() => ({}));
  const branchId = String(body.branch_id || r.branchId || "");
  if (!branchId) return NextResponse.json({ success: false, error: "branch_id is required." }, { status: 400 });

  const declared = Number(body.declared_amount);
  if (!Number.isFinite(declared) || declared < 0) {
    return NextResponse.json({ success: false, error: "Enter the cash amount you are handing over." }, { status: 400 });
  }

  try {
    const eligible = await DeliveryHandoverService.getEligibleCollections(r.riderId, branchId);
    const orderIds = eligible.orders.map((o) => o.orderId).filter(Boolean);
    if (orderIds.length === 0) {
      return NextResponse.json({ success: false, error: "No collected cash to hand over for this branch." }, { status: 400 });
    }
    if (Math.round(declared * 100) !== Math.round(eligible.expectedCash * 100) && !String(body.discrepancy_reason || "").trim()) {
      return NextResponse.json(
        { success: false, error: `Expected ₹${eligible.expectedCash.toFixed(2)}. Add a reason if you are handing over a different amount.` },
        { status: 400 }
      );
    }
    const handover = await DeliveryHandoverService.submitHandover({
      branchId,
      deliveryPartnerId: r.riderId,
      declaredAmount: declared,
      digitalAmount: 0,
      orderIds,
      discrepancyReason: body.discrepancy_reason || undefined,
      submittedBy: r.riderId,
      notes: body.notes || undefined,
    });
    const { notifyBranch } = await import("@frontend/lib/services/push-notification.service");
    notifyBranch(
      { id: (handover as any)?.id || `handover-${r.riderId}`, branch_id: branchId },
      `${eligible.partnerName || "A rider"} handed over ₹${declared.toFixed(2)} cash for ${orderIds.length} order${orderIds.length > 1 ? "s" : ""}. Count and confirm it in Teller.`
    );
    return NextResponse.json({ success: true, handover, expected: eligible.expectedCash });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Handover failed", code: err.code }, { status: 400 });
  }
}
