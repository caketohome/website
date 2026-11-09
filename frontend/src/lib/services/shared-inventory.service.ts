/**
 * Shared Inventory Domain Service
 * High-concurrency, PostgreSQL-transactional stock management for cakes & bouquets.
 * Enforces:
 * 1. Zero overselling via SELECT FOR UPDATE row-level locks
 * 2. Complete stock lifecycle: available -> reserved -> confirmed -> fulfilled / released
 * 3. Immutable audit movement logs
 * 4. Idempotent release and cancellation
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { SharedInventoryRepository, SharedInventoryRow, InventoryReservationRow } from "../repositories/shared-inventory.repository";

export interface ReserveStockInput {
  productId: string;
  variantId?: string;
  quantity: number;
  entityType: "BRANCH" | "PARTNER";
  entityId: string;
  orderId?: string;
  cartId?: string;
  ttlMinutes?: number;
  actorId: string;
  actorRole: string;
}

export interface AdjustStockInput {
  productId: string;
  variantId: string;
  quantityDelta: number;
  reason: string;
  actorId: string;
  actorRole: string;
}

export class SharedInventoryService {
  /**
   * Check real-time available stock
   */
  static async getAvailableStock(productId: string, variantId?: string): Promise<number> {
    const row = await SharedInventoryRepository.findByProductAndVariant(productId, variantId);
    if (!row) return 0;
    return Math.max(0, row.quantity - row.reserved);
  }

  /**
   * List shared inventory
   */
  static async listSharedInventory(filters: any = {}): Promise<SharedInventoryRow[]> {
    return SharedInventoryRepository.list(filters);
  }

  /**
   * Atomically reserve stock for cart or pending order
   */
  static async reserveStock(input: ReserveStockInput, externalClient?: PoolClient): Promise<{
    success: boolean;
    reservationId?: string;
    available?: number;
    error?: string;
  }> {
    if (input.quantity <= 0) {
      return { success: false, error: "Quantity must be positive" };
    }

    const runWithClient = async (client: PoolClient) => {
      // 1. Lock row
      const row = await SharedInventoryRepository.lockRow(client, input.productId, input.variantId);
      if (!row) {
        return { success: false, error: `Product not found in shared inventory: ${input.productId}` };
      }

      const available = Math.max(0, row.quantity - row.reserved);
      if (available < input.quantity) {
        return {
          success: false,
          error: `INSUFFICIENT_STOCK: Only ${available} available, requested ${input.quantity}`,
          available,
        };
      }

      // 2. Increment reserved
      const newReserved = row.reserved + input.quantity;
      await client.query(`
        UPDATE "shared_inventory"
        SET reserved = $1, updated_at = NOW()
        WHERE id = $2;
      `, [newReserved, row.id]);

      // 3. Create reservation
      const ttl = input.ttlMinutes || 15;
      const expiresAt = new Date(Date.now() + ttl * 60 * 1000);
      const resId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await SharedInventoryRepository.saveReservation(client, {
        id: resId,
        shared_inventory_id: row.id,
        order_id: input.orderId,
        cart_id: input.cartId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        quantity: input.quantity,
        status: "RESERVED",
        expires_at: expiresAt,
      });

      // 4. Record audit movement
      const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await SharedInventoryRepository.recordMovement(client, {
        id: movId,
        shared_inventory_id: row.id,
        movement_type: "RESERVATION_HOLD",
        quantity_delta: input.quantity,
        previous_quantity: row.quantity,
        new_quantity: row.quantity,
        previous_reserved: row.reserved,
        new_reserved: newReserved,
        reference_type: input.orderId ? "ORDER" : "CART",
        reference_id: input.orderId || input.cartId,
        actor_id: input.actorId,
        actor_role: input.actorRole,
        notes: `Reserved ${input.quantity} for ${input.entityType} '${input.entityId}'`,
      });

      return {
        success: true,
        reservationId: resId,
        available: row.quantity - newReserved,
      };
    };

    if (externalClient) {
      return runWithClient(externalClient);
    } else {
      return dbTransaction(runWithClient);
    }
  }

  /**
   * Confirm reservation on successful checkout: Deducts from both quantity and reserved
   */
  static async confirmOrderReservation(
    orderId: string,
    actorId: string = "system",
    actorRole: string = "CHECKOUT",
    externalClient?: PoolClient
  ): Promise<{ success: boolean; error?: string }> {
    const runWithClient = async (client: PoolClient) => {
      const reservations = await SharedInventoryRepository.findReservationsByRef(orderId, client);
      const activeRes = reservations.filter(r => r.status === "RESERVED");

      for (const res of activeRes) {
        // Lock inventory row
        const rowRes = await client.query(`
          SELECT * FROM "shared_inventory" WHERE id = $1 FOR UPDATE;
        `, [res.shared_inventory_id]);

        if (rowRes.rows.length === 0) continue;
        const row = rowRes.rows[0];

        const newQty = Math.max(0, row.quantity - res.quantity);
        const newReserved = Math.max(0, row.reserved - res.quantity);

        await client.query(`
          UPDATE "shared_inventory"
          SET quantity = $1, reserved = $2, updated_at = NOW()
          WHERE id = $3;
        `, [newQty, newReserved, row.id]);

        // Update reservation status
        await client.query(`
          UPDATE "inventory_reservation"
          SET status = 'CONFIRMED', updated_at = NOW()
          WHERE id = $1;
        `, [res.id]);

        // Record confirm audit movement
        const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await SharedInventoryRepository.recordMovement(client, {
          id: movId,
          shared_inventory_id: row.id,
          movement_type: "CONFIRM_DEDUCT",
          quantity_delta: -res.quantity,
          previous_quantity: row.quantity,
          new_quantity: newQty,
          previous_reserved: row.reserved,
          new_reserved: newReserved,
          reference_type: "ORDER",
          reference_id: orderId,
          actor_id: actorId,
          actor_role: actorRole,
          notes: `Order ${orderId} confirmed: deducted ${res.quantity} units`,
        });
      }

      return { success: true };
    };

    if (externalClient) {
      return runWithClient(externalClient);
    } else {
      return dbTransaction(runWithClient);
    }
  }

  /**
   * Release reservation on cancellation, rejection, or payment failure (Idempotent)
   */
  static async releaseReservation(
    refId: string,
    reason: string = "Cancelled or expired",
    actorId: string = "system",
    actorRole: string = "OPERATIONS",
    externalClient?: PoolClient
  ): Promise<{ success: boolean; countReleased: number }> {
    const runWithClient = async (client: PoolClient) => {
      const reservations = await SharedInventoryRepository.findReservationsByRef(refId, client);
      let count = 0;

      for (const res of reservations) {
        if (res.status === "RELEASED" || res.status === "CANCELLED") {
          continue; // Already released (idempotency)
        }

        const rowRes = await client.query(`
          SELECT * FROM "shared_inventory" WHERE id = $1 FOR UPDATE;
        `, [res.shared_inventory_id]);

        if (rowRes.rows.length === 0) continue;
        const row = rowRes.rows[0];

        let newQty = row.quantity;
        let newReserved = row.reserved;
        let newStatus = "RELEASED";

        if (res.status === "RESERVED") {
          // Release pending hold
          newReserved = Math.max(0, row.reserved - res.quantity);
        } else if (res.status === "CONFIRMED") {
          // Restore deducted quantity on cancellation
          newQty = row.quantity + res.quantity;
          newStatus = "CANCELLED";
        }

        await client.query(`
          UPDATE "shared_inventory"
          SET quantity = $1, reserved = $2, updated_at = NOW()
          WHERE id = $3;
        `, [newQty, newReserved, row.id]);

        await client.query(`
          UPDATE "inventory_reservation"
          SET status = $1, updated_at = NOW()
          WHERE id = $2;
        `, [newStatus, res.id]);

        // Record movement
        const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await SharedInventoryRepository.recordMovement(client, {
          id: movId,
          shared_inventory_id: row.id,
          movement_type: "RELEASE_RESTORE",
          quantity_delta: res.status === "CONFIRMED" ? res.quantity : 0,
          previous_quantity: row.quantity,
          new_quantity: newQty,
          previous_reserved: row.reserved,
          new_reserved: newReserved,
          reference_type: res.order_id ? "ORDER" : "CART",
          reference_id: refId,
          actor_id: actorId,
          actor_role: actorRole,
          notes: `Released reservation ${res.id} (${reason})`,
        });

        count++;
      }

      return { success: true, countReleased: count };
    };

    if (externalClient) {
      return runWithClient(externalClient);
    } else {
      return dbTransaction(runWithClient);
    }
  }

  /**
   * Adjust shared inventory stock level with full audit trail
   */
  static async adjustStock(input: AdjustStockInput): Promise<{
    success: boolean;
    item?: SharedInventoryRow;
    error?: string;
  }> {
    return dbTransaction(async (client) => {
      const row = await SharedInventoryRepository.lockRow(client, input.productId, input.variantId);
      if (!row) {
        return { success: false, error: "Product/variant not found in shared inventory" };
      }

      const newQty = row.quantity + input.quantityDelta;
      if (newQty < 0) {
        return { success: false, error: `Stock cannot be negative (current: ${row.quantity}, delta: ${input.quantityDelta})` };
      }
      if (newQty < row.reserved) {
        return { success: false, error: `Quantity cannot drop below active reserved count of ${row.reserved}` };
      }

      await client.query(`
        UPDATE "shared_inventory"
        SET quantity = $1, updated_at = NOW()
        WHERE id = $2;
      `, [newQty, row.id]);

      const movId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await SharedInventoryRepository.recordMovement(client, {
        id: movId,
        shared_inventory_id: row.id,
        movement_type: "ADJUSTMENT",
        quantity_delta: input.quantityDelta,
        previous_quantity: row.quantity,
        new_quantity: newQty,
        previous_reserved: row.reserved,
        new_reserved: row.reserved,
        reference_type: "MANUAL_ADJUSTMENT",
        reference_id: null,
        actor_id: input.actorId,
        actor_role: input.actorRole,
        notes: input.reason || "Manual inventory adjustment",
      });

      const updated = await SharedInventoryRepository.findByProductAndVariant(input.productId, input.variantId, client);
      return { success: true, item: updated || undefined };
    });
  }
}
