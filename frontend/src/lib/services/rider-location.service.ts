/**
 * Rider live location (Supabase: public.delivery_partner_location).
 * One row per rider holding their latest position while on duty.
 */
import { dbQuery } from "../db";

export interface RiderLocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

const ACTIVE_STATUSES = ["out_for_delivery", "in_transit", "picked_up", "dispatched"];

function validNumber(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export async function saveRiderLocation(partnerId: string, input: RiderLocationInput): Promise<{ saved: boolean; reason?: string }> {
  const { latitude, longitude } = input;
  if (!validNumber(latitude) || !validNumber(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
    throw new Error("INVALID_LOCATION: latitude/longitude are not valid.");
  }
  const rider = await dbQuery(`SELECT id FROM public.delivery_partner WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [partnerId]);
  if (rider.rows.length === 0) throw new Error("RIDER_NOT_FOUND: This login is not linked to a delivery partner.");

  // The order the rider is currently carrying, if any.
  const active = await dbQuery(
    `SELECT id FROM public."order"
      WHERE deleted_at IS NULL
        AND (metadata->>'delivery_partner_id' = $1 OR metadata->'delivery'->>'partner_id' = $1)
        AND LOWER(COALESCE(NULLIF(status, 'pending'), metadata->>'bakery_status', status, '')) = ANY($2::text[])
      ORDER BY updated_at DESC LIMIT 1`,
    [partnerId, ACTIVE_STATUSES]
  );

  await dbQuery(
    `INSERT INTO public.delivery_partner_location
       (partner_id, latitude, longitude, accuracy_m, heading, speed_mps, order_id, on_duty, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
     ON CONFLICT (partner_id) DO UPDATE SET
       latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy_m = EXCLUDED.accuracy_m,
       heading = EXCLUDED.heading, speed_mps = EXCLUDED.speed_mps, order_id = EXCLUDED.order_id,
       on_duty = true, recorded_at = NOW()`,
    [
      partnerId,
      latitude,
      longitude,
      validNumber(input.accuracy) ? Math.round(input.accuracy) : null,
      validNumber(input.heading) ? input.heading : null,
      validNumber(input.speed) ? input.speed : null,
      active.rows[0]?.id || null,
    ]
  );
  return { saved: true };
}

export async function setRiderOffDuty(partnerId: string): Promise<void> {
  await dbQuery(`UPDATE public.delivery_partner_location SET on_duty = false, order_id = NULL WHERE partner_id = $1`, [partnerId]);
}

/** Riders on duty with a position from the last `maxAgeMinutes` (admins: all branches; managers: their branch). */
export async function listRiderLocations(opts: { branchId?: string | null; maxAgeMinutes?: number } = {}) {
  const r = await dbQuery(
    `SELECT l.partner_id, l.latitude, l.longitude, l.accuracy_m, l.order_id, l.recorded_at,
            dp.first_name, dp.last_name, dp.phone, p.primary_branch_id,
            o.display_id, o.metadata->>'order_number' AS order_number
       FROM public.delivery_partner_location l
       JOIN public.delivery_partner dp ON dp.id = l.partner_id AND dp.deleted_at IS NULL
       LEFT JOIN public.delivery_partner_profile p ON p.partner_id = dp.id
       LEFT JOIN public."order" o ON o.id = l.order_id
      WHERE l.on_duty = true
        AND l.recorded_at > NOW() - make_interval(mins => $1)
        AND ($2::text IS NULL OR p.primary_branch_id = $2)
      ORDER BY l.recorded_at DESC`,
    [opts.maxAgeMinutes ?? 30, opts.branchId || null]
  );
  return r.rows.map((x: any) => ({
    partner_id: x.partner_id,
    name: `${x.first_name || ""} ${x.last_name || ""}`.trim() || x.partner_id,
    phone: x.phone || "",
    branch_id: x.primary_branch_id || null,
    latitude: Number(x.latitude),
    longitude: Number(x.longitude),
    accuracy_m: x.accuracy_m === null ? null : Number(x.accuracy_m),
    order_id: x.order_id || null,
    order_number: x.order_number || (x.display_id ? String(x.display_id) : null),
    recorded_at: x.recorded_at,
  }));
}

/**
 * Rider position for one order, shown to the customer who placed it,
 * only while the order is out for delivery with that rider.
 */
export async function getRiderLocationForOrder(orderId: string, viewer: { customerIds: string[]; phone?: string | null }) {
  const o = await dbQuery(
    `SELECT id, customer_id, customer_phone, status, metadata FROM public."order"
      WHERE deleted_at IS NULL AND (id = $1 OR metadata->>'order_number' = $1) LIMIT 1`,
    [orderId]
  );
  const order = o.rows[0];
  if (!order) return { status: 404 as const, error: "ORDER_NOT_FOUND" };
  const phone10 = String(viewer.phone || "").replace(/\D/g, "").slice(-10);
  const orderPhone10 = String(order.customer_phone || order.metadata?.phone || "").replace(/\D/g, "").slice(-10);
  const owns = (order.customer_id && viewer.customerIds.includes(order.customer_id)) || (phone10 && phone10 === orderPhone10);
  if (!owns) return { status: 403 as const, error: "FORBIDDEN" };

  const status = String((order.status && order.status !== "pending" ? order.status : order.metadata?.bakery_status) || order.status || "").toLowerCase();
  const riderId = order.metadata?.delivery_partner_id || order.metadata?.delivery?.partner_id || null;
  if (!riderId || !ACTIVE_STATUSES.includes(status)) return { status: 200 as const, data: { tracking: false } };

  const l = await dbQuery(
    `SELECT l.latitude, l.longitude, l.recorded_at, dp.first_name
       FROM public.delivery_partner_location l
       JOIN public.delivery_partner dp ON dp.id = l.partner_id
      WHERE l.partner_id = $1 AND l.on_duty = true AND l.recorded_at > NOW() - INTERVAL '15 minutes' LIMIT 1`,
    [riderId]
  );
  const row = l.rows[0];
  const dest = order.metadata?.delivery_address || order.metadata?.shipping_address || order.metadata?.address || {};
  const destLat = Number(dest.latitude ?? dest.lat);
  const destLng = Number(dest.longitude ?? dest.lng);
  return {
    status: 200 as const,
    data: {
      tracking: Boolean(row),
      rider_name: row?.first_name || "",
      latitude: row ? Number(row.latitude) : null,
      longitude: row ? Number(row.longitude) : null,
      updated_at: row?.recorded_at || null,
      destination: Number.isFinite(destLat) && Number.isFinite(destLng) && !(destLat === 0 && destLng === 0) ? { latitude: destLat, longitude: destLng } : null,
    },
  };
}
