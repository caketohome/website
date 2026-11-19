import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "./auth-session";

/** The logged-in delivery partner (rider). Never taken from the request body or URL. */
export function requireRider(req: NextRequest): { riderId: string; branchId: string | null } | NextResponse {
  const session = resolveServerSession(req);
  if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  const role = String(session.role || "").toUpperCase();
  const riderId = (session as any).partnerId || "";
  if ((role !== "DELIVERY_PARTNER" && role !== "DLP") || !riderId) {
    return NextResponse.json({ success: false, error: "FORBIDDEN: Only a delivery partner can do this." }, { status: 403 });
  }
  return { riderId, branchId: session.branchId || null };
}
