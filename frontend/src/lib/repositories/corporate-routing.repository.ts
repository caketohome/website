/**
 * CakeToHome ERP — Corporate Routing Repository
 * Phase C7.11 Step 11B: Corporate Delivery Geographic Matching & Assignment Repository
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. PARAMETERIZED QUERIES: 100% of SQL statements strictly use $1, $2 placeholders.
 * 2. TRANSACTION CONTEXT: All mutation and read operations support active PoolClient passthrough.
 * 3. ATOMIC UPSERT: Upserts assignment outcomes on (entity_type, entity_id) unique constraint.
 * 4. APPEND-ONLY AUDITING: Strictly appends to corporate_assignment_event; never updates or deletes audit events.
 * 5. DATABASE IS SINGLE SOURCE OF TRUTH: Configuration read strictly from PostgreSQL catalog.
 */

import { dbQuery } from "../db";
import crypto from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  CorporateDeliveryEntityType,
  CorporateAssignmentStatus,
  CorporateRoutingReasonCode,
  CorporateAssignmentEventType,
  CorporateDeliveryAssignmentRow,
  CorporateAssignmentEventRow,
  UnresolvedFilterParams,
  UnresolvedAssignmentItem,
  UnresolvedQueueMetrics,
} from "../types/corporate-routing.types";
import type {
  PolygonCoordinate,
  FenceType,
  PartnerType,
} from "../types/delivery-coverage.types";

export interface CandidateStoreZoneRecord {
  store_id: string;
  store_name: string;
  store_code: string;
  is_open: boolean;
  is_corporate_routing_eligible: boolean;
  store_latitude: number;
  store_longitude: number;
  zone_id: string;
  zone_name: string | null;
  zone_priority: number;
  radius_km: number | null;
  center_latitude: number | null;
  center_longitude: number | null;
  polygon_coordinates: PolygonCoordinate[] | null;
  exclusion_polygons: PolygonCoordinate[][] | null;
}

export interface CandidatePartnerCoverageRecord {
  partner_id: string;
  partner_name: string;
  partner_type: PartnerType;
  profile_status: string;
  rating: number;
  coverage_id: string;
  branch_id: string;
  fence_type: FenceType;
  priority: number;
  radius_km: number | null;
  center_latitude: number | null;
  center_longitude: number | null;
  polygon_coordinates: PolygonCoordinate[] | null;
  is_active: boolean;
}

export class CorporateRoutingRepository {
  /**
   * Helper to execute queries on client or default pool
   */
  private static async query<R extends QueryResultRow = any>(
    sql: string,
    params: any[] = [],
    client?: PoolClient
  ): Promise<R[]> {
    if (client) {
      const res = await client.query(sql, params);
      return res.rows as R[];
    }
    const res = await dbQuery<R>(sql, params);
    return res.rows;
  }

  // ── Assignment CRUD Operations ───────────────────────────────────────────────

