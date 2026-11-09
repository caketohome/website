/**
 * CakeToHome ERP — Corporate Delivery Geographic Matching & Routing Service
 * Phase C7.11 Step 11B: Domain Geographic Matching Engine
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. PURE GEOMETRY REUSE: Reuses point-in-polygon raycasting (Jordan curve theorem) and
 *    spherical Haversine distance from DeliveryCoverageService without algorithm duplication.
 * 2. STRICT FAIL-CLOSED ROUTING: Missing coordinates, invalid values, unverified locations,
 *    and unserviced areas fail closed to UNASSIGNED with explicit reason codes.
 * 3. EXCLUSION PRECEDENCE: Exclusion geometry is evaluated before positive store or partner coverage.
 * 4. DETERMINISTIC MATCHING PRECEDENCE:
 *    - Polygon match > Circle radius-only match.
 *    - Store priority DESC > Shortest Haversine distance to store centroid > Store ID ASC.
 *    - Partner priority DESC > Fleet type (OWN_FLEET > COURIER > 3PL_AGGREGATOR) > Rating DESC > Partner ID ASC.
 * 5. ATOMIC PERSISTENCE & IDEMPOTENT AUDITING:
 *    - Unchanged repeat matching produces no assignment churn and no duplicate audit events.
 *    - Actual mutations record append-only audit events atomically in the same database transaction.
 * 6. NO ACCOUNTING INTERACTION: Routing outcomes are purely operational and never mutate vouchers,
 *    invoices, or General Ledger entries. The C7.7 single-master-invoice rule is preserved.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  CorporateRoutingRepository,
  CandidateStoreZoneRecord,
  CandidatePartnerCoverageRecord,
} from "../repositories/corporate-routing.repository";
import { DeliveryCoverageService } from "./delivery-coverage.service";
import type {
  CorporateDeliveryEntityType,
  CorporateAssignmentStatus,
  CorporateRoutingReasonCode,
  CorporateDeliveryAssignmentRow,
  CorporateDeliveryAssignmentDTO,
  CorporateBatchMatchingInput,
  CorporateBatchMatchingItemInput,
  CorporateBatchMatchingResult,
  CorporateBatchMatchingSummary,
  ResolveUnresolvedInput,
  ResolveActionResult,
  UnresolvedReviewCandidatesResult,
  CandidateStoreReview,
  CandidatePartnerReview,
} from "../types/corporate-routing.types";
import type { PolygonCoordinate, PartnerType } from "../types/delivery-coverage.types";

export interface EvaluatedMatchOutcome {
  status: CorporateAssignmentStatus;
  reason_code: CorporateRoutingReasonCode;
  assigned_store_id: string | null;
  assigned_store_name?: string | null;
  assigned_zone_id: string | null;
  assigned_zone_name?: string | null;
  assigned_partner_id: string | null;
  assigned_partner_name?: string | null;
  distance_km: number | null;
  matched_rule: string | null;
  diagnostics_message: string;
  evaluation_metadata: Record<string, unknown>;
}

export class CorporateRoutingService {
  /**
   * Normalizes city names for display and parallel lookup without destroying customer address text.
   */
  static normalizeCityKey(city?: string | null): string | null {
    if (!city || typeof city !== "string" || city.trim().length === 0) return null;
    return city.trim().toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Evaluates a single delivery target against persisted store and partner geofences.
   * Pure domain evaluation without side effects.
   */
  static evaluateTarget(
    item: CorporateBatchMatchingItemInput,
    candidateStores: CandidateStoreZoneRecord[],
    candidatePartners: CandidatePartnerCoverageRecord[]
  ): EvaluatedMatchOutcome {
    const lat = item.latitude;
    const lng = item.longitude;

    // ── 1. Coordinate Verification ──────────────────────────────────────────────
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return {
        status: "UNASSIGNED",
        reason_code: "COORDINATES_MISSING",
        assigned_store_id: null,
        assigned_zone_id: null,
        assigned_partner_id: null,
        distance_km: null,
        matched_rule: null,
        diagnostics_message: "Delivery coordinates missing. Latitude and longitude are required for geographic routing.",
        evaluation_metadata: { input_address: item.delivery_address, missing_coordinates: true },
      };
    }

    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      isNaN(lat) ||
      isNaN(lng) ||
      !isFinite(lat) ||
      !isFinite(lng) ||
      lat < -90.0 ||
      lat > 90.0 ||
      lng < -180.0 ||
      lng > 180.0 ||
      lat === 999.999 ||
      lng === 999.999
    ) {
      return {
        status: "UNASSIGNED",
        reason_code: "COORDINATES_INVALID",
        assigned_store_id: null,
        assigned_zone_id: null,
        assigned_partner_id: null,
        distance_km: null,
        matched_rule: null,
        diagnostics_message: `Coordinates (${lat}, ${lng}) are invalid or outside permissible geographical bounds [-90..90, -180..180].`,
        evaluation_metadata: { invalid_latitude: lat, invalid_longitude: lng },
      };
    }

    // ── 2. Exclusion Precedence ─────────────────────────────────────────────────
    // Active exclusion polygons take strict priority over positive coverage.
    for (const storeZone of candidateStores) {
      const exclusions = storeZone.exclusion_polygons;
      if (exclusions && Array.isArray(exclusions)) {
        for (const exclPoly of exclusions) {
          if (Array.isArray(exclPoly) && exclPoly.length >= 3) {
            if (DeliveryCoverageService.isPointInPolygon(lat, lng, exclPoly)) {
              return {
                status: "UNASSIGNED",
                reason_code: "INSIDE_EXCLUSION",
                assigned_store_id: null,
                assigned_zone_id: null,
                assigned_partner_id: null,
                distance_km: null,
                matched_rule: "EXCLUSION_ZONE_BLOCKED",
                diagnostics_message: `Delivery location (${lat}, ${lng}) falls strictly inside an active exclusion boundary of store "${storeZone.store_name}".`,
                evaluation_metadata: {
                  blocking_store_id: storeZone.store_id,
                  blocking_store_name: storeZone.store_name,
                  blocking_zone_id: storeZone.zone_id,
                },
              };
            }
          }
        }
      }
    }

    // ── 3. Store Candidate Matching & Class Evaluation ──────────────────────────
    interface StoreCandidateMatch {
      record: CandidateStoreZoneRecord;
      matchClass: "POLYGON" | "RADIUS";
      distanceKm: number;
    }

    const candidateMatches: StoreCandidateMatch[] = [];

    for (const storeZone of candidateStores) {
      let isMatched = false;
      let matchClass: "POLYGON" | "RADIUS" = "RADIUS";
      let dist = 0;

      // Class 1: Polygon match check
      const poly = storeZone.polygon_coordinates;
      if (poly && Array.isArray(poly) && poly.length >= 3) {
        if (DeliveryCoverageService.isPointInPolygon(lat, lng, poly)) {
          isMatched = true;
          matchClass = "POLYGON";
          dist = DeliveryCoverageService.calculateDistanceKm(
            lat,
            lng,
            storeZone.store_latitude,
            storeZone.store_longitude
          );
        }
      }

      // Class 2: Radius match check (if polygon didn't match)
      if (!isMatched && storeZone.radius_km !== null && storeZone.radius_km > 0) {
        const centerLat = storeZone.center_latitude ?? storeZone.store_latitude;
        const centerLng = storeZone.center_longitude ?? storeZone.store_longitude;
        const rDist = DeliveryCoverageService.calculateDistanceKm(lat, lng, centerLat, centerLng);
        if (rDist <= storeZone.radius_km) {
          isMatched = true;
          matchClass = "RADIUS";
          dist = rDist;
        }
      }

      if (isMatched) {
        candidateMatches.push({
          record: storeZone,
          matchClass,
          distanceKm: dist,
        });
      }
    }

    // If completely outside all store geofences
    if (candidateMatches.length === 0) {
      return {
        status: "UNASSIGNED",
        reason_code: "OUTSIDE_COVERAGE",
        assigned_store_id: null,
        assigned_zone_id: null,
        assigned_partner_id: null,
        distance_km: null,
        matched_rule: null,
        diagnostics_message: `Delivery coordinates (${lat}, ${lng}) fall outside the coverage boundaries of all configured bakery stores.`,
        evaluation_metadata: { evaluated_stores_count: candidateStores.length },
      };
    }

    // Separate candidate matches into corporate allow-listed vs ineligible
    const eligibleMatches = candidateMatches.filter((m) => m.record.is_corporate_routing_eligible);

    if (eligibleMatches.length === 0) {
      const ineligibleStoreNames = Array.from(new Set(candidateMatches.map((m) => m.record.store_name)));
      return {
        status: "UNASSIGNED",
        reason_code: "STORE_NOT_ELIGIBLE",
        assigned_store_id: null,
        assigned_zone_id: null,
        assigned_partner_id: null,
        distance_km: candidateMatches[0].distanceKm,
        matched_rule: null,
        diagnostics_message: `Delivery location is covered by store(s) [${ineligibleStoreNames.join(", ")}], but none are allow-listed for corporate routing (is_corporate_routing_eligible = false).`,
        evaluation_metadata: {
          ineligible_stores: ineligibleStoreNames,
          candidate_matches_count: candidateMatches.length,
        },
      };
    }

    // ── 4. Deterministic Store Selection (Tie-Breaking) ─────────────────────────
    // Precedence:
    // 1. Match Class: POLYGON (rank 1) > RADIUS (rank 2)
    // 2. Store Zone Priority: DESC (higher priority integer wins)
    // 3. Shortest Haversine distance: ASC (closest store wins)
    // 4. Stable tie-breaker: store_id ASC
    eligibleMatches.sort((a, b) => {
      // 1. Polygon beats Radius
      const rankA = a.matchClass === "POLYGON" ? 1 : 2;
      const rankB = b.matchClass === "POLYGON" ? 1 : 2;
      if (rankA !== rankB) return rankA - rankB;

      // 2. Zone Priority (higher wins)
      if (b.record.zone_priority !== a.record.zone_priority) {
        return b.record.zone_priority - a.record.zone_priority;
      }

      // 3. Shortest Distance
      if (Math.abs(a.distanceKm - b.distanceKm) > 0.001) {
        return a.distanceKm - b.distanceKm;
      }

      // 4. Stable Store ID
      return a.record.store_id.localeCompare(b.record.store_id);
    });

    const winningStoreMatch = eligibleMatches[0];
    const winningStore = winningStoreMatch.record;

    // ── 5. Delivery Partner Selection (Tie-Breaking) ────────────────────────────
    // Filter active partners covering winningStore and target coordinates
    interface PartnerCandidateMatch {
      record: CandidatePartnerCoverageRecord;
    }

    const partnerMatches: PartnerCandidateMatch[] = [];

    for (const partner of candidatePartners) {
      // Must cover the selected store branch
      if (partner.branch_id !== winningStore.store_id) continue;
      if (!partner.is_active || partner.profile_status !== "ACTIVE") continue;

      let partnerCovers = false;

      // Polygon fence check
      if (
        (partner.fence_type === "POLYGON" || partner.fence_type === "HYBRID") &&
        partner.polygon_coordinates &&
        Array.isArray(partner.polygon_coordinates) &&
        partner.polygon_coordinates.length >= 3
      ) {
        if (DeliveryCoverageService.isPointInPolygon(lat, lng, partner.polygon_coordinates)) {
          partnerCovers = true;
        }
      }

      // Radius fence check
      if (
        !partnerCovers &&
        (partner.fence_type === "RADIUS" || partner.fence_type === "HYBRID") &&
        partner.radius_km !== null &&
        partner.radius_km > 0
      ) {
        const cLat = partner.center_latitude ?? winningStore.store_latitude;
        const cLng = partner.center_longitude ?? winningStore.store_longitude;
        const pDist = DeliveryCoverageService.calculateDistanceKm(lat, lng, cLat, cLng);
        if (pDist <= partner.radius_km) {
          partnerCovers = true;
        }
      }

      if (partnerCovers) {
        partnerMatches.push({ record: partner });
      }
    }

    if (partnerMatches.length === 0) {
      return {
        status: "UNASSIGNED",
        reason_code: "NO_ELIGIBLE_PARTNER",
        assigned_store_id: winningStore.store_id,
        assigned_store_name: winningStore.store_name,
        assigned_zone_id: winningStore.zone_id,
        assigned_zone_name: winningStore.zone_name,
        assigned_partner_id: null,
        distance_km: winningStoreMatch.distanceKm,
        matched_rule: null,
        diagnostics_message: `Store "${winningStore.store_name}" covers coordinates (${winningStoreMatch.distanceKm} km), but no active delivery partner covers this area.`,
        evaluation_metadata: {
          store_id: winningStore.store_id,
          store_name: winningStore.store_name,
          zone_id: winningStore.zone_id,
        },
      };
    }

    // Sort matching partners deterministically:
    // 1. Partner Priority: DESC (higher integer wins)
    // 2. Fleet Type Tie-Breaker: OWN_FLEET (1) > COURIER (2) > 3PL_AGGREGATOR (3)
    // 3. Partner Rating: DESC
    // 4. Stable tie-breaker: partner_id ASC
    partnerMatches.sort((a, b) => {
      // 1. Partner Priority
      if (b.record.priority !== a.record.priority) {
        return b.record.priority - a.record.priority;
      }

      // 2. Fleet Type Preference
      const getFleetRank = (t: PartnerType) => {
        if (t === "OWN_FLEET") return 1;
        if (t === "COURIER") return 2;
        return 3; // 3PL_AGGREGATOR
      };
      const rankA = getFleetRank(a.record.partner_type);
      const rankB = getFleetRank(b.record.partner_type);
      if (rankA !== rankB) return rankA - rankB;

      // 3. Rating
      if (Math.abs(b.record.rating - a.record.rating) > 0.01) {
        return b.record.rating - a.record.rating;
      }

      // 4. Stable partner_id
      return a.record.partner_id.localeCompare(b.record.partner_id);
    });

    const winningPartner = partnerMatches[0].record;
    const ruleCode = `${winningStoreMatch.matchClass}_STORE_${winningPartner.partner_type}`;

    return {
      status: "ASSIGNED",
      reason_code: winningStoreMatch.matchClass === "POLYGON" ? "MATCHED_POLYGON" : "MATCHED_RADIUS",
      assigned_store_id: winningStore.store_id,
      assigned_store_name: winningStore.store_name,
      assigned_zone_id: winningStore.zone_id,
      assigned_zone_name: winningStore.zone_name,
      assigned_partner_id: winningPartner.partner_id,
      assigned_partner_name: winningPartner.partner_name,
      distance_km: winningStoreMatch.distanceKm,
      matched_rule: ruleCode,
      diagnostics_message: `Deterministically assigned to store "${winningStore.store_name}" (${winningStoreMatch.distanceKm} km via ${winningStoreMatch.matchClass}) and delivery partner "${winningPartner.partner_name}" (${winningPartner.partner_type}, priority ${winningPartner.priority}).`,
      evaluation_metadata: {
        store_id: winningStore.store_id,
        store_name: winningStore.store_name,
        zone_id: winningStore.zone_id,
        partner_id: winningPartner.partner_id,
        partner_name: winningPartner.partner_name,
        partner_type: winningPartner.partner_type,
        match_class: winningStoreMatch.matchClass,
        distance_km: winningStoreMatch.distanceKm,
      },
    };
  }

  // ── Batch Matching Pipeline & Atomic Persistence ───────────────────────────

  /**
   * Executes deterministic batch matching against persisted PostgreSQL geofences.
   * Atomically upserts assignment records and records append-only audit events.
   * Unchanged outcomes produce NO assignment churn and NO duplicate audit events (idempotent).
   */
  static async matchDeliveriesBatch(
    input: CorporateBatchMatchingInput,
    externalClient?: PoolClient
  ): Promise<CorporateBatchMatchingResult> {
    const startTime = Date.now();

    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      return {
        summary: {
          total_evaluated: 0,
          total_assigned: 0,
          total_unassigned: 0,
          unassigned_breakdown: {},
          evaluation_duration_ms: 0,
        },
        assignments: [],
      };
    }

    const actorId = input.actor_id || "SYSTEM_ROUTING_ENGINE";
    const actorRole = input.actor_role || "SYSTEM";

    // Internal execution handler running inside transaction
    const executeInTransaction = async (client: PoolClient): Promise<CorporateBatchMatchingResult> => {
      // 1. Load candidate store zones and partner coverages from PostgreSQL
      const candidateStores = await CorporateRoutingRepository.listCandidateStoreZones(client);
      const candidatePartners = await CorporateRoutingRepository.listCandidatePartnerCoverages(client);

      const assignmentsDTOs: CorporateDeliveryAssignmentDTO[] = [];
      const unassignedCounts: Record<string, number> = {};
      let totalAssigned = 0;
      let totalUnassigned = 0;

      // 2. Evaluate and persist each item
      for (const item of input.items) {
        const outcome = this.evaluateTarget(item, candidateStores, candidatePartners);

        if (outcome.status === "ASSIGNED") {
          totalAssigned++;
        } else {
          totalUnassigned++;
          unassignedCounts[outcome.reason_code] = (unassignedCounts[outcome.reason_code] || 0) + 1;
        }

        // Fetch existing assignment to evaluate idempotency
        const existing = await CorporateRoutingRepository.getAssignmentByEntity(
          item.entity_type,
          item.entity_id,
          client
        );

        const isPreservedOverride =
          existing !== null &&
          existing.status === "MANUAL_OVERRIDE" &&
          !input.force_reassign;

        if (isPreservedOverride && outcome.status !== "ASSIGNED") {
          totalUnassigned--;
          totalAssigned++;
          if (unassignedCounts[outcome.reason_code]) {
            unassignedCounts[outcome.reason_code]--;
          }
        }

        const isUnchanged =
          isPreservedOverride ||
          (existing !== null &&
            existing.status === outcome.status &&
            existing.reason_code === outcome.reason_code &&
            (existing.assigned_store_id || null) === (outcome.assigned_store_id || null) &&
            (existing.assigned_partner_id || null) === (outcome.assigned_partner_id || null) &&
            Math.abs(Number(existing.distance_km || 0) - Number(outcome.distance_km || 0)) < 0.01);

        let persistedRow: CorporateDeliveryAssignmentRow;

        if (isUnchanged) {
          // Idempotent: outcome is identical, no assignment churn, no audit event
          persistedRow = existing!;
        } else {
          // Ensure coordinates strictly satisfy chk_cda_coordinates constraint
          const hasValidCoords =
            outcome.reason_code !== "COORDINATES_INVALID" &&
            outcome.reason_code !== "COORDINATES_MISSING" &&
            typeof item.latitude === "number" &&
            typeof item.longitude === "number" &&
            item.latitude >= -90.0 &&
            item.latitude <= 90.0 &&
            item.longitude >= -180.0 &&
            item.longitude <= 180.0;
          const safeLat = hasValidCoords ? item.latitude : null;
          const safeLng = hasValidCoords ? item.longitude : null;

          // Mutate assignment
          persistedRow = await CorporateRoutingRepository.upsertAssignment(
            {
              id: existing?.id,
              entity_type: item.entity_type,
              entity_id: item.entity_id,
              account_id: item.account_id || null,
              recipient_name: item.recipient_name || null,
              recipient_phone: item.recipient_phone || null,
              delivery_address: item.delivery_address,
              delivery_city: item.delivery_city || null,
              normalized_city_key: this.normalizeCityKey(item.delivery_city),
              delivery_pincode: item.delivery_pincode || null,
              latitude: safeLat,
              longitude: safeLng,
              status: outcome.status,
              reason_code: outcome.reason_code,
              assigned_store_id: outcome.assigned_store_id,
              assigned_zone_id: outcome.assigned_zone_id,
              assigned_partner_id: outcome.assigned_partner_id,
              distance_km: outcome.distance_km,
              matched_rule: outcome.matched_rule,
              diagnostics_message: outcome.diagnostics_message,
              evaluation_metadata: outcome.evaluation_metadata,
              assigned_at: outcome.status === "ASSIGNED" ? new Date().toISOString() : null,
              assigned_by: actorId,
            },
            client
          );

          // Append audit event atomically
          const eventType: any = existing
            ? outcome.status === "ASSIGNED"
              ? "REASSIGNED"
              : "UNASSIGNED_TRIGGERED"
            : "BATCH_MATCHED";

          await CorporateRoutingRepository.insertAssignmentEvent(
            {
              assignment_id: persistedRow.id,
              event_type: eventType,
              actor_id: actorId,
              actor_role: actorRole,
              reason: existing
                ? `Automated geographic matching recalculated assignment: ${existing.status} -> ${outcome.status} (${outcome.reason_code})`
                : `Initial automated geographic matching: ${outcome.status} (${outcome.reason_code})`,
              before_state: existing
                ? {
                    status: existing.status,
                    reason_code: existing.reason_code,
                    store_id: existing.assigned_store_id,
                    partner_id: existing.assigned_partner_id,
                  }
                : null,
              after_state: {
                status: persistedRow.status,
                reason_code: persistedRow.reason_code,
                store_id: persistedRow.assigned_store_id,
                partner_id: persistedRow.assigned_partner_id,
              },
            },
            client
          );
        }

        // Synchronize assigned partner to persistent delivery record
        if (
          item.entity_type === "GIFTING_RECIPIENT" &&
          persistedRow.assigned_partner_id &&
          (persistedRow.status === "ASSIGNED" || persistedRow.status === "MANUAL_OVERRIDE")
        ) {
          await client.query(
            `UPDATE public.delivery d
             SET delivery_partner_id = $1,
                 delivery_status = CASE WHEN d.delivery_status = 'pending' THEN 'pickup_claimed' ELSE d.delivery_status END,
                 updated_at = NOW()
             FROM public.corporate_gifting_recipient cgr
             WHERE cgr.id = $2 AND (d.id = cgr.delivery_id OR d.id = ('del_' || cgr.id));`,
            [persistedRow.assigned_partner_id, item.entity_id]
          );
        }

        // Convert to DTO
        assignmentsDTOs.push({
          id: persistedRow.id,
          entity_type: persistedRow.entity_type,
          entity_id: persistedRow.entity_id,
          account_id: persistedRow.account_id,
          recipient_name: persistedRow.recipient_name,
          recipient_phone: persistedRow.recipient_phone,
          delivery_address: persistedRow.delivery_address,
          delivery_city: persistedRow.delivery_city,
          normalized_city_key: persistedRow.normalized_city_key,
          delivery_pincode: persistedRow.delivery_pincode,
          latitude: persistedRow.latitude !== null ? Number(persistedRow.latitude) : null,
          longitude: persistedRow.longitude !== null ? Number(persistedRow.longitude) : null,
          status: persistedRow.status,
          reason_code: persistedRow.reason_code,
          assigned_store_id: persistedRow.assigned_store_id,
          assigned_store_name: outcome.assigned_store_name || null,
          assigned_zone_id: persistedRow.assigned_zone_id,
          assigned_zone_name: outcome.assigned_zone_name || null,
          assigned_partner_id: persistedRow.assigned_partner_id,
          assigned_partner_name: outcome.assigned_partner_name || null,
          distance_km: persistedRow.distance_km !== null ? Number(persistedRow.distance_km) : null,
          matched_rule: persistedRow.matched_rule,
          diagnostics_message: persistedRow.diagnostics_message,
          evaluation_metadata: (persistedRow.evaluation_metadata as any) || {},
          assigned_at: persistedRow.assigned_at ? new Date(persistedRow.assigned_at).toISOString() : null,
          assigned_by: persistedRow.assigned_by,
          override_reason: persistedRow.override_reason,
          created_at: new Date(persistedRow.created_at).toISOString(),
          updated_at: new Date(persistedRow.updated_at).toISOString(),
        });
      }

      const summary: CorporateBatchMatchingSummary = {
        total_evaluated: input.items.length,
        total_assigned: totalAssigned,
        total_unassigned: totalUnassigned,
        unassigned_breakdown: unassignedCounts,
        evaluation_duration_ms: Date.now() - startTime,
      };

      return { summary, assignments: assignmentsDTOs };
    };

    if (externalClient) {
      return await executeInTransaction(externalClient);
    } else {
      return await dbTransaction(async (client) => {
        return await executeInTransaction(client);
      });
    }
  }

  /**
   * Phase C7.13: Evaluates and matches a single corporate delivery entity,
   * delegating to matchDeliveriesBatch inside transaction context.
   */
  static async matchSingleEntity(params: {
    item: CorporateBatchMatchingItemInput;
    actorId?: string;
    actorRole?: string;
    forceReassign?: boolean;
    client?: PoolClient;
  }): Promise<CorporateDeliveryAssignmentDTO> {
    const res = await this.matchDeliveriesBatch(
      {
        items: [params.item],
        actor_id: params.actorId,
        actor_role: params.actorRole,
        force_reassign: params.forceReassign,
      },
      params.client
    );
    if (!res.assignments || res.assignments.length === 0) {
      throw new Error(
        `Failed to match entity ${params.item.entity_type}:${params.item.entity_id}`
      );
    }
    return res.assignments[0];
  }

  // ── Phase C7.12: Super Admin Unresolved Review & Resolution ─────────────────

  /**
   * Helper to convert database row to domain DTO.
   */
  public static toAssignmentDTO(r: CorporateDeliveryAssignmentRow): CorporateDeliveryAssignmentDTO {
    return {
      id: r.id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      account_id: r.account_id,
      recipient_name: r.recipient_name,
      recipient_phone: r.recipient_phone,
      delivery_address: r.delivery_address,
      delivery_city: r.delivery_city,
      normalized_city_key: r.normalized_city_key,
      delivery_pincode: r.delivery_pincode,
      latitude: r.latitude !== null ? Number(r.latitude) : null,
      longitude: r.longitude !== null ? Number(r.longitude) : null,
      status: r.status,
      reason_code: r.reason_code,
      assigned_store_id: r.assigned_store_id,
      assigned_zone_id: r.assigned_zone_id,
      assigned_partner_id: r.assigned_partner_id,
      distance_km: r.distance_km !== null ? Number(r.distance_km) : null,
      matched_rule: r.matched_rule,
      diagnostics_message: r.diagnostics_message,
      evaluation_metadata: (r.evaluation_metadata as any) || {},
      assigned_at: r.assigned_at ? new Date(r.assigned_at).toISOString() : null,
      assigned_by: r.assigned_by,
      override_reason: r.override_reason,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  }

  /**
   * Evaluates and returns candidate stores and partners for an unresolved assignment.
   */
  static async getUnresolvedReviewCandidates(
    assignmentId: string,
    externalClient?: PoolClient
  ): Promise<UnresolvedReviewCandidatesResult> {
    const assignmentRow = await CorporateRoutingRepository.getAssignmentById(assignmentId, externalClient);
    if (!assignmentRow) {
      throw new Error(`Corporate delivery assignment "${assignmentId}" not found.`);
    }

    const candidateStores = await CorporateRoutingRepository.listCandidateStoreZones(externalClient);
    const candidatePartners = await CorporateRoutingRepository.listCandidatePartnerCoverages(externalClient);

    const assignmentDTO = this.toAssignmentDTO(assignmentRow);
    const lat = assignmentDTO.latitude;
    const lng = assignmentDTO.longitude;

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      return {
        assignment: assignmentDTO,
        can_match: false,
        reason_code: assignmentDTO.reason_code,
        diagnostics_message:
          "Cannot evaluate geographic candidates: Delivery address lacks valid GPS coordinates. Super Admin must correct coordinates first.",
        candidate_stores: [],
        candidate_partners: [],
      };
    }

    const storeReviews: CandidateStoreReview[] = [];

    for (const store of candidateStores) {
      const distKm = DeliveryCoverageService.calculateDistanceKm(
        lat,
        lng,
        store.store_latitude,
        store.store_longitude
      );

      let matchClass: "POLYGON" | "RADIUS" | "NONE" = "NONE";
      let isInsideExclusion = false;

      if (store.exclusion_polygons && store.exclusion_polygons.length > 0) {
        for (const excl of store.exclusion_polygons) {
          if (DeliveryCoverageService.isPointInPolygon(lat, lng, excl)) {
            isInsideExclusion = true;
            break;
          }
        }
      }

      if (!isInsideExclusion) {
        if (store.polygon_coordinates && store.polygon_coordinates.length >= 3) {
          if (DeliveryCoverageService.isPointInPolygon(lat, lng, store.polygon_coordinates)) {
            matchClass = "POLYGON";
          }
        }
        if (matchClass === "NONE" && store.radius_km && store.radius_km > 0) {
          const centerLat = store.center_latitude || store.store_latitude;
          const centerLng = store.center_longitude || store.store_longitude;
          const centerDist = DeliveryCoverageService.calculateDistanceKm(lat, lng, centerLat, centerLng);
          if (centerDist <= store.radius_km) {
            matchClass = "RADIUS";
          }
        }
      }

      storeReviews.push({
        store_id: store.store_id,
        store_name: store.store_name,
        store_code: store.store_code,
        is_open: Boolean(store.is_open),
        is_corporate_routing_eligible: Boolean(store.is_corporate_routing_eligible),
        distance_km: Math.round(distKm * 100) / 100,
        match_class: matchClass,
        is_inside_exclusion: isInsideExclusion,
        zone_id: store.zone_id || null,
        zone_name: store.zone_name || null,
        zone_priority: store.zone_priority || 0,
      });
    }

    storeReviews.sort((a, b) => {
      if (a.match_class !== "NONE" && b.match_class === "NONE") return -1;
      if (a.match_class === "NONE" && b.match_class !== "NONE") return 1;
      if (a.is_corporate_routing_eligible && !b.is_corporate_routing_eligible) return -1;
      if (!a.is_corporate_routing_eligible && b.is_corporate_routing_eligible) return 1;
      return a.distance_km - b.distance_km;
    });

    const partnerReviews: CandidatePartnerReview[] = candidatePartners.map((p) => ({
      partner_id: p.partner_id,
      partner_name: p.partner_name,
      partner_type: p.partner_type,
      profile_status: p.profile_status,
      rating: p.rating,
      priority: p.priority,
      is_active: p.is_active,
    }));

    const outcome = this.evaluateTarget(
      {
        entity_type: assignmentRow.entity_type,
        entity_id: assignmentRow.entity_id,
        delivery_address: assignmentRow.delivery_address,
        latitude: lat,
        longitude: lng,
      },
      candidateStores,
      candidatePartners
    );

    return {
      assignment: assignmentDTO,
      can_match: outcome.status === "ASSIGNED",
      reason_code: outcome.reason_code,
      diagnostics_message: outcome.diagnostics_message,
      candidate_stores: storeReviews,
      candidate_partners: partnerReviews,
    };
  }

  /**
   * Resolves an unresolved corporate delivery assignment with strict validation,
   * transaction isolation, idempotency protection, and append-only audit trail.
   */
  static async resolveUnresolvedAssignment(
    input: ResolveUnresolvedInput,
    externalClient?: PoolClient
  ): Promise<ResolveActionResult> {
    const handler = async (client: PoolClient): Promise<ResolveActionResult> => {
      const existing = await CorporateRoutingRepository.getAssignmentById(input.assignment_id, client);
      if (!existing) {
        throw new Error(`Corporate delivery assignment "${input.assignment_id}" not found.`);
      }

      const beforeState = {
        status: existing.status,
        reason_code: existing.reason_code,
        store_id: existing.assigned_store_id,
        partner_id: existing.assigned_partner_id,
        latitude: existing.latitude,
        longitude: existing.longitude,
        override_reason: existing.override_reason,
      };

      // ── 1. Action: CORRECT_COORDINATES ─────────────────────────────────────
      if (input.action === "CORRECT_COORDINATES") {
        if (
          input.latitude === undefined ||
          input.latitude === null ||
          isNaN(Number(input.latitude)) ||
          input.longitude === undefined ||
          input.longitude === null ||
          isNaN(Number(input.longitude))
        ) {
          throw new Error("Valid numerical latitude and longitude are required for CORRECT_COORDINATES.");
        }
        const lat = Number(input.latitude);
        const lng = Number(input.longitude);
        if (lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) {
          throw new Error(
            `Coordinates [${lat}, ${lng}] are out of valid geographic range [-90..90, -180..180].`
          );
        }

        // Idempotency check: identical coordinates already persisted and assigned
        if (
          existing.latitude !== null &&
          existing.longitude !== null &&
          Math.abs(Number(existing.latitude) - lat) < 0.000001 &&
          Math.abs(Number(existing.longitude) - lng) < 0.000001 &&
          existing.status === "ASSIGNED"
        ) {
          return {
            success: true,
            assignment: this.toAssignmentDTO(existing),
            action_taken: "CORRECT_COORDINATES",
            idempotent: true,
            message: "Coordinates and assignment outcome are already up to date.",
          };
        }

        const candidateStores = await CorporateRoutingRepository.listCandidateStoreZones(client);
        const candidatePartners = await CorporateRoutingRepository.listCandidatePartnerCoverages(client);

        const targetInput: CorporateBatchMatchingItemInput = {
          entity_type: existing.entity_type,
          entity_id: existing.entity_id,
          account_id: existing.account_id,
          recipient_name: existing.recipient_name,
          recipient_phone: existing.recipient_phone,
          delivery_address: input.delivery_address || existing.delivery_address,
          delivery_city: existing.delivery_city,
          delivery_pincode: existing.delivery_pincode,
          latitude: lat,
          longitude: lng,
        };

        const outcome = this.evaluateTarget(targetInput, candidateStores, candidatePartners);

        const updatedRow = await CorporateRoutingRepository.updateAssignmentResolution(
          {
            id: existing.id,
            status: outcome.status,
            reason_code: outcome.reason_code,
            assigned_store_id: outcome.assigned_store_id,
            assigned_zone_id: outcome.assigned_zone_id,
            assigned_partner_id: outcome.assigned_partner_id,
            distance_km: outcome.distance_km,
            matched_rule: outcome.matched_rule,
            diagnostics_message: outcome.diagnostics_message,
            evaluation_metadata: outcome.evaluation_metadata,
            latitude: lat,
            longitude: lng,
            delivery_address: input.delivery_address || existing.delivery_address,
            assigned_at: outcome.status === "ASSIGNED" ? new Date() : null,
            assigned_by: input.actor_id,
            override_reason: input.override_reason || "Coordinates corrected by Super Admin and re-evaluated.",
          },
          client
        );

        const eventType = outcome.status === "ASSIGNED" ? "REASSIGNED" : "UNASSIGNED_TRIGGERED";
        const event = await CorporateRoutingRepository.insertAssignmentEvent(
          {
            assignment_id: existing.id,
            event_type: eventType,
            actor_id: input.actor_id,
            actor_role: input.actor_role,
            reason:
              input.override_reason ||
              `Coordinates updated to [${lat}, ${lng}]. Re-evaluated outcome: ${outcome.status} (${outcome.reason_code})`,
            before_state: beforeState,
            after_state: {
              status: updatedRow.status,
              reason_code: updatedRow.reason_code,
              store_id: updatedRow.assigned_store_id,
              partner_id: updatedRow.assigned_partner_id,
              latitude: updatedRow.latitude,
              longitude: updatedRow.longitude,
            },
          },
          client
        );

        // Synchronize delivery record if GIFTING_RECIPIENT
        if (
          existing.entity_type === "GIFTING_RECIPIENT" &&
          updatedRow.assigned_partner_id &&
          (updatedRow.status === "ASSIGNED" || updatedRow.status === "MANUAL_OVERRIDE")
        ) {
          await client.query(
            `UPDATE public.delivery d
             SET delivery_partner_id = $1,
                 delivery_status = CASE WHEN d.delivery_status = 'pending' THEN 'pickup_claimed' ELSE d.delivery_status END,
                 updated_at = NOW()
             FROM public.corporate_gifting_recipient cgr
             WHERE cgr.id = $2 AND (d.id = cgr.delivery_id OR d.id = ('del_' || cgr.id));`,
            [updatedRow.assigned_partner_id, existing.entity_id]
          );
        }

        return {
          success: true,
          assignment: this.toAssignmentDTO(updatedRow),
          action_taken: "CORRECT_COORDINATES",
          idempotent: false,
          event_id: event.id,
          message: `Coordinates updated. Assignment state: ${updatedRow.status} (${updatedRow.reason_code}).`,
        };
      }

      // ── 2. Action: MANUAL_ASSIGN ───────────────────────────────────────────
      if (input.action === "MANUAL_ASSIGN") {
        if (!input.store_id || input.store_id.trim() === "") {
          throw new Error("Store ID is required for MANUAL_ASSIGN.");
        }
        if (!input.override_reason || input.override_reason.trim().length < 5) {
          throw new Error(
            "A detailed override_reason (minimum 5 characters) is required for MANUAL_ASSIGN."
          );
        }

        // Idempotency check
        if (
          existing.status === "MANUAL_OVERRIDE" &&
          existing.assigned_store_id === input.store_id.trim() &&
          (existing.assigned_partner_id || null) === (input.partner_id ? input.partner_id.trim() : null) &&
          existing.override_reason === input.override_reason.trim()
        ) {
          return {
            success: true,
            assignment: this.toAssignmentDTO(existing),
            action_taken: "MANUAL_ASSIGN",
            idempotent: true,
            message: "Assignment is already manually assigned to the requested store and partner.",
          };
        }

        const storeRes = await client.query(
          "SELECT id, name, is_corporate_routing_eligible FROM public.branch WHERE id = $1 AND deleted_at IS NULL LIMIT 1;",
          [input.store_id.trim()]
        );
        if (storeRes.rows.length === 0) {
          throw new Error(`Store "${input.store_id}" not found or inactive.`);
        }

        if (input.partner_id && input.partner_id.trim() !== "") {
          const partnerRes = await client.query(
            "SELECT id, first_name, last_name FROM public.delivery_partner WHERE id = $1 AND deleted_at IS NULL LIMIT 1;",
            [input.partner_id.trim()]
          );
          if (partnerRes.rows.length === 0) {
            throw new Error(`Delivery partner "${input.partner_id}" not found or inactive.`);
          }
        }

        const updatedRow = await CorporateRoutingRepository.updateAssignmentResolution(
          {
            id: existing.id,
            status: "MANUAL_OVERRIDE",
            reason_code: "MANUAL_OVERRIDE",
            assigned_store_id: input.store_id.trim(),
            assigned_partner_id: input.partner_id ? input.partner_id.trim() : null,
            matched_rule: "SUPER_ADMIN_MANUAL_OVERRIDE",
            diagnostics_message: `Manually assigned by Super Admin: ${input.override_reason.trim()}`,
            assigned_at: new Date(),
            assigned_by: input.actor_id,
            override_reason: input.override_reason.trim(),
          },
          client
        );

        const event = await CorporateRoutingRepository.insertAssignmentEvent(
          {
            assignment_id: existing.id,
            event_type: "MANUALLY_OVERRIDDEN",
            actor_id: input.actor_id,
            actor_role: input.actor_role,
            reason: input.override_reason.trim(),
            before_state: beforeState,
            after_state: {
              status: updatedRow.status,
              reason_code: updatedRow.reason_code,
              store_id: updatedRow.assigned_store_id,
              partner_id: updatedRow.assigned_partner_id,
              override_reason: updatedRow.override_reason,
            },
          },
          client
        );

        // Synchronize delivery record if GIFTING_RECIPIENT
        if (existing.entity_type === "GIFTING_RECIPIENT" && updatedRow.assigned_partner_id) {
          await client.query(
            `UPDATE public.delivery d
             SET delivery_partner_id = $1,
                 delivery_status = CASE WHEN d.delivery_status = 'pending' THEN 'pickup_claimed' ELSE d.delivery_status END,
                 updated_at = NOW()
             FROM public.corporate_gifting_recipient cgr
             WHERE cgr.id = $2 AND (d.id = cgr.delivery_id OR d.id = ('del_' || cgr.id));`,
            [updatedRow.assigned_partner_id, existing.entity_id]
          );
        }

        return {
          success: true,
          assignment: this.toAssignmentDTO(updatedRow),
          action_taken: "MANUAL_ASSIGN",
          idempotent: false,
          event_id: event.id,
          message: `Assignment manually resolved to store "${storeRes.rows[0].name}".`,
        };
      }

      // ── 3. Action: MARK_PENDING_REVIEW ─────────────────────────────────────
      if (input.action === "MARK_PENDING_REVIEW") {
        if (existing.status === "PENDING_REVIEW") {
          return {
            success: true,
            assignment: this.toAssignmentDTO(existing),
            action_taken: "MARK_PENDING_REVIEW",
            idempotent: true,
            message: "Assignment is already marked as PENDING_REVIEW.",
          };
        }

        const note = input.override_reason || "Marked pending client address verification.";
        const updatedRow = await CorporateRoutingRepository.updateAssignmentResolution(
          {
            id: existing.id,
            status: "PENDING_REVIEW",
            reason_code: existing.reason_code,
            override_reason: note,
            assigned_by: input.actor_id,
          },
          client
        );

        const event = await CorporateRoutingRepository.insertAssignmentEvent(
          {
            assignment_id: existing.id,
            event_type: "UNASSIGNED_TRIGGERED",
            actor_id: input.actor_id,
            actor_role: input.actor_role,
            reason: note,
            before_state: beforeState,
            after_state: {
              status: updatedRow.status,
              reason_code: updatedRow.reason_code,
              override_reason: updatedRow.override_reason,
            },
          },
          client
        );

        return {
          success: true,
          assignment: this.toAssignmentDTO(updatedRow),
          action_taken: "MARK_PENDING_REVIEW",
          idempotent: false,
          event_id: event.id,
          message: "Assignment held in PENDING_REVIEW.",
        };
      }

      throw new Error(`Unsupported resolution action "${input.action}".`);
    };

    if (externalClient) {
      return await handler(externalClient);
    } else {
      return await dbTransaction(async (client) => {
        return await handler(client);
      });
    }
  }
}

