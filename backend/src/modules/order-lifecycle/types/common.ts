/**
 * Shared types for the Order Lifecycle module.
 */

import type { OrderStatus } from "../models";

// ── Status History ──────────────────────────────────────────────────────────

export interface StatusTransitionInput {
    order_id: string;
    to_status: OrderStatus;
    from_status?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
}

// ── Events ──────────────────────────────────────────────────────────────────

export interface OrderEventInput {
    order_id: string;
    event_type: string;
    message?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    is_customer_visible?: boolean;
    metadata?: Record<string, unknown> | null;
}

// ── Notes ────────────────────────────────────────────────────────────────────

export type OrderNoteType = "internal" | "customer";

export interface OrderNoteInput {
    order_id: string;
    note_type: OrderNoteType;
    body: string;
    author_type?: string | null;
    author_id?: string | null;
}

// ── Delivery Proof ───────────────────────────────────────────────────────────

export interface DeliveryProofInput {
    order_id: string;
    delivery_id?: string | null;
    delivery_partner_id?: string | null;
    photo_url?: string | null;
    signature_url?: string | null;
    note?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    captured_at?: Date | string;
}

// ── Refunds ───────────────────────────────────────────────────────────────────

export type RefundChannel = "payment_provider" | "wallet" | "mixed";
export type RefundStatus = "pending" | "processed" | "failed";

export interface RefundInput {
    order_id: string;
    amount: number;
    refund_channel?: RefundChannel;
    reason_code?: string | null;
    reason?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    provider_refund_id?: string | null;
    status?: RefundStatus;
    metadata?: Record<string, unknown> | null;
}

// ── Reschedule ───────────────────────────────────────────────────────────────

export type RescheduleStatus = "requested" | "approved" | "rejected";

export interface RescheduleRequestInput {
    order_id: string;
    requested_by_type?: string | null;
    requested_by_id?: string | null;
    requested_date?: string | null;
    requested_slot_id?: string | null;
    reason?: string | null;
}

export interface RescheduleResolutionInput {
    status: "approved" | "rejected";
    resolved_by_type?: string | null;
    resolved_by_id?: string | null;
    resolution_note?: string | null;
}

// ── Staff Assignment ─────────────────────────────────────────────────────────

export interface StaffAssignmentInput {
    order_id: string;
    role: string;
    staff_id: string;
    staff_name?: string | null;
    assigned_by_type?: string | null;
    assigned_by_id?: string | null;
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEntry {
    id: string;
    type: "status" | "event" | "note" | "refund" | "reschedule" | "proof" | "assignment";
    timestamp: string;
    title: string;
    description?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    is_customer_visible: boolean;
    metadata?: Record<string, unknown> | null;
}

// ── Order Summary (for storefront order history) ─────────────────────────────

export interface OrderSummary {
    order_id: string;
    status: string;
    current_status_since: string | null;
    display_number: string | null;
    total_amount: number | null;
    currency_code: string | null;
    placed_at: string | null;
    item_count: number | null;
    delivery_date: string | null;
    delivery_slot_id: string | null;
}