  /**
   * Atomically upserts a corporate delivery assignment row based on (entity_type, entity_id).
   * Generates a deterministic or random UUID prefixed with 'cda_' if id is not supplied.
   */
  static async upsertAssignment(
    input: {
      id?: string;
      entity_type: CorporateDeliveryEntityType;
      entity_id: string;
      account_id?: string | null;
      recipient_name?: string | null;
      recipient_phone?: string | null;
      delivery_address: string;
      delivery_city?: string | null;
      normalized_city_key?: string | null;
      delivery_pincode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      status: CorporateAssignmentStatus;
      reason_code: CorporateRoutingReasonCode;
      assigned_store_id?: string | null;
      assigned_zone_id?: string | null;
      assigned_partner_id?: string | null;
      distance_km?: number | null;
      matched_rule?: string | null;
      diagnostics_message?: string | null;
      evaluation_metadata?: Record<string, unknown>;
      assigned_at?: Date | string | null;
      assigned_by?: string | null;
      override_reason?: string | null;
    },
    client?: PoolClient
  ): Promise<CorporateDeliveryAssignmentRow> {
    const id = input.id || `cda_${crypto.randomUUID()}`;

    const sql = `
      INSERT INTO public.corporate_delivery_assignment (
        id,
        entity_type,
        entity_id,
        account_id,
        recipient_name,
        recipient_phone,
        delivery_address,
        delivery_city,
        normalized_city_key,
        delivery_pincode,
        latitude,
        longitude,
        status,
        reason_code,
        assigned_store_id,
        assigned_zone_id,
        assigned_partner_id,
        distance_km,
        matched_rule,
        diagnostics_message,
        evaluation_metadata,
        assigned_at,
        assigned_by,
        override_reason,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NOW(), NOW()
      )
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        account_id = COALESCE(EXCLUDED.account_id, public.corporate_delivery_assignment.account_id),
        recipient_name = EXCLUDED.recipient_name,
        recipient_phone = EXCLUDED.recipient_phone,
        delivery_address = EXCLUDED.delivery_address,
        delivery_city = EXCLUDED.delivery_city,
        normalized_city_key = EXCLUDED.normalized_city_key,
        delivery_pincode = EXCLUDED.delivery_pincode,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        status = EXCLUDED.status,
        reason_code = EXCLUDED.reason_code,
        assigned_store_id = EXCLUDED.assigned_store_id,
        assigned_zone_id = EXCLUDED.assigned_zone_id,
        assigned_partner_id = EXCLUDED.assigned_partner_id,
        distance_km = EXCLUDED.distance_km,
        matched_rule = EXCLUDED.matched_rule,
        diagnostics_message = EXCLUDED.diagnostics_message,
        evaluation_metadata = EXCLUDED.evaluation_metadata,
        assigned_at = EXCLUDED.assigned_at,
        assigned_by = EXCLUDED.assigned_by,
        override_reason = EXCLUDED.override_reason,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      id,
      input.entity_type,
      input.entity_id,
      input.account_id || null,
      input.recipient_name || null,
      input.recipient_phone || null,
      input.delivery_address,
      input.delivery_city || null,
      input.normalized_city_key || null,
      input.delivery_pincode || null,
      input.latitude !== undefined && input.latitude !== null ? input.latitude : null,
      input.longitude !== undefined && input.longitude !== null ? input.longitude : null,
      input.status,
      input.reason_code,
      input.assigned_store_id || null,
      input.assigned_zone_id || null,
      input.assigned_partner_id || null,
      input.distance_km !== undefined && input.distance_km !== null ? input.distance_km : null,
      input.matched_rule || null,
      input.diagnostics_message || null,
      JSON.stringify(input.evaluation_metadata || {}),
      input.assigned_at ? new Date(input.assigned_at) : null,
      input.assigned_by || null,
      input.override_reason || null,
    ];

    const rows = await this.query<CorporateDeliveryAssignmentRow>(sql, params, client);
    return rows[0];
  }

  /**
   * Retrieves single assignment row by entity identity (entity_type, entity_id)
   */
  static async getAssignmentByEntity(
    entityType: CorporateDeliveryEntityType,
    entityId: string,
    client?: PoolClient
  ): Promise<CorporateDeliveryAssignmentRow | null> {
    const sql = `
      SELECT * FROM public.corporate_delivery_assignment
      WHERE entity_type = $1 AND entity_id = $2
      LIMIT 1;
    `;
    const rows = await this.query<CorporateDeliveryAssignmentRow>(sql, [entityType, entityId], client);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Retrieves single assignment row by primary key id
   */
  static async getAssignmentById(id: string, client?: PoolClient): Promise<CorporateDeliveryAssignmentRow | null> {
    const sql = `
      SELECT * FROM public.corporate_delivery_assignment
      WHERE id = $1
      LIMIT 1;
    `;
    const rows = await this.query<CorporateDeliveryAssignmentRow>(sql, [id], client);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Lists assignment rows with optional filters
   */
  static async listAssignments(
    filter: {
      account_id?: string;
      status?: string;
      assigned_store_id?: string;
      limit?: number;
      offset?: number;
    } = {},
    client?: PoolClient
  ): Promise<CorporateDeliveryAssignmentRow[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.account_id) {
      conditions.push(`account_id = $${pIdx++}`);
      params.push(filter.account_id);
    }
    if (filter.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.assigned_store_id) {
      conditions.push(`assigned_store_id = $${pIdx++}`);
      params.push(filter.assigned_store_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
    const offset = Math.max(filter.offset || 0, 0);

    const sql = `
      SELECT * FROM public.corporate_delivery_assignment
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;
    params.push(limit, offset);

    return await this.query<CorporateDeliveryAssignmentRow>(sql, params, client);
  }

