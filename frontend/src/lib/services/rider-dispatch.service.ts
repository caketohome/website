/**
 * Rider dispatch: an order that is ready for delivery is first offered to the branch's on-duty
 * riders to claim. If nobody claims it within the claim window, it is assigned automatically to
 * the best available rider (on duty, ONLINE in the last few minutes, under their order limit,
 * nearest to the kitchen, fewest open deliveries). The branch is alerted at every step.
 *
 * Settings (Supabase public.setting, group "delivery", key "dispatch"):
 *   { "auto_assign": true, "claim_window_minutes": 3 }
 */
import { dbQuery } from "../db";

export interface DispatchSettings {
  auto_assign: boolean;
  claim_window_minutes: number;
}

const DEFAULTS: DispatchSettings = { auto_assign: true, claim_window_minutes: 3 };
const READY_STATUSES = ["ready_for_pickup", "packed", "ready"];
const RIDER_FRESH_MINUTES = 10;

const EFFECTIVE_STATUS_SQL = `LOWER(COALESCE(NULLIF(o.status, 'pending'), o.metadata->>'bakery_status', o.status, ''))`;

export async function getDispatchSettings(): Promise<DispatchSettings> {
  try {
    const r = await dbQuery(`SELECT value FROM public.setting WHERE "group" = 'delivery' AND key = 'dispatch' AND deleted_at IS NULL LIMIT 1`);
    const v = r.rows[0]?.value;
    const parsed = typeof v === "string" ? JSON.parse(v) : v || {};
    return {
      auto_assign: parsed.auto_assign !== false,
      claim_window_minutes: Math.min(60, Math.max(0, Number(parsed.claim_window_minutes ?? DEFAULTS.claim_window_minutes))),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** On-duty riders of a branch who can take one more order, best first. */
export async function availableRidersForBranch(branchId: string) {
  const r = await dbQuery(
    `SELECT dp.id, dp.first_name, dp.last_name, dp.phone,
            COALESCE(p.max_concurrent_orders, 5) AS max_orders,
            l.latitude, l.longitude,
            b.latitude AS b_lat, b.longitude AS b_lng,
            (SELECT COUNT(*) FROM public."order" o
              WHERE o.deleted_at IS NULL
                AND (o.metadata->>'delivery_partner_id' = dp.id OR o.metadata->'delivery'->>'partner_id' = dp.id)
                AND ${EFFECTIVE_STATUS_SQL} NOT IN ('delivered', 'completed', 'cancelled', 'canceled', 'refunded', 'failed'))::int AS open_orders
       FROM public.delivery_partner dp
       JOIN public.delivery_partner_profile p ON p.partner_id = dp.id
       JOIN public.delivery_partner_location l ON l.partner_id = dp.id
       LEFT JOIN public.branch b ON b.id = p.primary_branch_id
      WHERE dp.deleted_at IS NULL
        AND COALESCE(dp.is_active, true) = true
        AND UPPER(COALESCE(p.status, '')) = 'ACTIVE'
        AND p.primary_branch_id = $1
        AND l.on_duty = true
        AND l.recorded_at > NOW() - make_interval(mins => $2)`,
    [branchId, RIDER_FRESH_MINUTES]
  );
  return r.rows
    .filter((x: any) => Number(x.open_orders) < Number(x.max_orders))
    .map((x: any) => {
      const hasBranch = x.b_lat != null && x.b_lng != null && Number(x.b_lat) !== 0;
      return {
        id: x.id as string,
        name: `${x.first_name || ""} ${x.last_name || ""}`.trim() || x.id,
        phone: (x.phone || "") as string,
        open_orders: Number(x.open_orders),
        distance_km: hasBranch ? km(Number(x.b_lat), Number(x.b_lng), Number(x.latitude), Number(x.longitude)) : null,
      };
    })
    .sort((a, b) => {
      if (a.distance_km !== null && b.distance_km !== null && Math.abs(a.distance_km - b.distance_km) > 0.3) return a.distance_km - b.distance_km;
      return a.open_orders - b.open_orders;
    });
}

async function markDispatch(orderId: string, patch: Record<string, any>) {
  await dbQuery(
    `UPDATE public."order"
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{dispatch}', COALESCE(metadata->'dispatch', '{}'::jsonb) || $2::jsonb),
            updated_at = NOW()
      WHERE id = $1`,
    [orderId, JSON.stringify(patch)]
  );
}

/** One pass over orders waiting for a rider. Returns what happened (for logs/tests). */
export async function runDispatchSweep(now: Date = new Date()) {
  const settings = await getDispatchSettings();
  const { notifyBranch, notifyRiders } = await import("./push-notification.service");
  const { OrderRepository } = await import("../repositories/order.repository");

  const waiting = await dbQuery(
    `SELECT o.id, o.branch_id, o.display_id, o.customer_id, o.metadata, o.updated_at
       FROM public."order" o
      WHERE o.deleted_at IS NULL
        AND o.branch_id IS NOT NULL
        AND COALESCE(o.metadata->>'delivery_partner_id', o.metadata->'delivery'->>'partner_id', '') = ''
        AND LOWER(COALESCE(o.metadata->>'delivery_type', o.metadata->>'fulfillment_type', 'delivery')) <> 'pickup'
        AND (${EFFECTIVE_STATUS_SQL} = ANY($1::text[]) OR LOWER(COALESCE(o.metadata->>'delivery_status', '')) = 'ready_for_pickup')
      ORDER BY o.updated_at ASC
      LIMIT 50`,
    [READY_STATUSES]
  );

  const results: Array<{ order_id: string; action: string; rider_id?: string }> = [];
  for (const o of waiting.rows) {
    const d = o.metadata?.dispatch || {};
    const label = `#${o.metadata?.order_number || o.display_id || o.id}`;
    const orderLike = { id: o.id, order_number: o.metadata?.order_number, display_id: o.display_id, branch_id: o.branch_id, customer_id: o.customer_id };

    // 1. First time seen ready: offer to on-duty riders of the branch.
    if (!d.offered_at) {
      const riders = await availableRidersForBranch(o.branch_id);
      await markDispatch(o.id, { offered_at: now.toISOString(), offered_to: riders.map((r) => r.id) });
      notifyRiders(riders.map((r) => r.id), orderLike, `Order ${label} is ready — claim it in the rider app.`);
      notifyBranch(orderLike, riders.length
        ? `Order ${label} is waiting for a rider (${riders.length} on duty).`
        : `Order ${label} is ready but no rider is on duty.`);
      results.push({ order_id: o.id, action: riders.length ? "offered" : "offered_no_rider" });
      continue;
    }

    // 2. Claim window still open: riders can claim.
    const ageMin = (now.getTime() - new Date(d.offered_at).getTime()) / 60000;
    if (!settings.auto_assign || ageMin < settings.claim_window_minutes) {
      results.push({ order_id: o.id, action: "waiting_for_claim" });
      continue;
    }

    // 3. Nobody claimed: assign the best available rider.
    const riders = await availableRidersForBranch(o.branch_id);
    const best = riders[0];
    if (!best) {
      if (!d.no_rider_alerted_at) {
        await markDispatch(o.id, { no_rider_alerted_at: now.toISOString() });
        notifyBranch(orderLike, `No rider available for order ${label}. Assign one manually or ask a rider to go on duty.`);
      }
      results.push({ order_id: o.id, action: "no_rider" });
      continue;
    }
    try {
      await OrderRepository.assignDelivery(
        o.id,
        best.id,
        best.name,
        best.phone,
        `Auto-assigned after ${settings.claim_window_minutes} min with no claim: nearest available rider${best.distance_km !== null ? ` (${best.distance_km.toFixed(1)} km)` : ""}, ${best.open_orders} open deliveries.`
      );
      await markDispatch(o.id, { auto_assigned_at: now.toISOString(), auto_assigned_to: best.id });
      notifyBranch(orderLike, `Order ${label} auto-assigned to ${best.name}.`);
      results.push({ order_id: o.id, action: "auto_assigned", rider_id: best.id });
    } catch (err: any) {
      console.error(`[Dispatch] auto-assign failed for ${o.id}:`, err?.message);
      results.push({ order_id: o.id, action: "assign_failed" });
    }
  }
  return results;
}

/** Starts the background sweep (every 30 s) once per server process. */
export function startRiderDispatcher() {
  const g = globalThis as any;
  if (g.__cthRiderDispatcher) return;
  if (process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build" || process.env.RIDER_DISPATCH_DISABLED === "true") return;
  if (!process.env.DATABASE_URL) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDispatchSweep();
    } catch (err: any) {
      console.error("[Dispatch] sweep failed:", err?.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 30_000);
  (timer as any).unref?.();
  g.__cthRiderDispatcher = timer;
  console.log("[Dispatch] rider dispatcher started (claim window, then auto-assign)");
}
