import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";

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
  price?: number;
  total_price: number;
  subtotal: number;
  weight?: string | null;
  shape?: string | null;
  flavour?: string | null;
  cake_message?: string | null;
  selected_addons?: any[];
  selected_addons_detail?: any[];
  greeting_card_text?: string | null;
  photo_cake?: boolean;
  photo_cake_file_name?: string | null;
  sugar_free?: boolean;
  gluten_free?: boolean;
  vegan?: boolean;
  addons_unit_total?: number;
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
  customer_email?: string | null;
  status?: string;
  branch_id?: string | null;
  coupon_code?: string | null;
  currency_code: string;
  subtotal: number;
  discount_total?: number;
  tax_total?: number;
  total: number;
  items: CartLineItemRecord[];
  metadata: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export function normalizeCakeMessage(rawMessage: unknown): string | null {
  if (rawMessage === undefined || rawMessage === null) {
    return null;
  }
  const str = String(rawMessage).trim();
  if (!str) {
    return null;
  }
  if (str.length > 30) {
    throw new Error("Cake message cannot exceed 30 characters.");
  }
  return str;
}

export class CartRepository {
  private static readonly DEFAULT_SALES_CHANNEL_ID = "sc_01KXYMA7K7YXD5SR8Y1MDMQA0G";
  private static readonly DEFAULT_REGION_ID = "reg_01KXYMABCTHP1SWK8QG3SMXXHD";

  private static async recalculateCartTotals(cartId: string, client?: PoolClient): Promise<void> {
    const runner = client ? client.query.bind(client) : dbQuery;
    await runner(
      `UPDATE "cart" c
       SET subtotal = COALESCE((
             SELECT SUM(COALESCE(cli.unit_price, 0) * COALESCE(cli.quantity, 1))
             FROM "cart_line_item" cli
             WHERE cli.cart_id = c.id AND cli.deleted_at IS NULL
           ), 0),
           total = GREATEST(0, COALESCE((
             SELECT SUM(COALESCE(cli.unit_price, 0) * COALESCE(cli.quantity, 1))
             FROM "cart_line_item" cli
             WHERE cli.cart_id = c.id AND cli.deleted_at IS NULL
           ), 0) - COALESCE(c.discount_total, 0) + COALESCE(c.tax_total, 0)),
           updated_at = NOW()
       WHERE c.id = $1`,
      [cartId]
    );
  }

