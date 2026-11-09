/**
 * Operational Closure Repository
 * PostgreSQL persistence for branch and partner holiday schedules, closures, and order impacts.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";

export interface OperationalClosureRow {
  id: string;
  entity_type: "BRANCH" | "PARTNER" | "ORGANIZATION";
  entity_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  is_full_day: boolean;
  opening_time: string | null;
  closing_time: string | null;
  closure_type: "HOLIDAY" | "MAINTENANCE" | "PLANNED_CLOSURE" | "EMERGENCY";
  reason: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  actor_id: string;
  actor_role: string;
  created_at: string;
  updated_at: string;
}

export interface ClosureImpactRow {
  id: string;
  closure_id: string;
  order_id: string;
  order_delivery_date: string;
  impact_status: "PENDING_REVIEW" | "REASSIGNED" | "RESCHEDULED" | "CANCELLED_WITH_REFUND" | "OVERRIDDEN_FOR_FULFILLMENT";
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export class OperationalClosureRepository {
  /**
   * List closures with optional entity or date range filter
   */
  static async list(filters: {
    entityType?: string;
    entityId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  } = {}): Promise<OperationalClosureRow[]> {
    const params: any[] = [];
    let sql = `
      SELECT id, entity_type, entity_id, start_date::text, end_date::text, is_full_day,
             opening_time, closing_time, closure_type, reason, status, actor_id, actor_role,
             created_at, updated_at
      FROM "operational_closure"
      WHERE deleted_at IS NULL
    `;

    if (filters.entityType) {
      params.push(filters.entityType.toUpperCase());
      sql += ` AND entity_type = $${params.length}`;
    }
    if (filters.entityId) {
      params.push(filters.entityId);
      sql += ` AND entity_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND status = $${params.length}`;
    }
    if (filters.fromDate) {
      params.push(filters.fromDate);
      sql += ` AND end_date >= $${params.length}::date`;
    }
    if (filters.toDate) {
      params.push(filters.toDate);
      sql += ` AND start_date <= $${params.length}::date`;
    }

    sql += ` ORDER BY start_date ASC LIMIT $${params.length + 1}`;
    params.push(Math.min(filters.limit || 100, 200));

    try {
      const res = await dbQuery(sql, params);
      return res.rows || [];
    } catch (e: any) {
      if (e?.code === "42P01" || e?.message?.includes("does not exist")) {
        console.warn("[OperationalClosureRepository.list] operational_closure table not found, defaulting to empty list");
        return [];
      }
      throw e;
    }
  }

  /**
   * Find closure by ID
   */
  static async findById(id: string): Promise<OperationalClosureRow | null> {
    try {
      const res = await dbQuery(`
        SELECT id, entity_type, entity_id, start_date::text, end_date::text, is_full_day,
               opening_time, closing_time, closure_type, reason, status, actor_id, actor_role,
               created_at, updated_at
        FROM "operational_closure"
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1;
      `, [id]);

      return res.rows && res.rows.length > 0 ? res.rows[0] : null;
    } catch (e: any) {
      if (e?.code === "42P01" || e?.message?.includes("does not exist")) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Check if an entity is closed on a specific date (YYYY-MM-DD)
   */
  static async isClosedOnDate(
    entityType: "BRANCH" | "PARTNER",
    entityId: string,
    targetDateStr: string,
    targetTime?: string
  ): Promise<{ isClosed: boolean; reason?: string; closure?: OperationalClosureRow }> {
    try {
      // Check both entity-specific closures and organization-wide closures
      const res = await dbQuery(`
        SELECT id, entity_type, entity_id, start_date::text, end_date::text, is_full_day,
               opening_time, closing_time, closure_type, reason, status, actor_id, actor_role,
               created_at, updated_at
        FROM "operational_closure"
        WHERE ((entity_type = $1 AND entity_id = $2) OR (entity_type = 'ORGANIZATION'))
          AND start_date <= $3::date
          AND end_date >= $3::date
          AND status IN ('SCHEDULED', 'ACTIVE')
          AND deleted_at IS NULL
        ORDER BY entity_type ASC LIMIT 1;
      `, [entityType, entityId, targetDateStr]);

      if (!res.rows || res.rows.length === 0) {
        return { isClosed: false };
      }

      const closure: OperationalClosureRow = res.rows[0];
      if (closure.is_full_day) {
        return { isClosed: true, reason: closure.reason, closure };
      }

      // Partial closure: if target time is outside operating window or inside closed window
      if (targetTime && closure.opening_time && closure.closing_time) {
        if (targetTime < closure.opening_time || targetTime > closure.closing_time) {
          return { isClosed: true, reason: `Partial Day Closure: Operating between ${closure.opening_time} and ${closure.closing_time}`, closure };
        }
      }

      return { isClosed: false, closure };
    } catch (e: any) {
      if (e?.code === "42P01" || e?.message?.includes("does not exist")) {
        console.warn("[OperationalClosureRepository.isClosedOnDate] operational_closure table not found, defaulting to open");
        return { isClosed: false };
      }
      throw e;
    }
  }

  /**
   * Save new or updated closure
   */
  static async saveClosure(closure: {
    id: string;
    entity_type: "BRANCH" | "PARTNER" | "ORGANIZATION";
    entity_id: string;
    start_date: string;
    end_date: string;
    is_full_day: boolean;
    opening_time?: string | null;
    closing_time?: string | null;
    closure_type: string;
    reason: string;
    status: string;
    actor_id: string;
    actor_role: string;
  }, client?: PoolClient): Promise<OperationalClosureRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const res = await queryFn(`
      INSERT INTO "operational_closure" (
        id, entity_type, entity_id, start_date, end_date, is_full_day,
        opening_time, closing_time, closure_type, reason, status, actor_id, actor_role, created_at, updated_at
      ) VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        is_full_day = EXCLUDED.is_full_day,
        opening_time = EXCLUDED.opening_time,
        closing_time = EXCLUDED.closing_time,
        closure_type = EXCLUDED.closure_type,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, entity_type, entity_id, start_date::text, end_date::text, is_full_day,
                opening_time, closing_time, closure_type, reason, status, actor_id, actor_role,
                created_at, updated_at;
    `, [
      closure.id,
      closure.entity_type,
      closure.entity_id,
      closure.start_date,
      closure.end_date,
      closure.is_full_day,
      closure.opening_time || null,
      closure.closing_time || null,
      closure.closure_type,
      closure.reason,
      closure.status,
      closure.actor_id,
      closure.actor_role,
    ]);

    return res.rows[0];
  }

  /**
   * Soft-delete or cancel closure
   */
  static async cancelClosure(id: string, actorId: string, actorRole: string): Promise<boolean> {
    const res = await dbQuery(`
      UPDATE "operational_closure"
      SET status = 'CANCELLED', deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
    `, [id]);

    return (res.rows || []).length > 0;
  }

  /**
   * Find existing orders that overlap with a closure window
   */
  static async findOverlappingOrders(
    entityType: "BRANCH" | "PARTNER",
    entityId: string,
    startDateStr: string,
    endDateStr: string,
    client?: PoolClient
  ): Promise<any[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    let sql = `
      SELECT id, display_id, status, metadata->>'delivery_date' as delivery_date, metadata
      FROM "order"
      WHERE deleted_at IS NULL
        AND status IN ('pending', 'confirmed', 'processing', 'preparing')
        AND (metadata->>'delivery_date')::date >= $1::date
        AND (metadata->>'delivery_date')::date <= $2::date
    `;
    const params: any[] = [startDateStr, endDateStr];

    if (entityType === "BRANCH") {
      params.push(entityId);
      sql += ` AND (branch_id = $3 OR metadata->>'branch_id' = $3)`;
    } else {
      params.push(entityId);
      sql += ` AND (metadata->>'partner_id' = $3 OR metadata->'delivery'->>'partner_id' = $3)`;
    }

    const res = await queryFn(sql, params);
    return res.rows || [];
  }

  /**
   * Save impacted orders for operational review
   */
  static async recordImpactedOrders(
    closureId: string,
    orders: Array<{ order_id: string; delivery_date: string }>,
    client?: PoolClient
  ): Promise<number> {
    if (!orders || orders.length === 0) return 0;
    const queryFn = client ? client.query.bind(client) : dbQuery;

    let recorded = 0;
    for (const o of orders) {
      const id = `imp_${closureId.slice(-12)}_${o.order_id.slice(-12)}`;
      await queryFn(`
        INSERT INTO "operational_closure_impact" (
          id, closure_id, order_id, order_delivery_date, impact_status, created_at
        ) VALUES ($1, $2, $3, $4::date, 'PENDING_REVIEW', NOW())
        ON CONFLICT (closure_id, order_id) DO NOTHING;
      `, [id, closureId, o.order_id, o.delivery_date]);
      recorded++;
    }
    return recorded;
  }

  /**
   * List closure impacts
   */
  static async listImpacts(filters: { closureId?: string; status?: string } = {}): Promise<ClosureImpactRow[]> {
    const params: any[] = [];
    let sql = `
      SELECT id, closure_id, order_id, order_delivery_date::text, impact_status, resolution_note, resolved_by, resolved_at, created_at
      FROM "operational_closure_impact"
      WHERE 1=1
    `;
    if (filters.closureId) {
      params.push(filters.closureId);
      sql += ` AND closure_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND impact_status = $${params.length}`;
    }
    sql += ` ORDER BY order_delivery_date ASC;`;

    const res = await dbQuery(sql, params);
    return res.rows || [];
  }
}
