import { model } from "@medusajs/utils";

/**
 * Order status enumeration for the CakeToHome order lifecycle.
 *
 * The full lifecycle (configurable via Settings — never hardcoded in business
 * logic) flows:
 *
 *   pending → confirmed → accepted → packed → ready → out_for_delivery
 *           → delivered
 *           → failed_delivery (retryable → out_for_delivery, or → returned)
 *   any  → cancelled
 *   delivered/returned → refunded
 *
 * These are stored as plain text so admins can extend the lifecycle from the
 * Settings module without a migration. The service validates transitions
 * against a configurable adjacency map (see OrderLifecycleModuleService).
 */
export const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "accepted",
    "packed",
    "ready",
    "out_for_delivery",
    "delivered",
    "failed_delivery",
    "cancelled",
    "returned",
    "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Order status history — append-only audit trail of every status transition
 * an order goes through.
 *
 * One row per transition. The first row (status = the initial status, e.g.
 * "pending") is created when the order is registered with the lifecycle
 * module. Every subsequent transition appends a row.
 *
 * Soft-links to the Medusa core order by id (order_...). The core order entity
 * is never modified — only extended.
 */
export const OrderStatusHistory = model.define("order_status_history", {
    id: model
        .id({
            prefix: "osh",
        })
        .primaryKey(),
    // Soft link to the Medusa core order (order_...).
    order_id: model.text().searchable(),
    // The status the order moved INTO with this transition.
    to_status: model.text(),
    // The status the order moved FROM (null for the initial entry).
    from_status: model.text().nullable(),
    // Who/what performed the transition.
    actor_type: model.text().nullable(),
    actor_id: model.text().nullable(),
    // Free-text reason (e.g. cancellation reason, refund reason).
    reason: model.text().nullable(),
    // Arbitrary JSON metadata (e.g. refund amount, reschedule details).
    metadata: model.text().nullable(),
});

/**
 * Order event — a discrete, timestamped event in the order timeline.
 *
 * Unlike status history (which only records transitions), events capture the
 * full operational timeline: "order placed", "preparation started", "out for
 * delivery", "delivery proof uploaded", "refund issued", "note added", etc.
 * This powers the storefront order-tracking timeline and the admin timeline.
 */
export const OrderEvent = model.define("order_event", {
    id: model
        .id({
            prefix: "oevt",
        })
        .primaryKey(),
    order_id: model.text().searchable(),
    // Event type, e.g. "status_change", "note_added", "refund_issued",
    // "reschedule_requested", "proof_uploaded", "staff_assigned".
    event_type: model.text(),
    // Human-readable message shown in the timeline.
    message: model.text().nullable(),
    actor_type: model.text().nullable(),
    actor_id: model.text().nullable(),
    // Whether this event is visible to the customer on the storefront timeline.
    is_customer_visible: model.boolean().default(true),
    // JSON payload with event-specific data.
    metadata: model.text().nullable(),
});

/**
 * Order note — internal or customer-visible notes attached to an order.
 *
 * `internal` notes are staff-only (admin timeline). `customer` notes are
 * visible to the customer on the storefront order detail. Order notes are
 * distinct from Medusa core order metadata — they are a first-class auditable
 * record with authorship and timestamps.
 */
export const OrderNote = model.define("order_note", {
    id: model
        .id({
            prefix: "onote",
        })
        .primaryKey(),
    order_id: model.text().searchable(),
    // "internal" | "customer"
    note_type: model.text().default("internal"),
    author_type: model.text().nullable(),
    author_id: model.text().nullable(),
    body: model.text(),
});

/**
 * Delivery proof — photo + signature proof of delivery captured by the
 * delivery partner at the doorstep.
 *
 * Soft-links to the Delivery module delivery (del_...) and to the order.
 * The photo_url and signature_url reference Media Module (M10) assets.
 */