  /**
   * Find an authoritative cart by its ID in PostgreSQL.
   */
  static async findCartById(cartId: string): Promise<CartRecord | null> {
    if (!cartId || cartId === "items" || cartId === "cart_default") {
      return null;
    }

    try {
      const cartRes = await dbQuery(
        `SELECT id, region_id, customer_id, sales_channel_id, email, customer_email,
                status, branch_id, coupon_code, currency_code,
                subtotal, discount_total, tax_total, total,
                metadata, created_at, updated_at
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
                unit_price, subtotal, compare_at_unit_price,
                weight, flavour, shape, cake_message,
                selected_addons, selected_addons_detail, greeting_card_text,
                photo_cake, sugar_free, gluten_free, vegan, addons_unit_total,
                metadata, created_at, updated_at
         FROM "cart_line_item"
         WHERE cart_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC, id ASC`,
        [cartId]
      );

      const items: CartLineItemRecord[] = (itemsRes.rows || []).map((row: any) => {
        const uPrice = Number(row.unit_price || 0);
        const qty = Number(row.quantity || 1);
        const lineTotal = uPrice * qty;
        const meta = typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {};
        const weight = row.weight ?? meta.weight ?? null;
        const shape = row.shape ?? meta.shape ?? null;
        const flavour = row.flavour ?? meta.flavour ?? null;
        const cakeMessage = row.cake_message ?? meta.cake_message ?? null;
        const selectedAddons = Array.isArray(row.selected_addons) && row.selected_addons.length > 0
          ? row.selected_addons
          : Array.isArray(meta.selected_addons)
            ? meta.selected_addons
            : [];
        const selectedAddonsDetail = Array.isArray(row.selected_addons_detail) && row.selected_addons_detail.length > 0
          ? row.selected_addons_detail
          : Array.isArray(meta.selected_addons_detail)
            ? meta.selected_addons_detail
            : [];
        const greetingCardText = row.greeting_card_text ?? meta.greeting_card_text ?? null;
        const photoCake = Boolean(row.photo_cake ?? meta.photo_cake ?? false);
        const photoCakeFileName = meta.photo_cake_file_name ?? null;
        const sugarFree = Boolean(row.sugar_free ?? meta.sugar_free ?? false);
        const glutenFree = Boolean(row.gluten_free ?? meta.gluten_free ?? false);
        const vegan = Boolean(row.vegan ?? meta.vegan ?? false);
        const addonsUnitTotal = Number(row.addons_unit_total ?? meta.addons_unit_total ?? 0);

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
          price: uPrice,
          total_price: lineTotal,
          subtotal: lineTotal,
          weight,
          shape,
          flavour,
          cake_message: cakeMessage,
          selected_addons: selectedAddons,
          selected_addons_detail: selectedAddonsDetail,
          greeting_card_text: greetingCardText,
          photo_cake: photoCake,
          photo_cake_file_name: photoCakeFileName,
          sugar_free: sugarFree,
          gluten_free: glutenFree,
          vegan,
          addons_unit_total: addonsUnitTotal,
          metadata: {
            ...meta,
            weight,
            shape,
            flavour,
            cake_message: cakeMessage,
            selected_addons: selectedAddons,
            selected_addons_detail: selectedAddonsDetail,
            greeting_card_text: greetingCardText,
            photo_cake: photoCake,
            photo_cake_file_name: photoCakeFileName,
            sugar_free: sugarFree,
            gluten_free: glutenFree,
            vegan,
            addons_unit_total: addonsUnitTotal,
          },
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      const subtotal = items.reduce((sum, it) => sum + (it.total_price || 0), 0);
      const discountTotal = Number(rawCart.discount_total || 0);
      const taxTotal = Number(rawCart.tax_total || 0);
      const total = Math.max(0, subtotal - discountTotal + taxTotal);
      const meta = typeof rawCart.metadata === "object" && rawCart.metadata !== null ? rawCart.metadata : {};

      return {
        id: rawCart.id,
        region_id: rawCart.region_id,
        customer_id: rawCart.customer_id,
        sales_channel_id: rawCart.sales_channel_id,
        email: rawCart.email || rawCart.customer_email || null,
        customer_email: rawCart.customer_email || rawCart.email || null,
        status: rawCart.status || "ACTIVE",
        branch_id: rawCart.branch_id || meta.branch_id || null,
        coupon_code: rawCart.coupon_code || null,
        currency_code: rawCart.currency_code || "inr",
        subtotal,
        discount_total: discountTotal,
        tax_total: taxTotal,
        total,
        items,
        metadata: {
          ...meta,
          item_count: items.reduce((sum, it) => sum + it.quantity, 0),
        },
        created_at: rawCart.created_at,
        updated_at: rawCart.updated_at,
      };
    } catch (err: any) {
      console.error("[CartRepository.findCartById Error]:", err.message);
      return null;
    }
  }

  /**
   * Find the most recent active cart for a customer ID.
   */
  static async findActiveCartByCustomer(customerId: string): Promise<CartRecord | null> {
    if (!customerId) return null;
    try {
      const res = await dbQuery(
        `SELECT id FROM "cart"
         WHERE customer_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 1`,
        [customerId]
      );
      if (!res.rows || res.rows.length === 0) return null;
      return await this.findCartById(res.rows[0].id);
    } catch (err: any) {
      console.error("[CartRepository.findActiveCartByCustomer Error]:", err.message);
      return null;
    }
  }

  /**
   * Persist or update the top-level cart record in PostgreSQL.
   */
  static async saveCart(cart: Partial<CartRecord> & { id: string } & Record<string, any>, client?: PoolClient): Promise<void> {
    if (!cart.id || cart.id === "items") return;

    const runner = client ? client.query.bind(client) : dbQuery;
    const regionId = cart.region_id || this.DEFAULT_REGION_ID;
    const salesChannelId = cart.sales_channel_id || this.DEFAULT_SALES_CHANNEL_ID;
    const currencyCode = (cart.currency_code || "inr").toLowerCase();
    const customerId = cart.customer_id || cart.customer_uid || null;
    const email = cart.email || cart.customer_email || null;
    const status = cart.status || "ACTIVE";
    const branchId = cart.branch_id || cart.metadata?.branch_id || null;
    const couponCode = cart.coupon_code || cart.applied_coupon?.code || null;
    const subtotal = Number(cart.subtotal ?? 0);
    const discountTotal = Number(cart.discount_total ?? cart.discount_amount ?? 0);
    const taxTotal = Number(cart.tax_total ?? 0);
    const total = Number(cart.total ?? Math.max(0, subtotal - discountTotal + taxTotal));
    const meta = JSON.stringify(cart.metadata || {});

    await runner(
      `INSERT INTO "cart" (
         id, region_id, customer_id, sales_channel_id, email, customer_email,
         status, currency_code, branch_id, coupon_code,
         subtotal, discount_total, tax_total, total,
         metadata, created_at, updated_at, deleted_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW(), NOW(), NULL)
       ON CONFLICT (id) DO UPDATE SET
         customer_id = COALESCE(EXCLUDED.customer_id, "cart".customer_id),
         email = COALESCE(EXCLUDED.email, "cart".email),
         customer_email = COALESCE(EXCLUDED.customer_email, "cart".customer_email),
         status = COALESCE(EXCLUDED.status, "cart".status),
         currency_code = EXCLUDED.currency_code,
         branch_id = COALESCE(EXCLUDED.branch_id, "cart".branch_id),
         coupon_code = COALESCE(EXCLUDED.coupon_code, "cart".coupon_code),
         subtotal = CASE WHEN EXCLUDED.subtotal > 0 THEN EXCLUDED.subtotal ELSE "cart".subtotal END,
         discount_total = EXCLUDED.discount_total,
         tax_total = EXCLUDED.tax_total,
         total = CASE WHEN EXCLUDED.total > 0 THEN EXCLUDED.total ELSE "cart".total END,
         metadata = COALESCE("cart".metadata, '{}'::jsonb) || EXCLUDED.metadata,
         updated_at = NOW(),
         deleted_at = NULL`,
      [
        cart.id,
        regionId,
        customerId,
        salesChannelId,
        email,
        email,
        status,
        currencyCode,
        branchId,
        couponCode,
        subtotal,
        discountTotal,
        taxTotal,
        total,
        meta,
      ]
    );
  }

  /**
   * Authoritatively upsert a line item into PostgreSQL `cart_line_item`.
   */
  static async upsertLineItem(cartId: string, item: any, client?: PoolClient): Promise<void> {
    if (!cartId || !item) return;

    const runner = client ? client.query.bind(client) : dbQuery;

    // 1. Validate cake_message length before writing
    const rawCakeMsg = item.cake_message !== undefined ? item.cake_message : item.metadata?.cake_message;
    const normalizedCakeMessage = normalizeCakeMessage(rawCakeMsg);

    // 2. Ensure the parent cart exists in DB
    await this.saveCart({ id: cartId }, client);

    const itemId = item.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const prodId = item.product_id || item.productId || "prod_unknown";
    const varId = item.variant_id || item.variantId || (prodId ? `var_${prodId}` : null);
    const title = item.title || item.name || item.product_title || "Artisan Cake";
    const thumb = item.thumbnail || item.image || item.image_url || "";
    const qty = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.unit_price ?? item.price ?? 0);
    const subtotal = unitPrice * qty;
    const rawUnitPrice = JSON.stringify({ value: String(unitPrice), precision: 20 });

    const weight = item.weight ?? item.metadata?.weight ?? null;
    const flavour = item.flavour ?? item.flavor ?? item.metadata?.flavour ?? null;
    const shape = item.shape ?? item.metadata?.shape ?? null;
    const selectedAddons = Array.isArray(item.selected_addons)
      ? item.selected_addons
      : Array.isArray(item.metadata?.selected_addons)
        ? item.metadata.selected_addons
        : [];
    const selectedAddonsDetail = Array.isArray(item.selected_addons_detail)
      ? item.selected_addons_detail
      : Array.isArray(item.metadata?.selected_addons_detail)
        ? item.metadata.selected_addons_detail
        : [];
    const greetingCardText = item.greeting_card_text ?? item.metadata?.greeting_card_text ?? null;
    const photoCake = Boolean(item.photo_cake ?? item.metadata?.photo_cake ?? false);
    const photoCakeFileName = item.photo_cake_file_name ?? item.metadata?.photo_cake_file_name ?? null;
    const sugarFree = Boolean(item.sugar_free ?? item.metadata?.sugar_free ?? false);
    const glutenFree = Boolean(item.gluten_free ?? item.metadata?.gluten_free ?? false);
    const vegan = Boolean(item.vegan ?? item.metadata?.vegan ?? false);
    const addonsUnitTotal = Number(item.addons_unit_total ?? item.metadata?.addons_unit_total ?? 0);

    const metadataObj = {
      ...(typeof item.metadata === "object" && item.metadata !== null ? item.metadata : {}),
      weight,
      flavour,
      shape,
      cake_message: normalizedCakeMessage,
      selected_addons: selectedAddons,
      selected_addons_detail: selectedAddonsDetail,
      greeting_card_text: greetingCardText,
      photo_cake: photoCake,
      photo_cake_file_name: photoCakeFileName,
      sugar_free: sugarFree,
      gluten_free: glutenFree,
      vegan,
      addons_unit_total: addonsUnitTotal,
    };

    await runner(
      `INSERT INTO "cart_line_item" (
         id, cart_id, title, thumbnail, quantity, variant_id, product_id, product_title,
         unit_price, subtotal, raw_unit_price, compare_at_unit_price,
         weight, flavour, shape, cake_message,
         selected_addons, selected_addons_detail, greeting_card_text,
         photo_cake, sugar_free, gluten_free, vegan, addons_unit_total,
         metadata, created_at, updated_at, deleted_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11::jsonb, $12,
         $13, $14, $15, $16,
         $17::jsonb, $18::jsonb, $19,
         $20, $21, $22, $23, $24,
         $25::jsonb, NOW(), NOW(), NULL
       )
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         thumbnail = EXCLUDED.thumbnail,
         quantity = EXCLUDED.quantity,
         variant_id = EXCLUDED.variant_id,
         product_id = EXCLUDED.product_id,
         product_title = EXCLUDED.product_title,
         unit_price = EXCLUDED.unit_price,
         subtotal = EXCLUDED.subtotal,
         raw_unit_price = EXCLUDED.raw_unit_price,
         weight = EXCLUDED.weight,
         flavour = EXCLUDED.flavour,
         shape = EXCLUDED.shape,
         cake_message = EXCLUDED.cake_message,
         selected_addons = EXCLUDED.selected_addons,
         selected_addons_detail = EXCLUDED.selected_addons_detail,
         greeting_card_text = EXCLUDED.greeting_card_text,
         photo_cake = EXCLUDED.photo_cake,
         sugar_free = EXCLUDED.sugar_free,
         gluten_free = EXCLUDED.gluten_free,
         vegan = EXCLUDED.vegan,
         addons_unit_total = EXCLUDED.addons_unit_total,
         metadata = EXCLUDED.metadata,
         updated_at = NOW(),
         deleted_at = NULL`,
      [
        itemId,
        cartId,
        title,
        thumb,
        qty,
        varId,
        prodId,
        title,
        unitPrice,
        subtotal,
        rawUnitPrice,
        unitPrice,
        weight,
        flavour,
        shape,
        normalizedCakeMessage,
        JSON.stringify(selectedAddons),
        JSON.stringify(selectedAddonsDetail),
        greetingCardText,
        photoCake,
        sugarFree,
        glutenFree,
        vegan,
        addonsUnitTotal,
        JSON.stringify(metadataObj),
      ]
    );

    if (!client) {
      await this.recalculateCartTotals(cartId);
    }
  }

  /**
   * Atomically persist a full cart and its line items in a single PostgreSQL transaction.
   */
  static async saveCartWithItems(cart: any): Promise<CartRecord | null> {
    if (!cart || !cart.id) return null;

    await dbTransaction(async (client) => {
      await this.saveCart(cart, client);

      const items: any[] = Array.isArray(cart.items) ? cart.items : [];
      const itemIds = items.map((it) => it.id).filter(Boolean);

      if (itemIds.length > 0) {
        await client.query(
          `DELETE FROM "cart_line_item"
           WHERE cart_id = $1 AND NOT (id = ANY($2::text[]))`,
          [cart.id, itemIds]
        );
      } else {
        await client.query(`DELETE FROM "cart_line_item" WHERE cart_id = $1`, [cart.id]);
      }

      for (const item of items) {
        await this.upsertLineItem(cart.id, item, client);
      }

      await this.recalculateCartTotals(cart.id, client);
    });

    return await this.findCartById(cart.id);
  }

  /**
   * Update line item quantity in PostgreSQL.
   * Matches by exact line item `id` first so multiple line items of the same product
   * with different cake messages do not overwrite each other.
   */
  static async updateLineItemQuantity(cartId: string, lineItemId: string, quantity: number): Promise<void> {
    if (!cartId || !lineItemId) return;

    if (quantity <= 0) {
      await this.removeLineItem(cartId, lineItemId);
      return;
    }

    const byIdRes = await dbQuery(
      `UPDATE "cart_line_item"
       SET quantity = $3::int, subtotal = unit_price * $3::int, updated_at = NOW()
       WHERE cart_id = $1 AND id = $2`,
      [cartId, lineItemId, quantity]
    );

    if ((byIdRes.rowCount ?? 0) === 0) {
      await dbQuery(
        `UPDATE "cart_line_item"
         SET quantity = $3::int, subtotal = unit_price * $3::int, updated_at = NOW()
         WHERE id = (
           SELECT id FROM "cart_line_item"
           WHERE cart_id = $1 AND (product_id = $2 OR variant_id = $2)
           ORDER BY created_at ASC
           LIMIT 1
         )`,
        [cartId, lineItemId, quantity]
      );
    }

    await this.recalculateCartTotals(cartId);
  }

  /**
   * Update a line item's `cake_message` in PostgreSQL (enforcing <= 30 characters).
   */
  static async updateLineItemMessage(
    cartId: string,
    lineItemId: string,
    cakeMessage: string | null | undefined
  ): Promise<void> {
    if (!cartId || !lineItemId) return;
    const normalized = normalizeCakeMessage(cakeMessage);

    const byIdRes = await dbQuery(
      `UPDATE "cart_line_item"
       SET cake_message = $3::text,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{cake_message}',
             COALESCE(to_jsonb($3::text), 'null'::jsonb),
             true
           ),
           updated_at = NOW()
       WHERE cart_id = $1 AND id = $2`,
      [cartId, lineItemId, normalized]
    );

    if ((byIdRes.rowCount ?? 0) === 0) {
      await dbQuery(
        `UPDATE "cart_line_item"
         SET cake_message = $3::text,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{cake_message}',
               COALESCE(to_jsonb($3::text), 'null'::jsonb),
               true
             ),
             updated_at = NOW()
         WHERE id = (
           SELECT id FROM "cart_line_item"
           WHERE cart_id = $1 AND (product_id = $2 OR variant_id = $2)
           ORDER BY created_at ASC
           LIMIT 1
         )`,
        [cartId, lineItemId, normalized]
      );
    }

    await dbQuery(`UPDATE "cart" SET updated_at = NOW() WHERE id = $1`, [cartId]);
  }

  /**
   * Remove a line item from PostgreSQL.
   * Matches by exact line item `id` first so other customizations of the same product remain intact.
   */
  static async removeLineItem(cartId: string, lineItemId: string): Promise<void> {
    if (!cartId || !lineItemId) return;

    const byIdRes = await dbQuery(
      `DELETE FROM "cart_line_item"
       WHERE cart_id = $1 AND id = $2`,
      [cartId, lineItemId]
    );

    if ((byIdRes.rowCount ?? 0) === 0) {
      await dbQuery(
        `DELETE FROM "cart_line_item"
         WHERE id = (
           SELECT id FROM "cart_line_item"
           WHERE cart_id = $1 AND (product_id = $2 OR variant_id = $2)
           ORDER BY created_at ASC
           LIMIT 1
         )`,
        [cartId, lineItemId]
      );
    }

    await this.recalculateCartTotals(cartId);
  }

  /**
   * Clear all items in a cart in PostgreSQL.
   */
  static async clearCart(cartId: string): Promise<void> {
    if (!cartId) return;

    await dbQuery(`DELETE FROM "cart_line_item" WHERE cart_id = $1`, [cartId]);
    await dbQuery(
      `UPDATE "cart"
       SET subtotal = 0, discount_total = 0, tax_total = 0, total = 0,
           metadata = '{}'::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [cartId]
    );
  }

  static async clearCartItems(cartId: string): Promise<void> {
    return this.clearCart(cartId);
  }
}
