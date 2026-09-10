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
    productId: string,
    variantId?: string
  ): Promise<number> {
    const values: any[] = [branchId, productId];
    let query = `
      SELECT quantity, reserved 
      FROM "branch_inventory" 
      WHERE branch_id = $1 
        AND product_id = $2 
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      query += ` AND variant_id = $3`;
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
        AND product_id = ANY($2)
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
        AND product_id = $3
        AND (quantity - reserved) >= $1
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      updateSql += ` AND variant_id = $4`;
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
        AND product_id = $2 
        AND deleted_at IS NULL
        ${variantId ? "AND variant_id = $3" : ""}
      LIMIT 1
    `;
    const checkValues = variantId ? [branchId, productId, variantId] : [branchId, productId];
    const checkRes = await client.query(checkSql, checkValues);

    if (checkRes.rows.length === 0) {
      throw new Error(`PRODUCT_NOT_SERVICEABLE: Product ${productId} is not stocked at branch ${branchId}`);
    }

    const currentAvailable = Math.max(0, Number(checkRes.rows[0].quantity) - Number(checkRes.rows[0].reserved));
    throw new Error(`INSUFFICIENT_STOCK: Only ${currentAvailable} units available at branch ${branchId} (requested ${quantity})`);
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
        AND product_id = $3
        AND deleted_at IS NULL
    `;

    if (variantId) {
      values.push(variantId);
      restoreSql += ` AND variant_id = $4`;
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
    const finalVariantId = variantId || `variant_def_${productId.slice(-12)}`;
    const id = `binv_${branchId}_${finalVariantId}`.slice(0, 60);

    await dbQuery(
      `
      INSERT INTO "branch_inventory" (id, branch_id, product_id, variant_id, quantity, reserved, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        updated_at = NOW(),
        deleted_at = NULL
    `,
      [id, branchId, productId, finalVariantId, Math.max(0, quantity)]
    );
  }
}