  // ── Assignment Event Audit Log ──────────────────────────────────────────────

  /**
   * Appends an audit event to public.corporate_assignment_event.
   * Note: The table has an append-only trigger strictly blocking UPDATE and DELETE.
   */
  static async insertAssignmentEvent(
    event: {
      id?: string;
      assignment_id: string;
      event_type: CorporateAssignmentEventType;
      actor_id: string;
      actor_role: string;
      reason?: string | null;
      before_state?: Record<string, unknown> | null;
      after_state?: Record<string, unknown> | null;
    },
    client?: PoolClient
  ): Promise<CorporateAssignmentEventRow> {
    const id = event.id || `cae_${crypto.randomUUID()}`;
    const sql = `
      INSERT INTO public.corporate_assignment_event (
        id,
        assignment_id,
        event_type,
        actor_id,
        actor_role,
        reason,
        before_state,
        after_state,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *;
    `;

    const params = [
      id,
      event.assignment_id,
      event.event_type,
      event.actor_id,
      event.actor_role,
      event.reason || null,
      event.before_state ? JSON.stringify(event.before_state) : null,
      event.after_state ? JSON.stringify(event.after_state) : null,
    ];

    const rows = await this.query<CorporateAssignmentEventRow>(sql, params, client);
    return rows[0];
  }

  /**
   * Retrieves audit events for a given assignment record, chronological descending.
   */
  static async listAssignmentEvents(
    assignmentId: string,
    client?: PoolClient
  ): Promise<CorporateAssignmentEventRow[]> {
    const sql = `
      SELECT * FROM public.corporate_assignment_event
      WHERE assignment_id = $1
      ORDER BY created_at DESC;
    `;
    return await this.query<CorporateAssignmentEventRow>(sql, [assignmentId], client);
  }

  // ── Geofence & Master Data Queries ──────────────────────────────────────────

  /**
   * Loads candidate stores and active delivery zones with polygon/exclusion geometries.
   * Loads ALL serviceable zones across non-deleted stores so the engine can accurately
   * determine geographic coverage and differentiate between STORE_NOT_ELIGIBLE and OUTSIDE_COVERAGE.
   */
  static async listCandidateStoreZones(client?: PoolClient): Promise<CandidateStoreZoneRecord[]> {
    const sql = `
      SELECT 
        b.id as store_id,
        b.name as store_name,
        b.code as store_code,
        b.is_open,
        COALESCE(b.is_corporate_routing_eligible, false) as is_corporate_routing_eligible,
        b.latitude as store_latitude,
        b.longitude as store_longitude,
        dz.id as zone_id,
        dz.name as zone_name,
        COALESCE(dz.priority, 10) as zone_priority,
        dz.radius_km,
        dz.center_latitude,
        dz.center_longitude,
        dz.polygon_coordinates,
        dz.exclusion_polygons
      FROM public.branch b
      JOIN public.delivery_zone dz ON b.id = dz.branch_id
      WHERE b.deleted_at IS NULL
        AND dz.deleted_at IS NULL
        AND dz.is_serviceable = true
      ORDER BY b.is_corporate_routing_eligible DESC, dz.priority DESC, b.name ASC;
    `;
    const rows = await this.query(sql, [], client);
    return rows.map((r: any) => ({
      store_id: r.store_id,
      store_name: r.store_name,
      store_code: r.store_code,
      is_open: Boolean(r.is_open),
      is_corporate_routing_eligible: Boolean(r.is_corporate_routing_eligible),
      store_latitude: Number(r.store_latitude),
      store_longitude: Number(r.store_longitude),
      zone_id: r.zone_id,
      zone_name: r.zone_name,
      zone_priority: parseInt(r.zone_priority || "10", 10),
      radius_km: r.radius_km !== null ? Number(r.radius_km) : null,
      center_latitude: r.center_latitude !== null ? Number(r.center_latitude) : null,
      center_longitude: r.center_longitude !== null ? Number(r.center_longitude) : null,
      polygon_coordinates: r.polygon_coordinates || null,
      exclusion_polygons: r.exclusion_polygons || null,
    }));
  }

