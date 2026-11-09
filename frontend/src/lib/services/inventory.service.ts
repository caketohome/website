import { CrossAppEventService } from "./cross-app-event.service";
import { dbQuery, dbTransaction } from "../db";

export interface InventoryItem {
  id: string;
  branch_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  reserved: number;
  available: number;
}

export class InventoryService {
  /**
   * Get real-time available stock for a product/variant at a specific branch directly from PostgreSQL
   */
  static async getAvailableStock(
    branchId: string,
    productId?: string,
    variantId?: string
  ): Promise<number> {
    if (!branchId || (!productId && !variantId)) return 0;
    const values: any[] = [branchId];
    let query = `
      SELECT quantity, reserved 
      FROM "branch_inventory" 
      WHERE branch_id = $1 
        AND deleted_at IS NULL
    `;

    if (productId && variantId && productId !== variantId) {
      values.push(productId, variantId);
      query += ` AND ((product_id = $2 AND variant_id = $3) OR (product_id = $3 AND variant_id = $2) OR product_id = $2 OR variant_id = $3)`;
    } else {
      const id = productId || variantId;
      values.push(id);
      query += ` AND (product_id = $2 OR variant_id = $2)`;
    }

    query += ` LIMIT 1`;

    const res = await dbQuery(query, values);
    if (!res.rows || res.rows.length === 0) {
      return 0;
    }

    const row = res.rows[0];
    return Math.max(0, Number(row.quantity || 0) - Number(row.reserved || 0));
  }

  /**
   * Get real-time available stock for multiple products at a specific branch in a single database query.
   * Prevents N+1 query overhead.
   */
  static async getBatchStock(
    branchId: string,
    productIds: string[]
  ): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>();
    if (!branchId || !productIds || productIds.length === 0) {
      return stockMap;
    }
    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
    if (uniqueIds.length === 0) return stockMap;

    const res = await dbQuery(
      `
      SELECT product_id, SUM(quantity - reserved)::int as available
      FROM "branch_inventory"
      WHERE branch_id = $1 
        AND (product_id = ANY($2) OR variant_id = ANY($2))
        AND deleted_at IS NULL
      GROUP BY product_id
      `,
      [branchId, uniqueIds]
    );

