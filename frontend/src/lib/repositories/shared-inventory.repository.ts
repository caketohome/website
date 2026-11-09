/**
 * Shared Inventory Repository
 * Database-backed PostgreSQL source of truth for central cake & bouquet stock.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";

export interface SharedInventoryRow {
  id: string;
  product_id: string;
  variant_id: string;
  merchandise_type: string;
  title: string;
  quantity: number;
  reserved: number;
  available: number;
  safety_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryReservationRow {
  id: string;
  shared_inventory_id: string;
  order_id: string | null;
  cart_id: string | null;
  entity_type: "BRANCH" | "PARTNER";
  entity_id: string;
  quantity: number;
  status: "RESERVED" | "CONFIRMED" | "FULFILLED" | "RELEASED" | "CANCELLED" | "EXPIRED";
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export class SharedInventoryRepository {
  /**
   * List shared inventory items with current available stock
   */
  static async list(filters: {
    merchandiseType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SharedInventoryRow[]> {
    const limit = Math.min(Math.max(1, filters.limit || 50), 200);
    const offset = Math.max(0, filters.offset || 0);
    const params: any[] = [];
    let sql = `
      SELECT id, product_id, variant_id, merchandise_type, title, quantity, reserved,
             GREATEST(0, quantity - reserved) as available, safety_threshold,
             created_at, updated_at
      FROM "shared_inventory"
      WHERE deleted_at IS NULL
    `;

    if (filters.merchandiseType) {
      params.push(filters.merchandiseType.toUpperCase());
      sql += ` AND merchandise_type = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (title ILIKE $${params.length} OR product_id ILIKE $${params.length})`;
    }

    sql += ` ORDER BY title ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await dbQuery(sql, params);
    return (res.rows || []).map(r => ({
      ...r,
      quantity: Number(r.quantity),
      reserved: Number(r.reserved),
      available: Number(r.available),
      safety_threshold: Number(r.safety_threshold),
    }));
  }

  /**
   * Get stock for specific product & variant
   */
  static async findByProductAndVariant(
    productId: string,
    variantId?: string,
    client?: PoolClient
  ): Promise<SharedInventoryRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    let sql = `
      SELECT id, product_id, variant_id, merchandise_type, title, quantity, reserved,
             GREATEST(0, quantity - reserved) as available, safety_threshold,
             created_at, updated_at
      FROM "shared_inventory"
      WHERE product_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [productId];

    if (variantId) {
      params.push(variantId);
      sql += ` AND variant_id = $2`;
    }

    sql += ` LIMIT 1`;
    const res = await queryFn(sql, params);
    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      quantity: Number(r.quantity),
      reserved: Number(r.reserved),
      available: Number(r.available),
      safety_threshold: Number(r.safety_threshold),
    };
  }

  /**
   * Acquire row lock on shared inventory row for atomic mutation
   */
  static async lockRow(
    client: PoolClient,
    productId: string,
    variantId?: string
  ): Promise<SharedInventoryRow | null> {
    let sql = `
      SELECT id, product_id, variant_id, merchandise_type, title, quantity, reserved,
             GREATEST(0, quantity - reserved) as available, safety_threshold,
             created_at, updated_at
      FROM "shared_inventory"
      WHERE product_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [productId];

    if (variantId) {
      params.push(variantId);
      sql += ` AND variant_id = $2`;
    }

    sql += ` FOR UPDATE LIMIT 1`;
    const res = await client.query(sql, params);
    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      quantity: Number(r.quantity),
      reserved: Number(r.reserved),
      available: Number(r.available),
      safety_threshold: Number(r.safety_threshold),
    };
  }

  /**
   * Create or update reservation
   */
  static async saveReservation(
    client: PoolClient,
    res: {
      id: string;
      shared_inventory_id: string;
      order_id?: string | null;
      cart_id?: string | null;
      entity_type: "BRANCH" | "PARTNER";
      entity_id: string;
      quantity: number;
      status: string;
      expires_at: Date;
      metadata?: any;
    }
  ): Promise<void> {
    await client.query(`
      INSERT INTO "inventory_reservation" (
        id, shared_inventory_id, order_id, cart_id, entity_type, entity_id, quantity, status, expires_at, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `, [
      res.id,
      res.shared_inventory_id,
      res.order_id || null,
      res.cart_id || null,
      res.entity_type,
      res.entity_id,
      res.quantity,
      res.status,
      res.expires_at,
      res.metadata ? JSON.stringify(res.metadata) : null,
    ]);
  }

  /**
   * Find reservation by order or cart ID
   */
  static async findReservationsByRef(
    refId: string,
    client?: PoolClient
  ): Promise<InventoryReservationRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const res = await queryFn(`
      SELECT id, shared_inventory_id, order_id, cart_id, entity_type, entity_id, quantity, status, expires_at, created_at, updated_at
      FROM "inventory_reservation"
      WHERE order_id = $1 OR cart_id = $1 OR id = $1
      ORDER BY created_at ASC
    `, [refId]);

    return (res.rows || []).map(r => ({
      ...r,
      quantity: Number(r.quantity),
    }));
  }

  /**
   * Record auditable stock movement
   */
  static async recordMovement(
    client: PoolClient,
    movement: {
      id: string;
      shared_inventory_id: string;
      movement_type: string;
      quantity_delta: number;
      previous_quantity: number;
      new_quantity: number;
      previous_reserved: number;
      new_reserved: number;
      reference_type: string;
      reference_id?: string | null;
      actor_id: string;
      actor_role: string;
      notes?: string;
    }
  ): Promise<void> {
    await client.query(`
      INSERT INTO "inventory_movement" (
        id, shared_inventory_id, movement_type, quantity, direction,
        previous_quantity, new_quantity, previous_reserved, new_reserved,
        reference_no, actor_role, created_by, narration, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    `, [
      movement.id,
      movement.shared_inventory_id,
      movement.movement_type,
      Math.abs(movement.quantity_delta),
      movement.quantity_delta >= 0 ? "IN" : "OUT",
      movement.previous_quantity,
      movement.new_quantity,
      movement.previous_reserved,
      movement.new_reserved,
      movement.reference_id || null,
      movement.actor_role,
      movement.actor_id,
      movement.notes || `Movement: ${movement.movement_type} (${movement.reference_type})`,
    ]);
  }
}