  /**
   * Loads candidate active delivery partners and their coverage boundaries.
   * Evaluates only active partner profiles and active partner geofences.
   */
  static async listCandidatePartnerCoverages(client?: PoolClient): Promise<CandidatePartnerCoverageRecord[]> {
    const sql = `
      SELECT 
        dp.id as partner_id,
        TRIM(CONCAT(dp.first_name, ' ', dp.last_name)) as partner_name,
        COALESCE(p.partner_type, 'OWN_FLEET') as partner_type,
        COALESCE(p.status, 'INACTIVE') as profile_status,
        COALESCE(p.rating, 5.0) as rating,
        dpc.id as coverage_id,
        dpc.branch_id,
        dpc.fence_type,
        COALESCE(dpc.priority, 10) as priority,
        dpc.radius_km,
        dpc.center_latitude,
        dpc.center_longitude,
        dpc.polygon_coordinates,
        dpc.is_active
      FROM public.delivery_partner dp
      JOIN public.delivery_partner_profile p ON dp.id = p.partner_id
      JOIN public.delivery_partner_coverage dpc ON dp.id = dpc.partner_id
      WHERE dp.deleted_at IS NULL
        AND p.status = 'ACTIVE'
        AND dpc.is_active = true
      ORDER BY dpc.priority DESC, p.partner_type ASC, dpc.id ASC;
    `;
    const rows = await this.query(sql, [], client);
    return rows.map((r: any) => ({
      partner_id: r.partner_id,
      partner_name: r.partner_name || "Unnamed Partner",
      partner_type: r.partner_type as PartnerType,
      profile_status: r.profile_status,
      rating: Number(r.rating || 5.0),
      coverage_id: r.coverage_id,
      branch_id: r.branch_id,
      fence_type: r.fence_type as FenceType,
      priority: parseInt(r.priority || "10", 10),
      radius_km: r.radius_km !== null ? Number(r.radius_km) : null,
      center_latitude: r.center_latitude !== null ? Number(r.center_latitude) : null,
      center_longitude: r.center_longitude !== null ? Number(r.center_longitude) : null,
      polygon_coordinates: r.polygon_coordinates || null,
      is_active: Boolean(r.is_active),
    }));
  }

  // ── Phase C7.12: Super Admin Unresolved Review Queue Methods ────────────────

  /**
   * Masks recipient phone numbers for privacy-preserving review UI and API responses.
   */
  public static maskPhoneNumber(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const cleaned = phone.trim();
    if (cleaned.length <= 4) return "****";
    if (cleaned.length <= 7) return cleaned.slice(0, 2) + "****" + cleaned.slice(-1);
    return cleaned.slice(0, cleaned.length - 6) + "****" + cleaned.slice(-2);
  }

  /**
   * Provides human-readable diagnostic description of canonical reason codes.
   */
  public static mapReasonDescription(code: CorporateRoutingReasonCode | string): string {
    switch (code) {
      case "COORDINATES_MISSING":
        return "Delivery address lacks GPS latitude/longitude coordinates.";
      case "COORDINATES_INVALID":
        return "GPS coordinates are outside geographic bounds or invalid.";
      case "INSIDE_EXCLUSION":
        return "Delivery location falls inside an active store exclusion zone.";
      case "OUTSIDE_COVERAGE":
        return "Delivery coordinates are outside all active store delivery polygons and radii.";
      case "STORE_NOT_ELIGIBLE":
        return "Store covers this location but is not authorized for corporate routing.";
      case "NO_ELIGIBLE_PARTNER":
        return "Store covers this location, but no active delivery partner is configured.";
      case "PENDING_EVALUATION":
        return "Queued for automatic geographic evaluation.";
      case "PENDING_REVIEW":
        return "Held for manual operator verification or client address confirmation.";
      case "MANUAL_OVERRIDE":
        return "Manually assigned with operational justification.";
      case "MATCHED_POLYGON":
        return "Successfully matched to store geofence polygon.";
      case "MATCHED_RADIUS":
        return "Successfully matched to store radial delivery boundary.";
      default:
        return "Unresolved delivery routing status.";
    }
  }

