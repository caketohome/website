/**
 * Web Push (PWA) notifications for customers, branch managers and delivery partners.
 * Subscriptions live in public.push_subscription (one row per device endpoint).
 * Every send is best-effort: it never throws into the order flow that triggered it.
 */
import webpush from "web-push";
import { dbQuery } from "../db";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscriber {
  userId: string;
  role: string;
  branchId?: string | null;
  partnerId?: string | null;
  customerUid?: string | null;
}

const BRANCH_ROLES = ["BRANCH_MANAGER", "MANAGER"];

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@caketohome.com", pub!, priv!);
  else console.warn("[Push] VAPID keys missing; push notifications disabled.");
  return configured;
}

export async function saveSubscription(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  who: PushSubscriber,
  userAgent?: string | null
) {
  await dbQuery(
    `INSERT INTO public.push_subscription (endpoint, p256dh, auth, user_id, role, branch_id, partner_id, customer_uid, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id, role = EXCLUDED.role,
       branch_id = EXCLUDED.branch_id, partner_id = EXCLUDED.partner_id, customer_uid = EXCLUDED.customer_uid,
       user_agent = EXCLUDED.user_agent, updated_at = NOW()`,
    [
      sub.endpoint, sub.keys.p256dh, sub.keys.auth, who.userId, who.role.toUpperCase(),
      who.branchId || null, who.partnerId || null, who.customerUid || null, (userAgent || "").slice(0, 300),
    ]
  );
}

export async function removeSubscription(endpoint: string, userId: string) {
  await dbQuery(`DELETE FROM public.push_subscription WHERE endpoint = $1 AND user_id = $2`, [endpoint, userId]);
}

async function sendTo(where: string, params: unknown[], payload: PushPayload) {
  if (!ready()) return;
  const { rows } = await dbQuery(`SELECT id, endpoint, p256dh, auth FROM public.push_subscription WHERE ${where}`, params);
  const body = JSON.stringify(payload);
  await Promise.all(
    rows.map(async (r: any) => {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, { TTL: 3600 });
      } catch (err: any) {
        // 404/410 = the browser dropped this subscription; forget it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await dbQuery(`DELETE FROM public.push_subscription WHERE id = $1`, [r.id]).catch(() => null);
        } else {
          console.warn("[Push] send failed:", err?.statusCode || err?.message);
        }
      }
    })
  );
}

const pushToCustomer = (customerUid: string, p: PushPayload) => sendTo(`customer_uid = $1`, [customerUid], p);
const pushToBranch = (branchId: string, p: PushPayload) =>
  sendTo(`branch_id = $1 AND role = ANY($2::text[])`, [branchId, BRANCH_ROLES], p);
const pushToPartner = (partnerId: string, p: PushPayload) => sendTo(`partner_id = $1`, [partnerId], p);

const CUSTOMER_STATUS_TEXT: Record<string, string> = {
  confirmed: "Your order is confirmed.",
  kitchen_accepted: "The kitchen has started preparing your order.",
  preparing: "Your cake is being prepared.",
  in_preparation: "Your cake is being prepared.",
  ready_for_pickup: "Your order is ready for pickup.",
  baking: "Your cake is in the oven.",
  ready: "Your order is ready.",
  packed: "Your order is packed and ready for dispatch.",
  out_for_delivery: "Your order is out for delivery.",
  delivered: "Your order has been delivered. Enjoy!",
  completed: "Your order is complete. Enjoy!",
  cancelled: "Your order was cancelled.",
  canceled: "Your order was cancelled.",
};

interface OrderLike {
  id?: string;
  order_number?: string;
  display_id?: string | number;
  customer_id?: string | null;
  customer_uid?: string | null;
  branch_id?: string | null;
}

const customerOf = (o: OrderLike) => o.customer_uid || o.customer_id || null;

const label = (o: OrderLike) => `#${o.order_number || o.display_id || o.id}`;

/** Fire-and-forget wrapper: notification problems must never break the order flow. */
function safe(task: () => Promise<unknown>) {
  task().catch((err) => console.warn("[Push] notify failed:", err?.message));
}

export function notifyOrderCreated(order: OrderLike) {
  safe(async () => {
    if (order.branch_id)
      await pushToBranch(order.branch_id, {
        title: "New order received",
        body: `Order ${label(order)} needs attention.`,
        url: "/dashboard/shop",
        tag: `order-${order.id}`,
      });
    if (customerOf(order))
      await pushToCustomer(customerOf(order)!, {
        title: "Order placed",
        body: `We've received order ${label(order)}.`,
        url: "/account/orders",
        tag: `order-${order.id}`,
      });
  });
}

export function notifyOrderStatus(order: OrderLike, status: string) {
  const s = status.toLowerCase();
  safe(async () => {
    const text = CUSTOMER_STATUS_TEXT[s];
    if (text && customerOf(order))
      await pushToCustomer(customerOf(order)!, {
        title: `Order ${label(order)}`,
        body: text,
        url: "/account/orders",
        tag: `order-${order.id}`,
      });
    if ((s === "cancelled" || s === "canceled") && order.branch_id)
      await pushToBranch(order.branch_id, {
        title: "Order cancelled",
        body: `Order ${label(order)} was cancelled.`,
        url: "/dashboard/shop",
        tag: `order-${order.id}`,
      });
  });
}

export function notifyDeliveryAssigned(order: OrderLike, partnerId: string) {
  safe(async () => {
    await pushToPartner(partnerId, {
      title: "New delivery assigned",
      body: `Order ${label(order)} is assigned to you.`,
      url: "/dashboard/delivery-partner",
      tag: `delivery-${order.id}`,
    });
  });
}
