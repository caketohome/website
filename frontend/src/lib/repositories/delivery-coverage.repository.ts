/**
 * CakeToHome ERP — Delivery Coverage & Partner Geofence Repository
 * Phase C7.10: Map-Fenced Store & Delivery-Partner Coverage Configuration
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. TRANSACTION CONTEXT: All methods optionally accept an active PoolClient.
 * 2. PARAMETERIZED QUERIES: 100% of SQL statements strictly use $1, $2 placeholders.
 * 3. IMMUTABILITY AUDIT TRAIL: delivery_coverage_event is append-only.
 * 4. ISOLATION: Preserves historical records; does not delete historical branches or zones.
 */

import { dbQuery } from "../db";
import crypto from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  DeliveryPartnerProfileRow,
  DeliveryPartnerCoverageRow,
  DeliveryCoverageEventRow,
  StoreCoverageSummaryDTO,
  DeliveryZoneExtendedDTO,
  DeliveryPartnerProfileDTO,
  DeliveryPartnerCoverageDTO,
  SetBranchEligibilityInput,
  UpsertStoreZoneInput,
  UpsertPartnerProfileInput,
  UpsertPartnerCoverageInput,
} from "../types/delivery-coverage.types";

export class DeliveryCoverageRepository {
  /**
   * Helper to execute queries on client or default pool
   */
  private static async query<R extends QueryResultRow = any>(sql: string, params: any[] = [], client?: PoolClient): Promise<R[]> {
    if (client) {
      const res = await client.query(sql, params);
      return res.rows as R[];
    }
    const res = await dbQuery<R>(sql, params);
    return res.rows;
  }

  // ── Store & Eligibility Operations ──────────────────────────────────────────

