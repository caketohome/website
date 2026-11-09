/**
 * CakeToHome ERP — Delivery Coverage Domain Service
 * Phase C7.10: Map-Fenced Store & Delivery-Partner Coverage Configuration
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. PURE GEOMETRY AUTHORITY: Ray-casting Point-in-Polygon (PIP) and Haversine distance
 *    are authoritative. String locality, city names, and PIN codes are never used as substitutes.
 * 2. STRICT FAIL-CLOSED ROUTING: Corporate delivery resolution strictly fails closed if
 *    GPS coordinates are missing, store is not on the corporate allow-list, point falls in
 *    exclusion zone, or no active partner covers the location. Zero fallback to Indiranagar or operational[0].
 * 3. 3-TIER RADIUS HIERARCHY: Global safety ceiling (25 km) strictly bounds all stores and zones.
 * 4. AUDIT COMPLIANCE: All configuration mutations are validated before persistence and audited.
 */

import { DeliveryCoverageRepository } from "../repositories/delivery-coverage.repository";
import type {
  PolygonCoordinate,
  CoveragePointValidationQuery,
  CoveragePointValidationResult,
  CorporateCoverageResolutionQuery,
  CorporateCoverageResolutionResult,
  SetBranchEligibilityInput,
  UpsertStoreZoneInput,
  UpsertPartnerProfileInput,
  UpsertPartnerCoverageInput,
  DeliveryZoneExtendedDTO,
  DeliveryPartnerProfileDTO,
  DeliveryPartnerCoverageDTO,
} from "../types/delivery-coverage.types";

export const GLOBAL_MAX_DELIVERY_RADIUS_KM = 25.0;

export class DeliveryCoverageService {
  // ── Pure Geometry Mathematics ───────────────────────────────────────────────

