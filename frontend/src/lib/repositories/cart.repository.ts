import { dbQuery, dbTransaction } from "../db";

export interface CartLineItemRecord {
  id: string;
  cart_id: string;
  title: string;
  thumbnail: string | null;
  quantity: number;
  variant_id: string | null;
  product_id: string | null;
  product_title: string | null;
  unit_price: number;
  total_price: number;
  subtotal: number;
  metadata: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CartRecord {
  id: string;
  region_id: string | null;
  customer_id: string | null;
  sales_channel_id: string | null;
  email: string | null;
  currency_code: string;
  subtotal: number;
  total: number;
  items: CartLineItemRecord[];
  metadata: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export class CartRepository {
  private static readonly DEFAULT_SALES_CHANNEL_ID = "sc_01KXYMA7K7YXD5SR8Y1MDMQA0G";
  private static readonly DEFAULT_REGION_ID = "reg_01KXYMABCTHP1SWK8QG3SMXXHD";

  /**
   * Find an authoritative cart by its ID in PostgreSQL.
   */
  static async findCartById(cartId: string): Promise<CartRecord | null> {
    if (!cartId || cartId === "items" || cartId === "cart_default") {
      return null;
    }

    try {
      const cartRes = await dbQuery(
        `SELECT id, region_id, customer_id, sales_channel_id, email, currency_code, metadata, created_at, updated_at
         FROM "cart"
         WHERE id = $1 AND deleted_at IS NULL`,
        [cartId]
      );

      if (!cartRes.rows || cartRes.rows.length === 0) {
        return null;
      }

      const rawCart = cartRes.rows[0];
      const itemsRes = await dbQuery(
        `SELECT id, cart_id, title, thumbnail, quantity, variant_id, product_id, product_title, 
                unit_price, compare_at_unit_price, metadata, created_at, updated_at
         FROM "cart_line_item"
         WHERE cart_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [cartId]
      );

      const items: CartLineItemRecord[] = (itemsRes.rows || []).map((row: any) => {
        const uPrice = Number(row.unit_price || 0);
        const qty = Number(row.quantity || 1);
        const lineTotal = uPrice * qty;
        const meta = typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {};
        return {
          id: row.id,
          cart_id: row.cart_id,
          title: row.title || row.product_title || "Artisan Cake",
          product_title: row.product_title || row.title,
          thumbnail: row.thumbnail || meta.thumbnail || "",
          quantity: qty,
          variant_id: row.variant_id,
          product_id: row.product_id,
          unit_price: uPrice,
          total_price: lineTotal,
          subtotal: lineTotal,
          price: uPrice,
          metadata: meta,
          weight: meta.weight,
          shape: meta.shape,
          flavour: meta.flavour,
          cake_message: meta.cake_message,
          selected_addons: meta.selected_addons,
          created_at: row.created_at,
          updated_at: row.updated_at,
        } as any;
      });

      const subtotal = items.reduce((sum, it) => sum + (it.total_price || 0), 0);
      const meta = typeof rawCart.metadata === "object" && rawCart.metadata !== null ? rawCart.metadata : {};

      return {
        id: rawCart.id,
        region_id: rawCart.region_id,
        customer_id: rawCart.customer_id,
        sales_channel_id: rawCart.sales_channel_id,
        email: rawCart.email,
        currency_code: rawCart.currency_code || "inr",
        subtotal,
        total: subtotal,
        items,
        metadata: {
          ...meta,
          item_count: items.reduce((sum, it) => sum + it.quantity, 0),
        },
        created_at: rawCart.created_at,
        updated_at: rawCart.updated_at,
      };
    } catch (err: any) {
      console.warn("[CartRepository.findCartById Error]:", err.message);
      return null;
    }
  }

  /**
   * Persist or update the top-level cart record in PostgreSQL.
   */
  static async saveCart(cart: Partial<CartRecord> & { id: string }): Promise<void> {
    if (!cart.id || cart.id === "items") return;

    try {
      const regionId = cart.region_id || this.DEFAULT_REGION_ID;
      const salesChannelId = cart.sales_channel_id || this.DEFAULT_SALES_CHANNEL_ID;
      const currencyCode = (cart.currency_code || "inr").toLowerCase();
      const meta = JSON.stringify(cart.metadata || {});

      await dbQuery(
        `INSERT INTO "cart" (id, region_id, customer_id, sales_channel_id, email, currency_code, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           customer_id = COALESCE(EXCLUDED.customer_id, "cart".customer_id),
           email = COALESCE(EXCLUDED.email, "cart".email),
           currency_code = EXCLUDED.currency_code,
           metadata = EXCLUDED.metadata,
           updated_at = NOW(),
           deleted_at = NULL`,
        [cart.id, regionId, cart.customer_id || null, salesChannelId, cart.email || null, currencyCode, meta]
      );
    } catch (err: any) {
      console.warn("[CartRepository.saveCart Error]:", err.message);
    }
  }

  /**
   * Authoritatively upsert a line item into PostgreSQL `cart_line_item`.
   */
  static async upsertLineItem(cartId: string, item: any): Promise<void> {
    if (!cartId || !item) return;

    try {
      // 1. Ensure the parent cart exists in DB
      await this.saveCart({ id: cartId });

      const itemId = item.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const prodId = item.product_id || item.productId || null;
      const varId = item.variant_id || item.variantId || (prodId ? `var_${prodId}` : null);
      const title = item.title || item.name || "Artisan Cake";
      const thumb = item.thumbnail || item.image || item.image_url || "";
      const qty = Math.max(1, Number(item.quantity || 1));
      const unitPrice = Number(item.unit_price ?? item.price ?? 0);
      const rawUnitPrice = JSON.stringify({ value: String(unitPrice), precision: 20 });
      const meta = JSON.stringify(item.metadata || item);

      await dbQuery(
        `INSERT INTO "cart_line_item" (
           id, cart_id, title, thumbnail, quantity, variant_id, product_id, product_title,
           unit_price, raw_unit_price, compare_at_unit_price, metadata, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           unit_price = EXCLUDED.unit_price,
           raw_unit_price = EXCLUDED.raw_unit_price,
           metadata = EXCLUDED.metadata,
           updated_at = NOW(),
           deleted_at = NULL`,
        [itemId, cartId, title, thumb, qty, varId, prodId, title, unitPrice, rawUnitPrice, unitPrice, meta]
      );
    } catch (err: any) {
      console.warn("[CartRepository.upsertLineItem Error]:", err.message);
    }
  }

  /**
   * Update line item quantity in PostgreSQL.
   */
  static async updateLineItemQuantity(cartId: string, lineItemId: string, quantity: number): Promise<void> {
    if (!cartId || !lineItemId) return;

    try {
      if (quantity <= 0) {
        await this.removeLineItem(cartId, lineItemId);
        return;
      }

      await dbQuery(
        `UPDATE "cart_line_item"
         SET quantity = $3, updated_at = NOW()
         WHERE cart_id = $1 AND (id = $2 OR product_id = $2 OR variant_id = $2)`,
        [cartId, lineItemId, quantity]
      );
    } catch (err: any) {
      console.warn("[CartRepository.updateLineItemQuantity Error]:", err.message);
    }
  }

  /**
   * Remove a line item from PostgreSQL.
   */
  static async removeLineItem(cartId: string, lineItemId: string): Promise<void> {
    if (!cartId || !lineItemId) return;

    try {
      await dbQuery(
        `DELETE FROM "cart_line_item"
         WHERE cart_id = $1 AND (id = $2 OR product_id = $2 OR variant_id = $2)`,
        [cartId, lineItemId]
      );
    } catch (err: any) {
      console.warn("[CartRepository.removeLineItem Error]:", err.message);
    }
  }

  /**
   * Clear all items in a cart in PostgreSQL.
   */
  static async clearCart(cartId: string): Promise<void> {
    if (!cartId) return;

    try {
      await dbQuery(`DELETE FROM "cart_line_item" WHERE cart_id = $1`, [cartId]);
      await dbQuery(
        `UPDATE "cart"
         SET metadata = '{}'::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [cartId]
      );
    } catch (err: any) {
      console.warn("[CartRepository.clearCart Error]:", err.message);
    }
  }
}
