import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Nightly job: raise the parent-company (Baked) bills for the configured period (daily / weekly /
 * twice a month / monthly; per branch or combined). Call once a day after closing (e.g. Render cron at
 * 23:55 IST) with header `x-cron-secret: $CRON_SECRET`. Safe to call repeatedly.
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  const given = req.headers.get("x-cron-secret") || "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { raisePeriodParentBills, raisePendingParentBills, getParentCompanyConfig, billingPeriod } = await import("@frontend/lib/services/intercompany.service");
  const earlier = await raisePendingParentBills();
  // The current period is billed only on its last day (daily: every night; monthly: on the month's last day).
  const cfg = await getParentCompanyConfig();
  const todayIst = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const today = billingPeriod(todayIst, cfg.billing_frequency).end === todayIst ? await raisePeriodParentBills() : [];
  return NextResponse.json({ success: true, results: [...earlier, ...today] });
}