  /**
   * Lists all non-deleted stores with coverage summary metrics
   */
  static async listStoresSummary(client?: PoolClient): Promise<StoreCoverageSummaryDTO[]> {
    const sql = `
      SELECT 
        b.id,
        b.name,
        b.code,
        b.is_open,
        COALESCE(b.is_corporate_routing_eligible, false) as is_corporate_routing_eligible,
        b.latitude,
        b.longitude,
        c.name as city_name,
        COUNT(DISTINCT dz.id) FILTER (WHERE dz.deleted_at IS NULL) as zones_count,
        COUNT(DISTINCT dz.id) FILTER (WHERE dz.deleted_at IS NULL AND dz.polygon_coordinates IS NOT NULL AND jsonb_array_length(dz.polygon_coordinates) >= 3) as polygon_zones_count,
        COUNT(DISTINCT dz.id) FILTER (WHERE dz.deleted_at IS NULL AND dz.radius_km IS NOT NULL) as radius_zones_count,
        BOOL_OR(dz.exclusion_polygons IS NOT NULL AND jsonb_array_length(dz.exclusion_polygons) > 0) as has_exclusions,
        COUNT(DISTINCT dpc.partner_id) FILTER (WHERE dpc.is_active = true) as active_partners_count
      FROM public.branch b
      LEFT JOIN public.city c ON b.city_id = c.id
      LEFT JOIN public.delivery_zone dz ON b.id = dz.branch_id
      LEFT JOIN public.delivery_partner_coverage dpc ON b.id = dpc.branch_id
      WHERE b.deleted_at IS NULL
      GROUP BY b.id, b.name, b.code, b.is_open, b.is_corporate_routing_eligible, b.latitude, b.longitude, c.name
      ORDER BY b.is_corporate_routing_eligible DESC, b.name ASC;
    `;
    const rows = await this.query(sql, [], client);
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      is_open: Boolean(r.is_open),
      is_corporate_routing_eligible: Boolean(r.is_corporate_routing_eligible),
      city_name: r.city_name || null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      zones_count: parseInt(r.zones_count || "0", 10),
      polygon_zones_count: parseInt(r.polygon_zones_count || "0", 10),
      radius_zones_count: parseInt(r.radius_zones_count || "0", 10),
      has_exclusions: Boolean(r.has_exclusions),
      active_partners_count: parseInt(r.active_partners_count || "0", 10),
    }));
  }

  /**
   * Sets store corporate routing eligibility with transactional audit event
   */
  static async setBranchEligibility(
    input: SetBranchEligibilityInput,
    client?: PoolClient
  ): Promise<{ branch_id: string; is_corporate_routing_eligible: boolean }> {
    const existing = await this.query(
      `SELECT id, is_corporate_routing_eligible, name, code FROM public.branch WHERE id = $1 AND deleted_at IS NULL;`,
      [input.branch_id],
      client
    );
    if (existing.length === 0) {
      throw new Error(`Store with ID "${input.branch_id}" was not found.`);
    }

    const beforeState = { is_corporate_routing_eligible: existing[0].is_corporate_routing_eligible };
    const afterState = { is_corporate_routing_eligible: input.is_eligible };

    const updateSql = `
      UPDATE public.branch
      SET is_corporate_routing_eligible = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, is_corporate_routing_eligible;
    `;
    const updated = await this.query(updateSql, [input.is_eligible, input.branch_id], client);

    // Record Immutable Audit Event
    await this.recordCoverageEvent(
      {
        entity_type: "STORE_ELIGIBILITY",
        entity_id: input.branch_id,
        event_type: "ELIGIBILITY_TOGGLED",
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        reason: input.reason || `Updated eligibility to ${input.is_eligible}`,
        before_state: beforeState,
        after_state: afterState,
      },
      client
    );

    return {
      branch_id: updated[0].id,
      is_corporate_routing_eligible: Boolean(updated[0].is_corporate_routing_eligible),
    };
  }

  // ── Delivery Zones Operations ───────────────────────────────────────────────

  /**
   * Gets all delivery zones for a given branch
   */
  static async getBranchZones(branchId: string, client?: PoolClient): Promise<DeliveryZoneExtendedDTO[]> {
    const sql = `
      SELECT 
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km,
        center_latitude, center_longitude, priority,
        estimated_delivery_minutes, created_at, updated_at
      FROM public.delivery_zone
      WHERE branch_id = $1 AND deleted_at IS NULL
      ORDER BY priority DESC, created_at ASC;
    `;
    const rows = await this.query(sql, [branchId], client);
    return rows.map((r: any) => ({
      id: r.id,
      branch_id: r.branch_id,
      name: r.name || null,
      pincode: r.pincode,
      delivery_fee: Number(r.delivery_fee || 0),
      is_serviceable: Boolean(r.is_serviceable),
      polygon_coordinates: r.polygon_coordinates || null,
      exclusion_polygons: r.exclusion_polygons || null,
      radius_km: r.radius_km !== null ? Number(r.radius_km) : null,
      center_latitude: r.center_latitude !== null ? Number(r.center_latitude) : null,
      center_longitude: r.center_longitude !== null ? Number(r.center_longitude) : null,
      priority: parseInt(r.priority || "10", 10),
      estimated_delivery_minutes: parseInt(r.estimated_delivery_minutes || "35", 10),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  }

  /**
   * Upserts store delivery zone with polygon and exclusion JSONB
   */
  static async upsertDeliveryZone(
    input: UpsertStoreZoneInput,
    client?: PoolClient
  ): Promise<DeliveryZoneExtendedDTO> {
    const zoneId = input.id || `zone_${input.branch_id}_${Date.now()}`;
    const isNew = !input.id;

    let beforeState: any = null;
    if (!isNew) {
      const existing = await this.query(
        `SELECT * FROM public.delivery_zone WHERE id = $1 AND deleted_at IS NULL;`,
        [zoneId],
        client
      );
      if (existing.length > 0) {
        beforeState = existing[0];
      }
    }

    const sql = `
      INSERT INTO public.delivery_zone (
        id, branch_id, name, pincode, delivery_fee, is_serviceable,
        polygon_coordinates, exclusion_polygons, radius_km,
        center_latitude, center_longitude, priority,
        estimated_delivery_minutes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        pincode = EXCLUDED.pincode,
        delivery_fee = EXCLUDED.delivery_fee,
        is_serviceable = EXCLUDED.is_serviceable,
        polygon_coordinates = COALESCE(EXCLUDED.polygon_coordinates, delivery_zone.polygon_coordinates),
        exclusion_polygons = COALESCE(EXCLUDED.exclusion_polygons, delivery_zone.exclusion_polygons),
        radius_km = COALESCE(EXCLUDED.radius_km, delivery_zone.radius_km),
        center_latitude = COALESCE(EXCLUDED.center_latitude, delivery_zone.center_latitude),
        center_longitude = COALESCE(EXCLUDED.center_longitude, delivery_zone.center_longitude),
        priority = EXCLUDED.priority,
        estimated_delivery_minutes = EXCLUDED.estimated_delivery_minutes,
        updated_at = NOW()
      RETURNING *;
    `;

    const polyJson = input.polygon_coordinates && input.polygon_coordinates.length > 0
      ? JSON.stringify(input.polygon_coordinates)
      : null;
    const exclJson = input.exclusion_polygons && input.exclusion_polygons.length > 0
      ? JSON.stringify(input.exclusion_polygons)
      : null;

    const rows = await this.query(
      sql,
      [
        zoneId,
        input.branch_id,
        input.name,
        input.pincode || "560001",
        input.delivery_fee || 0,
        input.is_serviceable !== false,
        polyJson,
        exclJson,
        input.radius_km || null,
        input.center_latitude || null,
        input.center_longitude || null,
        input.priority || 10,
        input.estimated_delivery_minutes || 35,
      ],
      client
    );

    const r = rows[0];

    // Audit Event
    await this.recordCoverageEvent(
      {
        entity_type: "STORE_ZONE",
        entity_id: zoneId,
        event_type: isNew ? "ZONE_CREATED" : "ZONE_UPDATED",
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        reason: input.reason || (isNew ? "Created store zone" : "Updated store zone"),
        before_state: beforeState,
        after_state: r,
      },
      client
    );

    return {
      id: r.id,
      branch_id: r.branch_id,
      name: r.name,
      pincode: r.pincode,
      delivery_fee: Number(r.delivery_fee || 0),
      is_serviceable: Boolean(r.is_serviceable),
      polygon_coordinates: r.polygon_coordinates || null,
      exclusion_polygons: r.exclusion_polygons || null,
      radius_km: r.radius_km !== null ? Number(r.radius_km) : null,
      center_latitude: r.center_latitude !== null ? Number(r.center_latitude) : null,
      center_longitude: r.center_longitude !== null ? Number(r.center_longitude) : null,
      priority: parseInt(r.priority || "10", 10),
      estimated_delivery_minutes: parseInt(r.estimated_delivery_minutes || "35", 10),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  }

  /**
   * Soft-deactivates store delivery zone
   */
  static async deactivateDeliveryZone(
    zoneId: string,
    actorId: string,
    actorRole: string,
    reason: string,
    client?: PoolClient
  ): Promise<boolean> {
    const existing = await this.query(
      `SELECT * FROM public.delivery_zone WHERE id = $1 AND deleted_at IS NULL;`,
      [zoneId],
      client
    );
    if (existing.length === 0) return false;

    await this.query(
      `UPDATE public.delivery_zone SET is_serviceable = false, updated_at = NOW() WHERE id = $1;`,
      [zoneId],
      client
    );

    await this.recordCoverageEvent(
      {
        entity_type: "STORE_ZONE",
        entity_id: zoneId,
        event_type: "ZONE_DEACTIVATED",
        actor_id: actorId,
        actor_role: actorRole,
        reason: reason || "Deactivated zone serviceability",
        before_state: existing[0],
        after_state: { ...existing[0], is_serviceable: false },
      },
      client
    );

    return true;
  }

  // ── Delivery Partner Profile Operations ─────────────────────────────────────

  /**
   * Lists all delivery partners with their operational profiles
   */
  static async listDeliveryPartners(client?: PoolClient): Promise<DeliveryPartnerProfileDTO[]> {
    const sql = `
      SELECT 
        dp.id as partner_id,
        dp.first_name,
        dp.last_name,
        dp.email,
        dp.phone,
        p.id as profile_id,
        COALESCE(p.partner_type, 'OWN_FLEET') as partner_type,
        COALESCE(p.status, 'INACTIVE') as status,
        p.primary_branch_id,
        b.name as primary_branch_name,
        COALESCE(p.max_concurrent_orders, 5) as max_concurrent_orders,
        COALESCE(p.rating, 5.00) as rating,
        p.contract_reference,
        COALESCE(p.metadata, '{}'::jsonb) as metadata,
        dp.created_at,
        COALESCE(p.updated_at, dp.updated_at) as updated_at
      FROM public.delivery_partner dp
      LEFT JOIN public.delivery_partner_profile p ON dp.id = p.partner_id
      LEFT JOIN public.branch b ON p.primary_branch_id = b.id
      WHERE dp.deleted_at IS NULL
      ORDER BY p.status = 'ACTIVE' DESC, dp.first_name ASC;
    `;
    const rows = await this.query(sql, [], client);
    return rows.map((r: any) => ({
      id: r.profile_id || `prof_${r.partner_id}`,
      partner_id: r.partner_id,
      partner_name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      partner_email: r.email,
      partner_phone: r.phone,
      partner_type: r.partner_type,
      status: r.status,
      primary_branch_id: r.primary_branch_id || null,
      primary_branch_name: r.primary_branch_name || null,
      max_concurrent_orders: parseInt(r.max_concurrent_orders || "5", 10),
      rating: Number(r.rating || 5.0),
      contract_reference: r.contract_reference || null,
      metadata: r.metadata || {},
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  }

  /**
   * Gets single partner profile by partner_id
   */
  static async getPartnerProfile(partnerId: string, client?: PoolClient): Promise<DeliveryPartnerProfileDTO | null> {
    const sql = `
      SELECT 
        dp.id as partner_id,
        dp.first_name,
        dp.last_name,
        dp.email,
        dp.phone,
        p.id as profile_id,
        COALESCE(p.partner_type, 'OWN_FLEET') as partner_type,
        COALESCE(p.status, 'INACTIVE') as status,
        p.primary_branch_id,
        b.name as primary_branch_name,
        COALESCE(p.max_concurrent_orders, 5) as max_concurrent_orders,
        COALESCE(p.rating, 5.00) as rating,
        p.contract_reference,
        COALESCE(p.metadata, '{}'::jsonb) as metadata,
        dp.created_at,
        COALESCE(p.updated_at, dp.updated_at) as updated_at
      FROM public.delivery_partner dp
      LEFT JOIN public.delivery_partner_profile p ON dp.id = p.partner_id
      LEFT JOIN public.branch b ON p.primary_branch_id = b.id
      WHERE dp.id = $1 AND dp.deleted_at IS NULL;
    `;
    const rows = await this.query(sql, [partnerId], client);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.profile_id || `prof_${r.partner_id}`,
      partner_id: r.partner_id,
      partner_name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      partner_email: r.email,
      partner_phone: r.phone,
      partner_type: r.partner_type,
      status: r.status,
      primary_branch_id: r.primary_branch_id || null,
      primary_branch_name: r.primary_branch_name || null,
      max_concurrent_orders: parseInt(r.max_concurrent_orders || "5", 10),
      rating: Number(r.rating || 5.0),
      contract_reference: r.contract_reference || null,
      metadata: r.metadata || {},
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  }

  /**
   * Upserts delivery partner profile
   */
  static async upsertPartnerProfile(
    input: UpsertPartnerProfileInput,
    client?: PoolClient
  ): Promise<DeliveryPartnerProfileDTO> {
    const existing = await this.query(
      `SELECT * FROM public.delivery_partner_profile WHERE partner_id = $1;`,
      [input.partner_id],
      client
    );
    const isNew = existing.length === 0;
    const beforeState = isNew ? null : existing[0];
    const profileId = existing[0]?.id || crypto.randomUUID();

    const sql = `
      INSERT INTO public.delivery_partner_profile (
        id, partner_id, partner_type, status, primary_branch_id,
        max_concurrent_orders, rating, contract_reference, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      ON CONFLICT (partner_id) DO UPDATE SET
        partner_type = COALESCE(EXCLUDED.partner_type, delivery_partner_profile.partner_type),
        status = COALESCE(EXCLUDED.status, delivery_partner_profile.status),
        primary_branch_id = EXCLUDED.primary_branch_id,
        max_concurrent_orders = COALESCE(EXCLUDED.max_concurrent_orders, delivery_partner_profile.max_concurrent_orders),
        rating = COALESCE(EXCLUDED.rating, delivery_partner_profile.rating),
        contract_reference = COALESCE(EXCLUDED.contract_reference, delivery_partner_profile.contract_reference),
        metadata = COALESCE(EXCLUDED.metadata, delivery_partner_profile.metadata),
        updated_at = NOW()
      RETURNING *;
    `;

    const metaJson = input.metadata ? JSON.stringify(input.metadata) : "{}";
    const rows = await this.query(
      sql,
      [
        profileId,
        input.partner_id,
        input.partner_type || "OWN_FLEET",
        input.status || "ACTIVE",
        input.primary_branch_id || null,
        input.max_concurrent_orders || 5,
        input.rating || 5.0,
        input.contract_reference || null,
        metaJson,
      ],
      client
    );

    // Audit Event
    await this.recordCoverageEvent(
      {
        entity_type: "PARTNER_COVERAGE",
        entity_id: input.partner_id,
        event_type: isNew ? "PARTNER_PROFILE_CREATED" : "PARTNER_PROFILE_UPDATED",
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        reason: input.reason || (isNew ? "Created partner profile" : "Updated partner profile"),
        before_state: beforeState,
        after_state: rows[0],
      },
      client
    );

    return (await this.getPartnerProfile(input.partner_id, client))!;
  }

  // ── Delivery Partner Coverage Operations ────────────────────────────────────

  /**
   * Lists coverage boundaries for a partner
   */
  static async getPartnerCoverage(partnerId: string, client?: PoolClient): Promise<DeliveryPartnerCoverageDTO[]> {
    const sql = `
      SELECT 
        dpc.id, dpc.partner_id, dpc.branch_id, dpc.fence_type,
        dpc.polygon_coordinates, dpc.radius_km, dpc.center_latitude,
        dpc.center_longitude, dpc.priority, dpc.is_active,
        dpc.metadata, dpc.created_at, dpc.updated_at,
        b.name as branch_name
      FROM public.delivery_partner_coverage dpc
      JOIN public.branch b ON dpc.branch_id = b.id
      WHERE dpc.partner_id = $1
      ORDER BY dpc.priority DESC, dpc.created_at ASC;
    `;
    const rows = await this.query(sql, [partnerId], client);
    return rows.map((r: any) => ({
      id: r.id,
      partner_id: r.partner_id,
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      fence_type: r.fence_type,
      polygon_coordinates: r.polygon_coordinates || [],
      radius_km: r.radius_km !== null ? Number(r.radius_km) : null,
      center_latitude: r.center_latitude !== null ? Number(r.center_latitude) : null,
      center_longitude: r.center_longitude !== null ? Number(r.center_longitude) : null,
      priority: parseInt(r.priority || "10", 10),
      is_active: Boolean(r.is_active),
      metadata: r.metadata || {},
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  }

  /**
   * Upserts delivery partner coverage record
   */
  static async upsertPartnerCoverage(
    input: UpsertPartnerCoverageInput,
    client?: PoolClient
  ): Promise<DeliveryPartnerCoverageDTO> {
    const coverageId = input.id || crypto.randomUUID();
    const isNew = !input.id;

    let beforeState: any = null;
    if (!isNew) {
      const existing = await this.query(
        `SELECT * FROM public.delivery_partner_coverage WHERE id = $1;`,
        [coverageId],
        client
      );
      if (existing.length > 0) beforeState = existing[0];
    }

    const sql = `
      INSERT INTO public.delivery_partner_coverage (
        id, partner_id, branch_id, fence_type, polygon_coordinates,
        radius_km, center_latitude, center_longitude, priority,
        is_active, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        fence_type = COALESCE(EXCLUDED.fence_type, delivery_partner_coverage.fence_type),
        polygon_coordinates = COALESCE(EXCLUDED.polygon_coordinates, delivery_partner_coverage.polygon_coordinates),
        radius_km = COALESCE(EXCLUDED.radius_km, delivery_partner_coverage.radius_km),
        center_latitude = COALESCE(EXCLUDED.center_latitude, delivery_partner_coverage.center_latitude),
        center_longitude = COALESCE(EXCLUDED.center_longitude, delivery_partner_coverage.center_longitude),
        priority = COALESCE(EXCLUDED.priority, delivery_partner_coverage.priority),
        is_active = COALESCE(EXCLUDED.is_active, delivery_partner_coverage.is_active),
        metadata = COALESCE(EXCLUDED.metadata, delivery_partner_coverage.metadata),
        updated_at = NOW()
      RETURNING *;
    `;

    const polyJson = input.polygon_coordinates && input.polygon_coordinates.length > 0
      ? JSON.stringify(input.polygon_coordinates)
      : null;
    const metaJson = input.metadata ? JSON.stringify(input.metadata) : "{}";

    const rows = await this.query(
      sql,
      [
        coverageId,
        input.partner_id,
        input.branch_id,
        input.fence_type || "HYBRID",
        polyJson,
        input.radius_km || null,
        input.center_latitude || null,
        input.center_longitude || null,
        input.priority || 10,
        input.is_active !== false,
        metaJson,
      ],
      client
    );

    const r = rows[0];

    // Audit Event
    await this.recordCoverageEvent(
      {
        entity_type: "PARTNER_COVERAGE",
        entity_id: coverageId,
        event_type: isNew ? "PARTNER_COVERAGE_CREATED" : "PARTNER_COVERAGE_UPDATED",
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        reason: input.reason || (isNew ? "Created partner coverage" : "Updated partner coverage"),
        before_state: beforeState,
        after_state: r,
      },
      client
    );

    return {
      id: r.id,
      partner_id: r.partner_id,
      branch_id: r.branch_id,
      fence_type: r.fence_type,
      polygon_coordinates: r.polygon_coordinates || [],
      radius_km: r.radius_km !== null ? Number(r.radius_km) : null,
      center_latitude: r.center_latitude !== null ? Number(r.center_latitude) : null,
      center_longitude: r.center_longitude !== null ? Number(r.center_longitude) : null,
      priority: parseInt(r.priority || "10", 10),
      is_active: Boolean(r.is_active),
      metadata: r.metadata || {},
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  }

  // ── Audit Events Operations ─────────────────────────────────────────────────

  /**
   * Appends an immutable audit event to delivery_coverage_event
   */
  static async recordCoverageEvent(
    event: {
      entity_type: "STORE_ZONE" | "PARTNER_COVERAGE" | "STORE_ELIGIBILITY";
      entity_id: string;
      event_type: string;
      actor_id: string;
      actor_role: string;
      reason?: string | null;
      before_state?: any;
      after_state?: any;
    },
    client?: PoolClient
  ): Promise<DeliveryCoverageEventRow> {
    const eventId = `cov_ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sql = `
      INSERT INTO public.delivery_coverage_event (
        id, entity_type, entity_id, event_type, actor_id, actor_role,
        reason, before_state, after_state, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      )
      RETURNING *;
    `;
    const rows = await this.query(
      sql,
      [
        eventId,
        event.entity_type,
        event.entity_id,
        event.event_type,
        event.actor_id,
        event.actor_role,
        event.reason || null,
        event.before_state ? JSON.stringify(event.before_state) : null,
        event.after_state ? JSON.stringify(event.after_state) : null,
      ],
      client
    );
    return rows[0];
  }

  /**
   * Lists audit events with pagination and optional entity filtering
   */
  static async listCoverageEvents(
    limit: number = 50,
    offset: number = 0,
    entityType?: string,
    client?: PoolClient
  ): Promise<DeliveryCoverageEventRow[]> {
    let sql = `
      SELECT id, entity_type, entity_id, event_type, actor_id, actor_role, reason, before_state, after_state, created_at
      FROM public.delivery_coverage_event
    `;
    const params: any[] = [];
    if (entityType) {
      sql += ` WHERE entity_type = $1`;
      params.push(entityType);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);
    return await this.query(sql, params, client);
  }
}
