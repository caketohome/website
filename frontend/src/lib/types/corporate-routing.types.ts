/**
 * CakeToHome ERP — Corporate Delivery Geographic Matching & Routing Types
 * Phase C7.11 Step 11A: Database Row Interfaces, Enums, and Domain DTOs
 */

export type CorporateDeliveryEntityType =
  | "ROSTER_EMPLOYEE"
  | "GIFTING_RECIPIENT"
  | "DIRECT_ORDER";

export type CorporateAssignmentStatus =
  | "ASSIGNED"
  | "UNASSIGNED"
  | "MANUAL_OVERRIDE"
  | "PENDING_REVIEW";

export type CorporateRoutingReasonCode =
  | "MATCHED_POLYGON"
  | "MATCHED_RADIUS"
  | "OUTSIDE_COVERAGE"
  | "INSIDE_EXCLUSION"
  | "COORDINATES_MISSING"
  | "COORDINATES_INVALID"
  | "STORE_NOT_ELIGIBLE"
  | "NO_ELIGIBLE_PARTNER"
  | "MANUAL_OVERRIDE"
  | "PENDING_EVALUATION";

export type CorporateAssignmentEventType =
  | "BATCH_MATCHED"
  | "MANUALLY_OVERRIDDEN"
  | "REASSIGNED"
  | "UNASSIGNED_TRIGGERED";

// ── Database Row Interfaces ──────────────────────────────────────────────────

export interface CorporateDeliveryAssignmentRow {
  id: string;
  entity_type: CorporateDeliveryEntityType;
  entity_id: string;
  account_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string;
  delivery_city: string | null;
  normalized_city_key: string | null;
  delivery_pincode: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  status: CorporateAssignmentStatus;
  reason_code: CorporateRoutingReasonCode;
  assigned_store_id: string | null;
  assigned_zone_id: string | null;
  assigned_partner_id: string | null;
  distance_km: number | string | null;
  matched_rule: string | null;
  diagnostics_message: string | null;
  evaluation_metadata: Record<string, unknown>;
  assigned_at: Date | string | null;
  assigned_by: string | null;
  override_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CorporateAssignmentEventRow {
  id: string;
  assignment_id: string;
  event_type: CorporateAssignmentEventType;
  actor_id: string;
  actor_role: string;
  reason: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: Date | string;
}

// ── DTOs & Domain View Models ────────────────────────────────────────────────

export interface CorporateDeliveryAssignmentDTO {
  id: string;
  entity_type: CorporateDeliveryEntityType;
  entity_id: string;
  account_id: string | null;
  account_name?: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string;
  delivery_city: string | null;
  normalized_city_key: string | null;
  delivery_pincode: string | null;
  latitude: number | null;
  longitude: number | null;
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
  diagnostics_message: string | null;
  evaluation_metadata: Record<string, unknown>;
  assigned_at: string | null;
  assigned_by: string | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ── Batch Matching Inputs & Outputs ──────────────────────────────────────────

export interface CorporateBatchMatchingItemInput {
  entity_type: CorporateDeliveryEntityType;
  entity_id: string;
  account_id?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  delivery_address: string;
  delivery_city?: string | null;
  delivery_pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CorporateBatchMatchingInput {
  items: CorporateBatchMatchingItemInput[];
  actor_id?: string;
  actor_role?: string;
  force_reassign?: boolean;
}

export interface CorporateBatchMatchingSummary {
  total_evaluated: number;
  total_assigned: number;
  total_unassigned: number;
  unassigned_breakdown: Record<string, number>;
  evaluation_duration_ms: number;
}

export interface CorporateBatchMatchingResult {
  summary: CorporateBatchMatchingSummary;
  assignments: CorporateDeliveryAssignmentDTO[];
}

export interface CorporateManualOverrideInput {
  store_id: string;
  partner_id?: string;
  zone_id?: string;
  override_reason: string;
  actor_id: string;
  actor_role: string;
}

// ── Phase C7.12: Super Admin Unresolved Review Queue Types ───────────────────

export interface UnresolvedFilterParams {
  status?: CorporateAssignmentStatus;
  reason_code?: CorporateRoutingReasonCode;
  account_id?: string;
  entity_type?: CorporateDeliveryEntityType;
  search?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface UnresolvedAssignmentItem extends CorporateDeliveryAssignmentDTO {
  account_name: string | null;
  masked_phone: string | null;
  reason_description: string;
}

export interface UnresolvedQueueMetrics {
  total_unresolved: number;
  by_reason_code: Record<string, number>;
}

export interface CandidateStoreReview {
  store_id: string;
  store_name: string;
  store_code: string;
  is_open: boolean;
  is_corporate_routing_eligible: boolean;
  distance_km: number;
  match_class: "POLYGON" | "RADIUS" | "NONE";
  is_inside_exclusion: boolean;
  zone_id: string | null;
  zone_name: string | null;
  zone_priority: number;
}

export interface CandidatePartnerReview {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  profile_status: string;
  rating: number;
  priority: number;
  is_active: boolean;
}

export interface UnresolvedReviewCandidatesResult {
  assignment: CorporateDeliveryAssignmentDTO;
  can_match: boolean;
  reason_code: CorporateRoutingReasonCode;
  diagnostics_message: string;
  candidate_stores: CandidateStoreReview[];
  candidate_partners: CandidatePartnerReview[];
}

export type ResolveUnresolvedAction =
  | "CORRECT_COORDINATES"
  | "MANUAL_ASSIGN"
  | "MARK_PENDING_REVIEW";

export interface ResolveUnresolvedInput {
  assignment_id: string;
  action: ResolveUnresolvedAction;
  latitude?: number | null;
  longitude?: number | null;
  delivery_address?: string;
  store_id?: string;
  partner_id?: string;
  override_reason?: string;
  actor_id: string;
  actor_role: string;
}

export interface ResolveActionResult {
  success: boolean;
  assignment: CorporateDeliveryAssignmentDTO;
  action_taken: ResolveUnresolvedAction;
  idempotent: boolean;
  event_id?: string;
  message?: string;
}

