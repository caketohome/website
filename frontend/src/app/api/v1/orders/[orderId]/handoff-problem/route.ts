import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { getOpenProblem, resolveProblem } from "@frontend/lib/services/delivery-handoff.service";

export const dynamic = "force-dynamic";

const STAFF = ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "SHOP_MANAGER", "STORE_MANAGER", "OPERATIONS_MANAGER"];

function staffSession(req: NextRequest) {
  const s = resolveServerSession(req);
  if (!s) return { error: NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 }) };
  const role = String(s.role || "").toUpperCase();
  if (!STAFF.includes(role)) return { error: NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 }) };
  return { session: s, role };
}

/** GET — is there an open problem reported by the receiver? */
export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const st = staffSession(req);
  if (st.error) return st.error;
  return NextResponse.json({ success: true, ...(await getOpenProblem(decodeURIComponent(params.orderId))) });
}

/** POST { action: "replace" | "accept", note? } — shop decides: send a new cake with the same rider, or unlock. */
export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const st = staffSession(req);
  if (st.error) return st.error;
  const b = await req.json().catch(() => ({}));
  if (b.action !== "replace" && b.action !== "accept") {
    return NextResponse.json({ success: false, error: "action must be 'replace' or 'accept'." }, { status: 400 });
  }
  try {
    const r = await resolveProblem(
      decodeURIComponent(params.orderId),
      b.action,
      { id: st.session!.userId || st.role!, role: st.role!, branchId: st.session!.branchId || null },
      typeof b.note === "string" ? b.note.slice(0, 500) : undefined
    );
    return NextResponse.json({ success: true, ...r });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Could not resolve" }, { status: err.status || 400 });
  }
}
