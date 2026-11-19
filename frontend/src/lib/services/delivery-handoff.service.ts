/**
 * Doorstep handoff by QR.
 * The assigned rider shows a QR (valid 30 min). The receiver scans it, signs in with their own
 * phone (OTP) and confirms the cake arrived safely. Only then are they shown the delivery OTP
 * (to tell the rider), any gift message, and the care note. A reported problem gives no OTP and
 * alerts the branch.
 */
import crypto from "crypto";
import { dbQuery } from "../db";

const TOKEN_TTL_MIN = 30;
const ACTIVE = ["out_for_delivery", "in_transit", "picked_up", "dispatched"];
export const CARE_NOTE = "Please keep the cake in the fridge until you serve it.";

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const effectiveStatus = (o: any) =>
  String((o.status && o.status !== "pending" ? o.status : o.metadata?.bakery_status) || o.status || "").toLowerCase();

async function loadOrder(orderId: string) {
  const r = await dbQuery(
    `SELECT id, branch_id, display_id, customer_id, status, metadata FROM public."order"
      WHERE (id = $1 OR metadata->>'order_number' = $1) AND deleted_at IS NULL LIMIT 1`,
    [orderId]
  );
  return r.rows[0] || null;
}

async function patchHandoff(orderId: string, patch: Record<string, any>) {
  await dbQuery(
    `UPDATE public."order"
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{handoff}', COALESCE(metadata->'handoff', '{}'::jsonb) || $2::jsonb),
            updated_at = NOW()
      WHERE id = $1`,
    [orderId, JSON.stringify(patch)]
  );
}

/** Rider creates a fresh QR token for an order they are carrying. */
export async function createHandoffToken(orderId: string, riderId: string) {
  const o = await loadOrder(orderId);
  if (!o) throw Object.assign(new Error("Order not found."), { status: 404 });
  const assigned = o.metadata?.delivery_partner_id || o.metadata?.delivery?.partner_id;
  if (assigned !== riderId) throw Object.assign(new Error("This order is not assigned to you."), { status: 403 });
  if (!ACTIVE.includes(effectiveStatus(o)) && String(o.metadata?.delivery_status || "") !== "in_transit") {
    throw Object.assign(new Error("Show the QR only after pickup, while the order is out for delivery."), { status: 400 });
  }
  const token = crypto.randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString();
  await patchHandoff(o.id, { token_hash: hash(token), expires_at: expiresAt, created_at: new Date().toISOString(), rider_id: riderId });
  return { token, expires_at: expiresAt, order_id: o.id };
}

async function orderForToken(token: string) {
  if (!token || token.length < 16) return null;
  const r = await dbQuery(
    `SELECT id, branch_id, display_id, customer_id, status, metadata FROM public."order"
      WHERE deleted_at IS NULL AND metadata->'handoff'->>'token_hash' = $1 LIMIT 1`,
    [hash(token)]
  );
  const o = r.rows[0];
  if (!o) return null;
  if (new Date(o.metadata?.handoff?.expires_at || 0).getTime() < Date.now()) return { expired: true, order: o };
  return { expired: false, order: o };
}

/** Public info for the scan page (no OTP, no address, no phone numbers). */
export async function describeHandoff(token: string) {
  const f = await orderForToken(token);
  if (!f) return { status: 404 as const, error: "This QR code is not valid." };
  if (f.expired) return { status: 410 as const, error: "This QR code has expired. Ask the rider to show a new one." };
  const o = f.order;
  const b = o.branch_id ? (await dbQuery(`SELECT name FROM public.branch WHERE id = $1`, [o.branch_id])).rows[0] : null;
  return {
    status: 200 as const,
    data: {
      order_number: o.metadata?.order_number || (o.display_id ? String(o.display_id) : o.id),
      branch_name: b?.name || "",
      rider_name: String(o.metadata?.delivery?.partner_name || o.metadata?.delivery_partner_name || "").split(" ")[0] || "",
      already_confirmed: Boolean(o.metadata?.handoff?.confirmed_at),
      delivered: effectiveStatus(o) === "delivered",
    },
  };
}

/**
 * Signed-in receiver confirms the cake's condition.
 * received_safely = true  -> returns delivery OTP + gift message + care note.
 * received_safely = false -> no OTP; problem recorded and branch alerted.
 */
export async function confirmHandoff(token: string, receiverPhone: string, receivedSafely: boolean, problem?: string) {
  const phone10 = String(receiverPhone || "").replace(/\D/g, "").slice(-10);
  if (phone10.length !== 10) return { status: 401 as const, error: "Sign in with your mobile number first." };
  const f = await orderForToken(token);
  if (!f) return { status: 404 as const, error: "This QR code is not valid." };
  if (f.expired) return { status: 410 as const, error: "This QR code has expired. Ask the rider to show a new one." };
  const o = f.order;
  const label = `#${o.metadata?.order_number || o.display_id || o.id}`;
  const { notifyBranch } = await import("./push-notification.service");

  if (!receivedSafely) {
    await patchHandoff(o.id, { problem_reported_at: new Date().toISOString(), problem_by_phone: phone10, problem: String(problem || "").slice(0, 500) });
    notifyBranch({ id: o.id, branch_id: o.branch_id }, `Receiver reported a problem with order ${label}: ${String(problem || "no details").slice(0, 120)}`);
    return { status: 200 as const, data: { received_safely: false } };
  }

  // Delivery OTP: Supabase order first, then the live engine copy.
  let otp = String(o.metadata?.delivery?.delivery_otp || o.metadata?.delivery_otp || "");
  if (!otp) {
    const mem = ((globalThis as any).__CTH_MEMORY_STORE__?.orders || []).find((x: any) => x.id === o.id);
    otp = String(mem?.delivery_otp || mem?.delivery?.delivery_otp || "");
  }
  if (!otp) return { status: 409 as const, error: "No delivery code is set for this order. Ask the rider to contact the branch." };

  await patchHandoff(o.id, { confirmed_at: new Date().toISOString(), confirmed_by_phone: phone10, received_safely: true });
  const gift = o.metadata?.gift_message || o.metadata?.custom_message || o.metadata?.delivery?.gift_message || "";
  return {
    status: 200 as const,
    data: { received_safely: true, delivery_otp: otp, gift_message: typeof gift === "string" ? gift : "", care_note: CARE_NOTE },
  };
}