  /**
   * Ray-Casting Point-in-Polygon (Jordan Curve Theorem)
   * Validates whether a given (lat, lng) point is strictly inside a closed polygon.
   */
  static isPointInPolygon(lat: number, lng: number, polygon: PolygonCoordinate[]): boolean {
    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;
    let isInside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const ptI = polygon[i];
      const ptJ = polygon[j];

      const xi = Array.isArray(ptI) ? ptI[0] : ((ptI as any).lat ?? (ptI as any).latitude ?? 0);
      const yi = Array.isArray(ptI) ? ptI[1] : ((ptI as any).lng ?? (ptI as any).longitude ?? 0);
      const xj = Array.isArray(ptJ) ? ptJ[0] : ((ptJ as any).lat ?? (ptJ as any).latitude ?? 0);
      const yj = Array.isArray(ptJ) ? ptJ[1] : ((ptJ as any).lng ?? (ptJ as any).longitude ?? 0);

      const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
      if (intersect) isInside = !isInside;
    }
    return isInside;
  }

  /**
   * Spherical Haversine Distance (in kilometers, 2 decimal places)
   */
  static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Normalizes and validates coordinate vertices for polygon input.
   * Ensures >= 3 vertices and coordinates within -90..90 and -180..180.
   */
  static validateAndNormalizePolygon(coords?: PolygonCoordinate[] | null): Array<[number, number]> | null {
    if (!coords || !Array.isArray(coords) || coords.length === 0) return null;
    if (coords.length < 3) {
      throw new Error(`MALFORMED_POLYGON: A delivery fence polygon must contain at least 3 vertices (received ${coords.length}).`);
    }

    const normalized: Array<[number, number]> = [];
    for (let idx = 0; idx < coords.length; idx++) {
      const pt = coords[idx];
      const lat = Array.isArray(pt) ? pt[0] : ((pt as any).lat ?? (pt as any).latitude);
      const lng = Array.isArray(pt) ? pt[1] : ((pt as any).lng ?? (pt as any).longitude);

      if (typeof lat !== "number" || isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) {
        throw new Error(`INVALID_COORDINATE: Vertex #${idx + 1} has invalid latitude (${lat}). Must be between -90 and 90.`);
      }
      if (typeof lng !== "number" || isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180) {
        throw new Error(`INVALID_COORDINATE: Vertex #${idx + 1} has invalid longitude (${lng}). Must be between -180 and 180.`);
      }

      normalized.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
    }
    return normalized;
  }

  // ── Store & Zone Management ─────────────────────────────────────────────────

  static async listStoresSummary() {
    return await DeliveryCoverageRepository.listStoresSummary();
  }

  static async setBranchEligibility(input: SetBranchEligibilityInput) {
    if (!input.branch_id) throw new Error("Branch ID is required.");
    if (!input.reason || input.reason.trim().length < 5) {
      throw new Error("A valid reason (minimum 5 characters) is required when changing corporate routing eligibility.");
    }
    return await DeliveryCoverageRepository.setBranchEligibility(input);
  }

  static async getBranchZones(branchId: string) {
    if (!branchId) throw new Error("Branch ID is required.");
    return await DeliveryCoverageRepository.getBranchZones(branchId);
  }

  static async upsertDeliveryZone(input: UpsertStoreZoneInput) {
    if (!input.branch_id) throw new Error("Branch ID is required.");
    if (!input.name || input.name.trim().length === 0) throw new Error("Zone name is required.");

    // Validate Radius Ceiling
    if (input.radius_km !== undefined && input.radius_km !== null) {
      if (input.radius_km <= 0) throw new Error("Radius must be greater than 0 km.");
      if (input.radius_km > GLOBAL_MAX_DELIVERY_RADIUS_KM) {
        throw new Error(
          `RADIUS_EXCEEDS_ALLOWED_LIMIT: Configured radius (${input.radius_km} km) exceeds global safety ceiling (${GLOBAL_MAX_DELIVERY_RADIUS_KM} km).`
        );
      }
    }

    // Validate Polygons if provided
    let normPoly: Array<[number, number]> | null = null;
    if (input.polygon_coordinates && input.polygon_coordinates.length > 0) {
      normPoly = this.validateAndNormalizePolygon(input.polygon_coordinates);
    }

    // Validate Exclusion Polygons
    let normExclusions: Array<Array<[number, number]>> | null = null;
    if (input.exclusion_polygons && input.exclusion_polygons.length > 0) {
      normExclusions = [];
      for (const ex of input.exclusion_polygons) {
        const validatedEx = this.validateAndNormalizePolygon(ex);
        if (validatedEx) normExclusions.push(validatedEx);
      }
    }

    return await DeliveryCoverageRepository.upsertDeliveryZone({
      ...input,
      polygon_coordinates: normPoly || undefined,
      exclusion_polygons: normExclusions || undefined,
    });
  }

  static async deactivateDeliveryZone(zoneId: string, actorId: string, actorRole: string, reason: string) {
    if (!zoneId) throw new Error("Zone ID is required.");
    return await DeliveryCoverageRepository.deactivateDeliveryZone(zoneId, actorId, actorRole, reason);
  }

  // ── Delivery Partner Management ─────────────────────────────────────────────

  static async listDeliveryPartners() {
    return await DeliveryCoverageRepository.listDeliveryPartners();
  }

  static async getDeliveryPartnerProfile(partnerId: string) {
    if (!partnerId) throw new Error("Partner ID is required.");
    return await DeliveryCoverageRepository.getPartnerProfile(partnerId);
  }

  static async upsertDeliveryPartnerProfile(input: UpsertPartnerProfileInput) {
    if (!input.partner_id) throw new Error("Partner ID is required.");
    if (input.max_concurrent_orders !== undefined) {
      if (input.max_concurrent_orders <= 0 || input.max_concurrent_orders > 50) {
        throw new Error("Maximum concurrent orders must be between 1 and 50.");
      }
    }
    return await DeliveryCoverageRepository.upsertPartnerProfile(input);
  }

  static async getDeliveryPartnerCoverage(partnerId: string) {
    if (!partnerId) throw new Error("Partner ID is required.");
    return await DeliveryCoverageRepository.getPartnerCoverage(partnerId);
  }

  static async upsertDeliveryPartnerCoverage(input: UpsertPartnerCoverageInput) {
    if (!input.partner_id) throw new Error("Partner ID is required.");
    if (!input.branch_id) throw new Error("Branch ID is required.");

    if (input.radius_km !== undefined && input.radius_km !== null) {
      if (input.radius_km <= 0) throw new Error("Radius must be greater than 0 km.");
      if (input.radius_km > GLOBAL_MAX_DELIVERY_RADIUS_KM) {
        throw new Error(
          `RADIUS_EXCEEDS_ALLOWED_LIMIT: Partner radius (${input.radius_km} km) exceeds safety ceiling (${GLOBAL_MAX_DELIVERY_RADIUS_KM} km).`
        );
      }
    }

    let normPoly: Array<[number, number]> | null = null;
    if (input.polygon_coordinates && input.polygon_coordinates.length > 0) {
      normPoly = this.validateAndNormalizePolygon(input.polygon_coordinates);
    }

    return await DeliveryCoverageRepository.upsertPartnerCoverage({
      ...input,
      polygon_coordinates: normPoly || undefined,
    });
  }

  // ── Diagnostic Point Validation Probe ───────────────────────────────────────

  /**
   * Diagnostic probe testing a given coordinate against store zones and delivery-partner geofences.
   * Strictly evaluates geometry and returns detailed diagnostic report.
   */
  static async validateCoveragePoint(query: CoveragePointValidationQuery): Promise<CoveragePointValidationResult> {
    const { latitude: lat, longitude: lng, branch_id: targetBranchId } = query;

    // 1. Strict Coordinate Bounds Validation
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      lat === 999.999 ||
      lng === 999.999
    ) {
      return {
        latitude: lat,
        longitude: lng,
        serviceable: false,
        reason_code: "INVALID_COORDINATES",
        matched_store: null,
        matched_partners: [],
        evaluated_stores_count: 0,
        evaluated_zones_count: 0,
        inside_exclusion: false,
        diagnostics_message: "Coordinates are missing or outside valid geographic range (-90..90, -180..180).",
      };
    }

    const stores = await DeliveryCoverageRepository.listStoresSummary();
    const candidateStores = targetBranchId ? stores.filter((s) => s.id === targetBranchId) : stores;

    let evaluatedStores = 0;
    let evaluatedZones = 0;
    let insideExclusion = false;

    interface StoreMatch {
      store: (typeof stores)[0];
      zone: DeliveryZoneExtendedDTO;
      distanceKm: number;
    }
    const matchedStores: StoreMatch[] = [];

    for (const store of candidateStores) {
      if (!store.is_open) continue;
      evaluatedStores++;

      const zones = await DeliveryCoverageRepository.getBranchZones(store.id);
      for (const zone of zones) {
        if (!zone.is_serviceable) continue;
        evaluatedZones++;

        // 1. Exclusion Polygons Check
        if (zone.exclusion_polygons && Array.isArray(zone.exclusion_polygons)) {
          for (const exPoly of zone.exclusion_polygons) {
            if (this.isPointInPolygon(lat, lng, exPoly)) {
              insideExclusion = true;
              break;
            }
          }
          if (insideExclusion) continue;
        }

        // 2. Polygon Match Check
        let zoneMatched = false;
        if (zone.polygon_coordinates && Array.isArray(zone.polygon_coordinates) && zone.polygon_coordinates.length >= 3) {
          if (this.isPointInPolygon(lat, lng, zone.polygon_coordinates)) {
            zoneMatched = true;
          }
        }

        // 3. Radius Check (if polygon not defined or HYBRID)
        const distToStore = this.calculateDistanceKm(store.latitude, store.longitude, lat, lng);
        if (zone.radius_km && (!zone.polygon_coordinates || zoneMatched)) {
          if (distToStore <= zone.radius_km) {
            zoneMatched = true;
          } else if (zone.polygon_coordinates) {
            // HYBRID constraint: must satisfy both polygon AND radius
            zoneMatched = false;
          }
        }

        if (zoneMatched) {
          matchedStores.push({ store, zone, distanceKm: distToStore });
          break; // Match highest priority zone for this store
        }
      }
    }

    if (insideExclusion) {
      return {
        latitude: lat,
        longitude: lng,
        serviceable: false,
        reason_code: "INSIDE_EXCLUSION_ZONE",
        matched_store: null,
        matched_partners: [],
        evaluated_stores_count: evaluatedStores,
        evaluated_zones_count: evaluatedZones,
        inside_exclusion: true,
        diagnostics_message: "Location falls within a restricted delivery exclusion polygon.",
      };
    }

    if (matchedStores.length === 0) {
      return {
        latitude: lat,
        longitude: lng,
        serviceable: false,
        reason_code: "NO_ELIGIBLE_STORE",
        matched_store: null,
        matched_partners: [],
        evaluated_stores_count: evaluatedStores,
        evaluated_zones_count: evaluatedZones,
        inside_exclusion: false,
        diagnostics_message: "No operating bakery store covers this location.",
      };
    }

    // Sort by geographic distance ASC, tie-breaking by zone priority DESC
    matchedStores.sort((a, b) => a.distanceKm - b.distanceKm || b.zone.priority - a.zone.priority);
    const selectedStoreMatch = matchedStores[0];

    // Evaluate Delivery Partners for Candidate Store
    const allPartners = await DeliveryCoverageRepository.listDeliveryPartners();
    const activePartners = allPartners.filter((p) => p.status === "ACTIVE");

    const matchedPartners: CoveragePointValidationResult["matched_partners"] = [];
    for (const partner of activePartners) {
      const coverages = await DeliveryCoverageRepository.getPartnerCoverage(partner.partner_id);
      const branchCoverage = coverages.filter((c) => c.branch_id === selectedStoreMatch.store.id && c.is_active);

      for (const cov of branchCoverage) {
        let partnerMatch = false;

        // Polygon check
        if (cov.polygon_coordinates && cov.polygon_coordinates.length >= 3) {
          if (this.isPointInPolygon(lat, lng, cov.polygon_coordinates)) {
            partnerMatch = true;
          }
        }

        // Radius check
        const distToCenter = cov.center_latitude && cov.center_longitude
          ? this.calculateDistanceKm(cov.center_latitude, cov.center_longitude, lat, lng)
          : selectedStoreMatch.distanceKm;

        if (cov.radius_km && (!cov.polygon_coordinates || partnerMatch)) {
          if (distToCenter <= cov.radius_km) {
            partnerMatch = true;
          } else if (cov.polygon_coordinates && cov.polygon_coordinates.length >= 3) {
            partnerMatch = false; // Hybrid requires both
          }
        }

        if (partnerMatch) {
          matchedPartners.push({
            partner_id: partner.partner_id,
            partner_name: partner.partner_name,
            partner_type: partner.partner_type,
            priority: cov.priority,
            fence_type: cov.fence_type,
            distance_km: distToCenter,
          });
          break;
        }
      }
    }

    // Sort partners by priority DESC, then distance ASC
    matchedPartners.sort((a, b) => b.priority - a.priority || a.distance_km - b.distance_km);

    return {
      latitude: lat,
      longitude: lng,
      serviceable: true,
      reason_code: "MATCHED",
      matched_store: {
        id: selectedStoreMatch.store.id,
        name: selectedStoreMatch.store.name,
        code: selectedStoreMatch.store.code,
        distance_km: selectedStoreMatch.distanceKm,
        zone_id: selectedStoreMatch.zone.id,
        zone_name: selectedStoreMatch.zone.name || "Standard Zone",
        is_corporate_routing_eligible: selectedStoreMatch.store.is_corporate_routing_eligible,
      },
      matched_partners: matchedPartners,
      evaluated_stores_count: evaluatedStores,
      evaluated_zones_count: evaluatedZones,
      inside_exclusion: false,
      diagnostics_message: `Matched store "${selectedStoreMatch.store.name}" (${selectedStoreMatch.distanceKm} km) with ${matchedPartners.length} active delivery partners.`,
    };
  }

  // ── Authoritative Corporate Routing Resolver (STRICTLY FAIL-CLOSED) ────────

  /**
   * Dedicated Corporate Delivery Routing Resolver.
   * CRITICAL SAFEGUARD: Never calls PATH B or locality fallbacks.
   * Requires verified GPS coordinates and only considers stores with is_corporate_routing_eligible = true.
   */
  static async resolveCorporateDeliveryCoverage(
    query: CorporateCoverageResolutionQuery
  ): Promise<CorporateCoverageResolutionResult> {
    const { latitude: lat, longitude: lng, branch_id: targetBranchId } = query as any;

    // Rule 1: Reject missing, NaN, or sentinel coordinates
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      lat === 999.999 ||
      lng === 999.999
    ) {
      return {
        resolved: false,
        reason_code: "INVALID_COORDINATES",
        store: null,
        partner: null,
        distance_km: null,
        message: "Corporate routing requires verified GPS coordinates. Location cannot be resolved from text.",
      };
    }

    // Run authoritative diagnostic validation
    const validation = await this.validateCoveragePoint({ latitude: lat, longitude: lng, branch_id: targetBranchId });

    if (!validation.serviceable || !validation.matched_store) {
      return {
        resolved: false,
        reason_code: validation.reason_code as any,
        store: null,
        partner: null,
        distance_km: null,
        message: validation.diagnostics_message,
      };
    }

    // Rule 2: Store MUST be explicitly flagged as corporate-routing eligible
    if (!validation.matched_store.is_corporate_routing_eligible) {
      return {
        resolved: false,
        reason_code: "STORE_NOT_VERIFIED",
        store: {
          id: validation.matched_store.id,
          name: validation.matched_store.name,
          code: validation.matched_store.code,
          distance_km: validation.matched_store.distance_km,
          zone_id: validation.matched_store.zone_id,
        },
        partner: null,
        distance_km: validation.matched_store.distance_km,
        message: `Candidate store "${validation.matched_store.name}" is not verified for corporate routing. Pending Super Admin verification.`,
      };
    }

    // Rule 3: Must have at least one active delivery partner
    if (validation.matched_partners.length === 0) {
      return {
        resolved: false,
        reason_code: "NO_ELIGIBLE_PARTNER",
        store: {
          id: validation.matched_store.id,
          name: validation.matched_store.name,
          code: validation.matched_store.code,
          distance_km: validation.matched_store.distance_km,
          zone_id: validation.matched_store.zone_id,
        },
        partner: null,
        distance_km: validation.matched_store.distance_km,
        message: `Store "${validation.matched_store.name}" covers coordinates (${validation.matched_store.distance_km} km), but no active delivery partner covers this area.`,
      };
    }

    const selectedPartner = validation.matched_partners[0];

    return {
      resolved: true,
      reason_code: "RESOLVED",
      store: {
        id: validation.matched_store.id,
        name: validation.matched_store.name,
        code: validation.matched_store.code,
        distance_km: validation.matched_store.distance_km,
        zone_id: validation.matched_store.zone_id,
      },
      partner: {
        id: selectedPartner.partner_id,
        name: selectedPartner.partner_name,
        partner_type: selectedPartner.partner_type,
        priority: selectedPartner.priority,
      },
      distance_km: validation.matched_store.distance_km,
      message: `Authoritatively resolved store "${validation.matched_store.name}" (${validation.matched_store.distance_km} km) with delivery partner "${selectedPartner.partner_name}".`,
    };
  }

  // ── Audit Events ────────────────────────────────────────────────────────────

  static async listCoverageEvents(limit: number = 50, offset: number = 0, entityType?: string) {
    return await DeliveryCoverageRepository.listCoverageEvents(limit, offset, entityType);
  }
}
