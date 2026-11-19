/**
 * Writes the rider's progress on an order (claim, pickup, delivery, reject) to Supabase,
 * so admin screens, customer tracking and restarts all see the same state as the rider app.
 */
import { dbQuery } from "../db";

export async function syncRiderOrderToDb(order: any): Promise<void> {
  if (!order?.id) return;
  const riderId = order.delivery_partner_id || order.assigned_partner_id || null;
  const delivery = {
    ...(order.delivery || {}),
    partner_id: riderId,
    partner_name: riderId ? order.driver_name || order.delivery?.partner_name || "" : null,
    partner_phone: riderId ? order.driver_phone || order.delivery?.partner_phone || "" : null,
    status: order.delivery_status || order.delivery?.status || null,
    claimed_at: order.claimed_at || order.delivery?.claimed_at || null,
    picked_up_at: order.pickup_verified_at || order.picked_up_at || order.delivery?.picked_up_at || null,
    delivered_at: order.delivered_at || order.delivery?.delivered_at || null,
    // a replacement cake is no longer pending once the rider has picked it up again
    replacement_pending: ["in_transit", "delivered"].includes(String(order.delivery_status || "")) ? false : Boolean(order.delivery?.replacement_pending),
  };
  const patch = {
    delivery_partner_id: riderId,
    delivery_partner_name: delivery.partner_name,
    delivery_status: delivery.status,
    bakery_status: order.status || null,
    delivery,
  };
  const r = await dbQuery(
    `UPDATE public."order"
        SET status = COALESCE($2, status),
            metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = NOW()
      WHERE (id = $1 OR metadata->>'order_number' = $1) AND deleted_at IS NULL`,
    [order.id, order.status || null, JSON.stringify(patch)]
  );
  if (r.rowCount === 0) {
    console.warn(`[RiderOrderSync] order ${order.id} not found in Supabase; rider progress not saved.`);
  }
}
