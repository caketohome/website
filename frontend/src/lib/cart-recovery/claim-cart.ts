/**
 * Attach a guest cart to the signed-in customer so abandoned-cart recovery (WhatsApp / telecaller)
 * has a phone number to reach. Abandon detection reads metadata.customer_phone / customer_name.
 *
 * Never steals a cart that already belongs to a different customer.
 */

import { dbQuery } from "../db";

export async function claimCartForCustomer(
  cartId: string | null | undefined,
  customer: { userId: string; phone?: string | null; name?: string | null }
): Promise<boolean> {
  if (!cartId || cartId === "cart_guest" || !customer?.userId) return false;
  const digits = String(customer.phone || "").replace(/\D/g, "").slice(-10);
  const extra: Record<string, any> = { claimed_at: new Date().toISOString() };
  if (digits.length === 10) extra.customer_phone = `+91${digits}`;
  if (customer.name) extra.customer_name = customer.name;
  try {
    const res = await dbQuery(
      `UPDATE "cart"
          SET customer_id = COALESCE(customer_id, $2),
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
          AND (customer_id IS NULL OR customer_id = $2)`,
      [cartId, customer.userId, JSON.stringify(extra)]
    );
    return (res.rowCount || 0) > 0;
  } catch (err: any) {
    console.error("[claimCartForCustomer]", err.message);
    return false;
  }
}