  /**
   * Lists unresolved corporate delivery assignments with account join, filters, search, and pagination.
   */
  static async listUnresolvedAssignments(
    params: UnresolvedFilterParams = {},
    client?: PoolClient
  ): Promise<UnresolvedAssignmentItem[]> {
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    // Status filter (default to UNASSIGNED and PENDING_REVIEW if not specified)
    if (params.status) {
      conditions.push(`cda.status = $${pIdx++}`);
      queryParams.push(params.status);
    } else {
      conditions.push(`cda.status IN ('UNASSIGNED', 'PENDING_REVIEW')`);
    }

    if (params.reason_code) {
      conditions.push(`cda.reason_code = $${pIdx++}`);
      queryParams.push(params.reason_code);
    }

    if (params.account_id) {
      conditions.push(`cda.account_id = $${pIdx++}`);
      queryParams.push(params.account_id);
    }

    if (params.entity_type) {
      conditions.push(`cda.entity_type = $${pIdx++}`);
      queryParams.push(params.entity_type);
    }

    if (params.search && params.search.trim() !== "") {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        `(cda.recipient_name ILIKE $${pIdx} OR cda.delivery_address ILIKE $${pIdx} OR cda.delivery_city ILIKE $${pIdx} OR cda.delivery_pincode ILIKE $${pIdx} OR ca.legal_name ILIKE $${pIdx} OR ca.trade_name ILIKE $${pIdx})`
      );
      queryParams.push(term);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(params.limit || 50, 1), 200);
    const offset = Math.max(params.offset || (params.page ? (params.page - 1) * limit : 0), 0);

    const sql = `
      SELECT 
        cda.*,
        ca.legal_name AS account_name,
        b.name AS assigned_store_name,
        dz.name AS assigned_zone_name,
        TRIM(CONCAT(dp.first_name, ' ', dp.last_name)) AS assigned_partner_name
      FROM public.corporate_delivery_assignment cda
      LEFT JOIN public.corporate_account ca ON cda.account_id = ca.id
      LEFT JOIN public.branch b ON cda.assigned_store_id = b.id
      LEFT JOIN public.delivery_zone dz ON cda.assigned_zone_id = dz.id
      LEFT JOIN public.delivery_partner dp ON cda.assigned_partner_id = dp.id
      ${whereClause}
      ORDER BY cda.updated_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;
    queryParams.push(limit, offset);

    const rows = await this.query(sql, queryParams, client);

    return rows.map((r: any) => ({
      id: r.id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      account_id: r.account_id,
      account_name: r.account_name || null,
      recipient_name: r.recipient_name,
      recipient_phone: r.recipient_phone,
      masked_phone: this.maskPhoneNumber(r.recipient_phone),
      delivery_address: r.delivery_address,
      delivery_city: r.delivery_city,
      normalized_city_key: r.normalized_city_key,
      delivery_pincode: r.delivery_pincode,
      latitude: r.latitude !== null ? Number(r.latitude) : null,
      longitude: r.longitude !== null ? Number(r.longitude) : null,
      status: r.status,
      reason_code: r.reason_code,
      reason_description: this.mapReasonDescription(r.reason_code),
      assigned_store_id: r.assigned_store_id,
      assigned_store_name: r.assigned_store_name || null,
      assigned_zone_id: r.assigned_zone_id,
      assigned_zone_name: r.assigned_zone_name || null,
      assigned_partner_id: r.assigned_partner_id,
      assigned_partner_name: r.assigned_partner_name || null,
      distance_km: r.distance_km !== null ? Number(r.distance_km) : null,
      matched_rule: r.matched_rule,
      diagnostics_message: r.diagnostics_message,
      evaluation_metadata: r.evaluation_metadata || {},
      assigned_at: r.assigned_at ? new Date(r.assigned_at).toISOString() : null,
      assigned_by: r.assigned_by,
      override_reason: r.override_reason,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  }

  /**
   * Computes queue metrics and counts for unresolved assignments.
   */
  static async countUnresolvedAssignments(
    params: UnresolvedFilterParams = {},
    client?: PoolClient
  ): Promise<UnresolvedQueueMetrics> {
    const conditions: string[] = [];
    const queryParams: any[] = [];
    let pIdx = 1;

    if (params.status) {
      conditions.push(`cda.status = $${pIdx++}`);
      queryParams.push(params.status);
    } else {
      conditions.push(`cda.status IN ('UNASSIGNED', 'PENDING_REVIEW')`);
    }

    if (params.account_id) {
      conditions.push(`cda.account_id = $${pIdx++}`);
      queryParams.push(params.account_id);
    }

    if (params.entity_type) {
      conditions.push(`cda.entity_type = $${pIdx++}`);
      queryParams.push(params.entity_type);
    }

    if (params.search && params.search.trim() !== "") {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        `(cda.recipient_name ILIKE $${pIdx} OR cda.delivery_address ILIKE $${pIdx} OR cda.delivery_city ILIKE $${pIdx} OR cda.delivery_pincode ILIKE $${pIdx} OR ca.legal_name ILIKE $${pIdx} OR ca.trade_name ILIKE $${pIdx})`
      );
      queryParams.push(term);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        cda.reason_code,
        COUNT(*)::int AS count
      FROM public.corporate_delivery_assignment cda
      LEFT JOIN public.corporate_account ca ON cda.account_id = ca.id
      ${whereClause}
      GROUP BY cda.reason_code;
    `;

