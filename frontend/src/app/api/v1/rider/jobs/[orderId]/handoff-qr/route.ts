import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireRider } from "@frontend/lib/security/rider-session";
import { createHandoffToken } from "@frontend/lib/services/delivery-handoff.service";

export const dynamic = "force-dynamic";

/** POST — the assigned rider gets a fresh QR (30 min) for the receiver to scan at the door. */
export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const r = requireRider(req);
  if (r instanceof NextResponse) return r;
  try {
    const { token, expires_at } = await createHandoffToken(decodeURIComponent(params.orderId), r.riderId);
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
    const url = `${origin}/receive/${token}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", width: 280 });
    return NextResponse.json({ success: true, url, expires_at, qr_svg: svg }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Could not create QR" }, { status: err.status || 400 });
  }
}
