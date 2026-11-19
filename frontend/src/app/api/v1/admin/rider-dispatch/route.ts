import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@frontend/lib/security/auth-session";
import { getDispatchSettings } from "@frontend/lib/services/rider-dispatch.service";
import { dbQuery } from "@frontend/lib/db";

export const dynamic = "force-dynamic";

function staff(req: NextRequest, adminOnly: boolean) {
  const s = resolveServerSession(req);
  if (!s) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  const role = String(s.role || "").toUpperCase();
  const ok = adminOnly ? ["SUPER_ADMIN", "ADMIN"].includes(role) : ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "SHOP_MANAGER", "OPERATIONS_MANAGER"].includes(role);
  return ok ? null : NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
}

/** GET — rider dispatch settings (auto-assign on/off, claim window). */
export async function GET(req: NextRequest) {
  const denied = staff(req, false);
  if (denied) return denied;
  return NextResponse.json({ success: true, settings: await getDispatchSettings() });
}

/** PUT { auto_assign, claim_window_minutes } — admins only. */
export async function PUT(req: NextRequest) {
  const denied = staff(req, true);
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const minutes = Number(b.claim_window_minutes);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60) {
    return NextResponse.json({ success: false, error: "Claim window must be 0–60 minutes." }, { status: 400 });
  }
  const value = { auto_assign: b.auto_assign !== false, claim_window_minutes: Math.round(minutes) };
  await dbQuery(
    `INSERT INTO public.setting (id, "group", key, value, is_json, created_at, updated_at)
     VALUES ('set_delivery_dispatch', 'delivery', 'dispatch', $1, true, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = NOW()`,
    [JSON.stringify(value)]
  );
  return NextResponse.json({ success: true, settings: value });
}