    const rows = await this.query(sql, queryParams, client);
    const byReason: Record<string, number> = {};
    let total = 0;

    for (const r of rows) {
      const cnt = parseInt(r.count, 10);
      byReason[r.reason_code] = cnt;
      total += cnt;
    }

    return {
      total_unresolved: total,
      by_reason_code: byReason,
    };
  }

  /**
   * Updates an existing corporate delivery assignment with resolution outcome.
   */
  static async updateAssignmentResolution(
    input: {
      id: string;
      status: CorporateAssignmentStatus;
      reason_code: CorporateRoutingReasonCode;
      assigned_store_id?: string | null;
      assigned_zone_id?: string | null;
      assigned_partner_id?: string | null;
      distance_km?: number | null;
      matched_rule?: string | null;
      diagnostics_message?: string | null;
      evaluation_metadata?: Record<string, unknown>;
      latitude?: number | null;
      longitude?: number | null;
      delivery_address?: string;
      assigned_at?: Date | null;
      assigned_by?: string | null;
      override_reason?: string | null;
    },
    client?: PoolClient
  ): Promise<CorporateDeliveryAssignmentRow> {
    const sql = `
      UPDATE public.corporate_delivery_assignment
      SET
        status = $2,
        reason_code = $3,
        assigned_store_id = $4,
        assigned_zone_id = $5,
        assigned_partner_id = $6,
        distance_km = $7,
        matched_rule = $8,
        diagnostics_message = $9,
        evaluation_metadata = COALESCE($10, evaluation_metadata),
        latitude = COALESCE($11, latitude),
        longitude = COALESCE($12, longitude),
        delivery_address = COALESCE($13, delivery_address),
        assigned_at = $14,
        assigned_by = $15,
        override_reason = $16,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const params = [
      input.id,
      input.status,
      input.reason_code,
      input.assigned_store_id || null,
      input.assigned_zone_id || null,
      input.assigned_partner_id || null,
      input.distance_km !== undefined ? input.distance_km : null,
      input.matched_rule || null,
      input.diagnostics_message || null,
      input.evaluation_metadata ? JSON.stringify(input.evaluation_metadata) : null,
      input.latitude !== undefined ? input.latitude : null,
      input.longitude !== undefined ? input.longitude : null,
      input.delivery_address || null,
      input.assigned_at || null,
      input.assigned_by || null,
      input.override_reason || null,
    ];

    const rows = await this.query<CorporateDeliveryAssignmentRow>(sql, params, client);
    if (rows.length === 0) {
      throw new Error(`Assignment "${input.id}" not found for resolution update.`);
    }
    return rows[0];
  }
}