export const DeliveryProof = model.define("delivery_proof", {
    id: model
        .id({
            prefix: "dproof",
        })
        .primaryKey(),
    order_id: model.text().searchable(),
    delivery_id: model.text().nullable(),
    // Delivery partner who captured the proof.
    delivery_partner_id: model.text().nullable(),
    // Media Module (M10) URL for the delivery photo.
    photo_url: model.text().nullable(),
    // Media Module (M10) URL for the customer signature (PNG data URL or CDN URL).
    signature_url: model.text().nullable(),
    // Optional note left by the delivery partner (e.g. "Left at door").
    note: model.text().nullable(),
    // Geolocation at the moment of proof capture (for verification).
    latitude: model.number().nullable(),
    longitude: model.number().nullable(),
    captured_at: model.dateTime(),
});

/**
 * Refund — a refund record against an order.
 *
 * A single order may have multiple partial refunds. Each refund records the
 * amount, reason, the actor who issued it, the channel (original payment
 * provider vs. wallet credit), and the provider refund reference (when the
 * M7 Payment Provider processed it).
 *
 * Refund-to-wallet is a configurable option (Settings: refunds.refund_to_wallet)
 * — when enabled, the refund amount is credited to the customer wallet instead
 * of (or in addition to) the original payment provider refund.
 */
export const Refund = model.define("order_lifecycle_refund", {
    id: model
        .id({
            prefix: "rfnd",
        })
        .primaryKey(),
    order_id: model.text().searchable(),
    // Amount in the smallest currency unit (paise for INR) — integer to avoid
    // floating-point rounding issues.
    amount: model.number(),
    // "payment_provider" | "wallet" | "mixed"
    refund_channel: model.text().default("payment_provider"),
    // Reason code (configurable list from Settings) + free-text reason.
    reason_code: model.text().nullable(),
    reason: model.text().nullable(),
    actor_type: model.text().nullable(),
    actor_id: model.text().nullable(),
    // Provider refund reference (from M7 Payment Provider abstraction).
    provider_refund_id: model.text().nullable(),
    // "pending" | "processed" | "failed"
    status: model.text().default("processed"),
    metadata: model.text().nullable(),
});

/**
 * Reschedule request — a customer or staff request to change the delivery
 * slot/date of an order.
 *
 * Lifecycle: requested → approved (slot changed) | rejected.
 * On approval, the order's delivery slot/date is updated and a timeline event
 * is recorded. Rescheduling is gated by a configurable window (Settings:
 * rescheduling.min_hours_before_delivery).
 */
export const RescheduleRequest = model.define("reschedule_request", {
    id: model
        .id({
            prefix: "rsch",
        })
        .primaryKey(),
    order_id: model.text().searchable(),
    // Who requested the reschedule.
    requested_by_type: model.text().nullable(),
    requested_by_id: model.text().nullable(),
    // Requested new delivery date (ISO date) + slot id.
    requested_date: model.text().nullable(),
    requested_slot_id: model.text().nullable(),
    reason: model.text().nullable(),
    // "requested" | "approved" | "rejected"
    status: model.text().default("requested"),
    // Who resolved the request + when.
    resolved_by_type: model.text().nullable(),
    resolved_by_id: model.text().nullable(),
    resolved_at: model.dateTime().nullable(),
    resolution_note: model.text().nullable(),
});

/**
 * Staff assignment — links a staff member to an order for accountability.
 *
 * A single order may have multiple assignments of different roles (e.g. a
 * baker for preparation, a delivery partner for delivery). The active flag
 * marks the current assignment; superseded assignments are kept for history.
 */
export const OrderStaffAssignment = model.define("order_staff_assignment", {
    id: model
        .id({
            prefix: "osassign",
        })
        .primaryKey(),
    order_id: model.text().searchable(),
    // "baker" | "packer" | "delivery_partner" | "branch_manager" | "staff"
    role: model.text(),
    // The staff/delivery-partner user id.
    staff_id: model.text(),
    staff_name: model.text().nullable(),
    assigned_by_type: model.text().nullable(),
    assigned_by_id: model.text().nullable(),
    is_active: model.boolean().default(true),
});
