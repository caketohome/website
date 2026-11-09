/**
 * CakeToHome ERP — Delivery Coverage & Partner Geofence Types
 * Phase C7.10: Map-Fenced Store & Delivery-Partner Coverage Configuration
 */

export type PartnerType = "OWN_FLEET" | "COURIER" | "3PL_AGGREGATOR";
export type PartnerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type FenceType = "POLYGON" | "RADIUS" | "HYBRID";

export type CoverageEventType =
  | "ZONE_CREATED"
  | "ZONE_UPDATED"
  | "ZONE_DEACTIVATED"
  | "EXCLUSION_MODIFIED"
  | "ELIGIBILITY_TOGGLED"
  | "PARTNER_PROFILE_CREATED"
  | "PARTNER_PROFILE_UPDATED"
  | "PARTNER_COVERAGE_CREATED"
  | "PARTNER_COVERAGE_UPDATED"
  | "PARTNER_COVERAGE_DEACTIVATED";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type CoordinateTuple = [number, number];
export type PolygonCoordinate = CoordinateTuple | LatLngPoint | { latitude: number; longitude: number };

// ── Database Row Interfaces ──────────────────────────────────────────────────

export interface DeliveryPartnerProfileRow {
  id: string;
  partner_id: string;
  partner_type: PartnerType;
  status: PartnerStatus;
  primary_branch_id: string | null;
  max_concurrent_orders: number;
  rating: number | string | null;
  contract_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DeliveryPartnerCoverageRow {
  id: string;
  partner_id: string;
  branch_id: string;
  fence_type: FenceType;
  polygon_coordinates: PolygonCoordinate[] | null;
  radius_km: number | string | null;
  center_latitude: number | string | null;
  center_longitude: number | string | null;
  priority: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DeliveryCoverageEventRow {
  id: string;
  entity_type: "STORE_ZONE" | "PARTNER_COVERAGE" | "STORE_ELIGIBILITY";
  entity_id: string;
  event_type: CoverageEventType;
  actor_id: string;
  actor_role: string;
  reason: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: Date | string;
}

// ── DTOs & Domain View Models ────────────────────────────────────────────────

export interface DeliveryPartnerProfileDTO {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  partner_phone: string;
  partner_type: PartnerType;
  status: PartnerStatus;
  primary_branch_id: string | null;
  primary_branch_name?: string | null;
  max_concurrent_orders: number;
  rating: number;
  contract_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartnerCoverageDTO {
  id: string;
  partner_id: string;
  partner_name?: string;
  branch_id: string;
  branch_name?: string;
  fence_type: FenceType;
  polygon_coordinates: Array<[number, number]>;
  radius_km: number | null;
  center_latitude: number | null;
  center_longitude: number | null;
  priority: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoreCoverageSummaryDTO {
  id: string;
  name: string;
  code: string;
  is_open: boolean;
  is_corporate_routing_eligible: boolean;
  city_name: string | null;
  latitude: number;
  longitude: number;
  zones_count: number;
  polygon_zones_count: number;
  radius_zones_count: number;
  has_exclusions: boolean;
  active_partners_count: number;
}

export interface DeliveryZoneExtendedDTO {
  id: string;
  branch_id: string;
  name: string | null;
  pincode: string;
  delivery_fee: number;
  is_serviceable: boolean;
  polygon_coordinates: Array<[number, number]> | null;
  exclusion_polygons: Array<Array<[number, number]>> | null;
  radius_km: number | null;
  center_latitude: number | null;
  center_longitude: number | null;
  priority: number;
  estimated_delivery_minutes: number;
  created_at: string;
  updated_at: string;
}

// ── Mutation Inputs ──────────────────────────────────────────────────────────

export interface SetBranchEligibilityInput {
  branch_id: string;
  is_eligible: boolean;
  actor_id: string;
  actor_role: string;
  reason: string;
}

export interface UpsertStoreZoneInput {
  id?: string;
  branch_id: string;
  name: string;
  pincode?: string;
  delivery_fee?: number;
  is_serviceable?: boolean;
  polygon_coordinates?: PolygonCoordinate[];
  exclusion_polygons?: PolygonCoordinate[][];
  radius_km?: number;
  center_latitude?: number;
  center_longitude?: number;
  priority?: number;
  estimated_delivery_minutes?: number;
  actor_id: string;
  actor_role: string;
  reason?: string;
}

export interface UpsertPartnerProfileInput {
  partner_id: string;
  partner_type?: PartnerType;
  status?: PartnerStatus;
  primary_branch_id?: string | null;
  max_concurrent_orders?: number;
  rating?: number;
  contract_reference?: string;
  metadata?: Record<string, unknown>;
  actor_id: string;
  actor_role: string;
  reason?: string;
}

export interface UpsertPartnerCoverageInput {
  id?: string;
  partner_id: string;
  branch_id: string;
  fence_type?: FenceType;
  polygon_coordinates?: PolygonCoordinate[];
  radius_km?: number;
  center_latitude?: number;
  center_longitude?: number;
  priority?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  actor_id: string;
  actor_role: string;
  reason?: string;
}

// ── Diagnostic & Fail-Closed Evaluation Contracts ───────────────────────────

export interface CoveragePointValidationQuery {
  latitude: number;
  longitude: number;
  branch_id?: string;
}

export interface CoveragePointValidationResult {
  latitude: number;
  longitude: number;
  serviceable: boolean;
  reason_code?:
    | "MATCHED"
    | "INVALID_COORDINATES"
    | "NO_ELIGIBLE_STORE"
    | "INSIDE_EXCLUSION_ZONE"
    | "NO_ELIGIBLE_PARTNER"
    | "OUTSIDE_DELIVERY_RADIUS";
  matched_store: {
    id: string;
    name: string;
    code: string;
    distance_km: number;
    zone_id: string;
    zone_name: string;
    is_corporate_routing_eligible: boolean;
  } | null;
  matched_partners: Array<{
    partner_id: string;
    partner_name: string;
    partner_type: PartnerType;
    priority: number;
    fence_type: FenceType;
    distance_km: number;
  }>;
  evaluated_stores_count: number;
  evaluated_zones_count: number;
  inside_exclusion: boolean;
  diagnostics_message: string;
}

export interface CorporateCoverageResolutionQuery {
  latitude?: number;
  longitude?: number;
  branch_id?: string;
  corporate_account_id?: string;
  recipient_id?: string;
}

export interface CorporateCoverageResolutionResult {
  resolved: boolean;
  reason_code:
    | "RESOLVED"
    | "INVALID_COORDINATES"
    | "NO_ELIGIBLE_STORE"
    | "INSIDE_EXCLUSION_ZONE"
    | "NO_ELIGIBLE_PARTNER"
    | "STORE_NOT_VERIFIED";
  store: {
    id: string;
    name: string;
    code: string;
    distance_km: number;
    zone_id: string;
  } | null;
  partner: {
    id: string;
    name: string;
    partner_type: PartnerType;
    priority: number;
  } | null;
  distance_km: number | null;
  message: string;
}
