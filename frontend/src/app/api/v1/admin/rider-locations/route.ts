import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { listRiderLocations } from "@frontend/lib/services/rider-location.service";

export const dynamic = "force-dynamic";

/** GET — riders on duty with their latest position. Branch managers see only their branch. */
export async function GET(req: NextRequest) {
  const session = resolveServerSession(req);
  if (!session) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  const role = String(session.role || "").toUpperCase();
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "OPERATIONS_MANAGER";
  const isManager = role === "BRANCH_MANAGER" || role === "SHOP_MANAGER";
  if (!isAdmin && !isManager) return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
  if (isManager && !session.branchId) return NextResponse.json({ success: false, error: "FORBIDDEN: No branch assigned." }, { status: 403 });
  const riders = await listRiderLocations({ branchId: isManager ? session.branchId : null });
  return NextResponse.json({ success: true, riders });
}