    for (const row of res.rows || []) {
      stockMap.set(row.product_id, Math.max(0, Number(row.available || 0)));
    }
    return stockMap;
  }

  /**
   * Atomic conditional stock deduction within a transaction.
   * Uses conditional UPDATE WHERE (quantity - reserved) >= quantity to prevent race conditions.
   * If zero rows are returned, it verifies whether product exists and throws INSUFFICIENT_STOCK.
   */
  static async deductStockAtomic(
    client: any,
    branchId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<InventoryItem> {
    if (quantity <= 0) {
      throw new Error("Quantity to deduct must be greater than 0");
    }

    const values: any[] = [quantity, branchId, productId];
    let updateSql = `
      UPDATE "branch_inventory"
      SET quantity = quantity - $1,
          updated_at = NOW()
      WHERE branch_id = $2
        AND (product_id = $3 OR variant_id = $3)
        AND (quantity - reserved) >= $1
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      updateSql += ` AND (variant_id = $4 OR product_id = $4)`;
    }

    updateSql += ` RETURNING id, branch_id, product_id, variant_id, quantity, reserved`;

    const res = await client.query(updateSql, values);

    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        branch_id: row.branch_id,
        product_id: row.product_id,
        variant_id: row.variant_id,
        quantity: Number(row.quantity),
        reserved: Number(row.reserved),
        available: Math.max(0, Number(row.quantity) - Number(row.reserved)),
      };
    }

    // Zero rows updated: Determine exact reason
    const checkSql = `
      SELECT quantity, reserved 
      FROM "branch_inventory" 
      WHERE branch_id = $1 
        AND (product_id = $2 OR variant_id = $2)
        AND deleted_at IS NULL
        ${variantId ? "AND (variant_id = $3 OR product_id = $3)" : ""}
      LIMIT 1
    `;
    const checkValues = variantId ? [branchId, productId, variantId] : [branchId, productId];
    const checkRes = await client.query(checkSql, checkValues);

    if (checkRes.rows.length === 0) {
      throw new Error(`INSUFFICIENT_STOCK: Product ${productId} has no physical stock recorded at branch ${branchId}`);
    }

    const currentAvailable = Math.max(0, Number(checkRes.rows[0].quantity) - Number(checkRes.rows[0].reserved));
    throw new Error(`INSUFFICIENT_STOCK: Only ${currentAvailable} units available at branch ${branchId} (requested ${quantity})`);
  }

  /**
   * Atomic stock reservation within a transaction
   */
  static async reserveStock(
    client: any,
    branchId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<InventoryItem> {
    if (quantity <= 0) {
      throw new Error("Quantity to reserve must be greater than 0");
    }

    const values: any[] = [quantity, branchId, productId];
    let updateSql = `
      UPDATE "branch_inventory"
      SET reserved = reserved + $1,
          updated_at = NOW()
      WHERE branch_id = $2
        AND (product_id = $3 OR variant_id = $3)
        AND (quantity - reserved) >= $1
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      updateSql += ` AND (variant_id = $4 OR product_id = $4)`;
    }

    updateSql += ` RETURNING id, branch_id, product_id, variant_id, quantity, reserved`;

    const res = await client.query(updateSql, values);
    if (!res.rows || res.rows.length === 0) {
      throw new Error(`INSUFFICIENT_STOCK: Cannot reserve ${quantity} units for product ${productId} at branch ${branchId}`);
    }

    const row = res.rows[0];
    return {
      id: row.id,
      branch_id: row.branch_id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      quantity: Number(row.quantity),
      reserved: Number(row.reserved),
      available: Math.max(0, Number(row.quantity) - Number(row.reserved)),
    };
  }

  /**
   * Release reserved stock
   */
  static async releaseReservation(
    client: any,
    branchId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<void> {
    if (quantity <= 0) return;

    const values: any[] = [quantity, branchId, productId];
    let updateSql = `
      UPDATE "branch_inventory"
      SET reserved = GREATEST(0, reserved - $1),
          updated_at = NOW()
      WHERE branch_id = $2
        AND (product_id = $3 OR variant_id = $3)
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      updateSql += ` AND (variant_id = $4 OR product_id = $4)`;
    }

    await client.query(updateSql, values);
  }

  /**
   * Restore stock on order cancellation or transaction compensation
   */
  static async restoreStock(
    client: any,
    branchId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<void> {
    if (quantity <= 0) return;

    const values: any[] = [quantity, branchId, productId];
    let restoreSql = `
      UPDATE "branch_inventory"
      SET quantity = quantity + $1,
          updated_at = NOW()
      WHERE branch_id = $2
        AND (product_id = $3 OR variant_id = $3)
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      restoreSql += ` AND (variant_id = $4 OR product_id = $4)`;
    }

    await client.query(restoreSql, values);
  }

  /**
   * Set physical stock count for a branch & product directly in PostgreSQL (Admin operation)
   */
  static async setStock(
    branchId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<void> {
    let finalVariantId = variantId;
    if (!finalVariantId) {
      const vRes = await dbQuery(
        `SELECT variant_id FROM "branch_inventory" WHERE branch_id = $1 AND (product_id = $2 OR variant_id = $2) AND deleted_at IS NULL LIMIT 1`,
        [branchId, productId]
      );
      if (vRes.rows && vRes.rows[0]?.variant_id) {
        finalVariantId = vRes.rows[0].variant_id;
      } else {
        const pvRes = await dbQuery(
          `SELECT id FROM "product_variant" WHERE product_id = $1 OR id = $1 LIMIT 1`,
          [productId]
        );
        finalVariantId = pvRes.rows?.[0]?.id || `var_${productId}`;
      }
    }

    const id = `binv_${branchId}_${finalVariantId}`.slice(0, 60);

    await dbTransaction(async (client) => {
      const prevRes = await client.query(
        `SELECT quantity FROM "branch_inventory" WHERE id = $1 LIMIT 1`,
        [id]
      );
      const prevQty = Number(prevRes.rows[0]?.quantity || 0);
      const newQty = Math.max(0, quantity);
      const delta = newQty - prevQty;

      await client.query(
        `
        INSERT INTO "branch_inventory" (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          updated_at = NOW(),
          deleted_at = NULL
      `,
        [id, branchId, productId, finalVariantId, newQty]
      );

      if (delta !== 0) {
        const mvId = `inv_adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await client.query(
          `INSERT INTO public.inventory_movement (
            id, branch_id, product_id, movement_type, direction, quantity, notes, created_by, created_at
          ) VALUES ($1, $2, $3, 'ADJUSTMENT', $4, $5, $6, 'admin_01', NOW())`,
          [
            mvId,
            branchId,
            productId,
            delta > 0 ? "IN" : "OUT",
            Math.abs(delta),
            `Stock updated from ${prevQty} to ${newQty}`,
          ]
        );
      }

      await CrossAppEventService.publishInTransaction(client, {
        event_type: "inventory.updated",
        aggregate_type: "INVENTORY",
        aggregate_id: `${branchId}:${productId}`,
        branch_id: branchId,
        payload: {
          branch_id: branchId,
          product_id: productId,
          variant_id: finalVariantId,
          previous_quantity: prevQty,
          new_quantity: newQty,
          delta,
        },
      });
    });
    CrossAppEventService.processPendingOutboxEvents().catch(() => {});
  }

  /**
   * Inter-branch stock transfer
   */
  static async transferStock(
    fromBranchId: string,
    toBranchId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<void> {
    if (quantity <= 0) throw new Error("Transfer quantity must be greater than 0");
    if (fromBranchId === toBranchId) throw new Error("Cannot transfer to the same branch");

    await dbTransaction(async (client) => {
      // Deduct from source
      await InventoryService.deductStockAtomic(client, fromBranchId, productId, quantity, variantId);

      // Add to destination
      let finalVariantId = variantId;
      if (!finalVariantId) {
        const pvRes = await client.query(
          `SELECT id FROM "product_variant" WHERE product_id = $1 OR id = $1 LIMIT 1`,
          [productId]
        );
        finalVariantId = pvRes.rows?.[0]?.id || `var_${productId}`;
      }
      const destId = `binv_${toBranchId}_${finalVariantId}`.slice(0, 60);
      await client.query(
        `
        INSERT INTO "branch_inventory" (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          quantity = branch_inventory.quantity + EXCLUDED.quantity,
          updated_at = NOW(),
          deleted_at = NULL
      `,
        [destId, toBranchId, productId, finalVariantId, quantity]
      );
    });
  }

  /**
   * Retrieve all physical accessory items for a specific branch from PostgreSQL
   */
  static async getBranchInventoryItems(branchId: string): Promise<any[]> {
    const res = await dbQuery(
      `
      SELECT 
        p.id,
        pv.id as variant_id,
        pv.sku,
        p.title as name,
        p.metadata->>'category' as category_name,
        COALESCE((p.metadata->>'selling_price')::numeric, (p.metadata->>'price')::numeric, 0) as price,
        COALESCE((p.metadata->>'cost_price')::numeric, 0) as cost_price,
        COALESCE(bi.quantity, 0) as stock,
        COALESCE(bi.reserved, 0) as reserved,
        COALESCE(bi.quantity - bi.reserved, 0) as available_stock,
        COALESCE((p.metadata->>'low_stock_threshold')::int, 5) as low_stock_threshold,
        COALESCE(p.metadata->>'thumbnail', p.metadata->>'image', '/images/placeholder-cake.jpg') as thumbnail
      FROM product p
      LEFT JOIN product_variant pv ON pv.product_id = p.id
      LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = $1 AND bi.deleted_at IS NULL
      WHERE (p.metadata->'pim_config'->>'inventory_mode' = 'STOCK_CONTROLLED' OR p.metadata->>'category_slug' = 'accessories')
        AND p.deleted_at IS NULL
      ORDER BY p.id ASC
    `,
      [branchId]
    );

    return (res.rows || []).map((row: any) => {
      const stock = Number(row.stock || 0);
      const reserved = Number(row.reserved || 0);
      const available = Number(row.available_stock || 0);
      const lowThreshold = Number(row.low_stock_threshold || 5);
      const isLowStock = available <= lowThreshold;
      return {
        id: row.id,
        variant_id: row.variant_id || `var_${row.id}`,
        sku: row.sku,
        name: row.name,
        title: row.name,
        category_name: row.category_name || "Accessories",
        price: Number(row.price || 0),
        cost_price: Number(row.cost_price || 0),
        stock,
        reserved,
        available_stock: available,
        low_stock_threshold: lowThreshold,
        is_low_stock: isLowStock,
        status: available === 0 ? "OUT_OF_STOCK" : (isLowStock ? "LOW_STOCK" : "IN_STOCK"),
        thumbnail: row.thumbnail,
      };
    });
  }
}
