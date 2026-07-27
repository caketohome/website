import { MedusaService } from "@medusajs/utils";
import {
    OrderStatusHistory,
    OrderEvent,
    OrderNote,
    DeliveryProof,
    Refund,
    RescheduleRequest,
    OrderStaffAssignment,
    ORDER_STATUSES,
} from "./models";
import type { OrderStatus } from "./models";
import type {
    StatusTransitionInput,
    OrderEventInput,
    OrderNoteInput,
    DeliveryProofInput,
    RefundInput,
    RescheduleRequestInput,
    RescheduleResolutionInput,
    StaffAssignmentInput,
    TimelineEntry,
    OrderSummary,
} from "./types/common";

function stringifyJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

function parseJsonField<T>(raw: unknown): T | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }
    return raw as T;
}

/**
 * Default configurable status transition adjacency map.
 *
 * This is the fallback used when the Settings module has no
 * `order_lifecycle.transitions` configuration. Admins can override the entire
 * map from Settings to add/remove statuses or transitions without a code change.
 *
 * Key = from-status, value = set of allowed to-statuses.
 */
const DEFAULT_TRANSITIONS: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["accepted", "cancelled"],
    accepted: ["packed", "cancelled"],
    packed: ["ready", "cancelled"],
    ready: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["delivered", "failed_delivery"],
    failed_delivery: ["out_for_delivery", "returned", "cancelled"],
    delivered: ["returned", "refunded"],
    returned: ["refunded"],
    cancelled: [],
    refunded: [],
};

/**
 * Statuses that represent a terminal state (no further transitions).
 */
const TERMINAL_STATUSES = new Set<string>(["cancelled", "refunded"]);

/**
 * Statuses from which a customer-initiated cancellation is allowed.
 * The customer cancellation window (hours after order placement) is
 * configurable via Settings: order_cancellation.customer_window_hours.
 */
const CUSTOMER_CANCELLABLE_STATUSES = new Set<string>([
    "pending",
    "confirmed",
    "accepted",
]);

/**
 * Order Lifecycle module service — the single source of truth for the
 * CakeToHome order lifecycle.
 *
 * Responsibilities:
 *   - Append-only status history with configurable transition validation
 *   - Timeline events (customer-visible + internal)
 *   - Internal & customer notes
 *   - Delivery proof (photo + signature) capture and retrieval
 *   - Refund records (partial + full, with refund-to-wallet support)
 *   - Reschedule requests with configurable approval flow
 *   - Staff assignments (baker, packer, delivery partner, etc.)
 *   - Unified timeline aggregation for storefront + admin
 *
 * Integration points (resolved lazily by the API layer, not the service, to
 * keep the module self-contained and unit-testable):
 *   - Settings Module (M1): configurable transitions, cancellation windows,
 *     refund-to-wallet toggle, invoice prefix
 *   - Analytics Module (M5): cancellation rate, refund volume events
 *   - Audit Module: every administrative action
 *   - Notification Module (M6): customer + admin notifications on transitions
 *   - Media Module (M10): delivery proof photo + signature storage
 *   - Delivery Module: delivery proof links to delivery records
 *
 * The Medusa core order entity is referenced by id (soft link); the core order
 * is queried via the framework query service where needed (in the API layer).
 */
class OrderLifecycleModuleService extends MedusaService({
    OrderStatusHistory,
    OrderEvent,
    OrderNote,
    DeliveryProof,
    Refund,
    RescheduleRequest,
    OrderStaffAssignment,
}) {
    // ── Status History & Transitions ───────────────────────────────────────

    /**
     * Validate that a transition from `from` to `to` is permitted by the
     * configurable adjacency map. Throws on invalid transitions.
     */
    validateTransition(
        from: string | null | undefined,
        to: string,
        transitions?: Record<string, string[]>
    ): void {
        const map = transitions ?? DEFAULT_TRANSITIONS;
        if (!ORDER_STATUSES.includes(to as OrderStatus)) {
            throw new Error(`Unknown order status: "${to}".`);
        }
        if (from === to) {
            throw new Error(`No-op transition: order is already "${to}".`);
        }
        if (from && TERMINAL_STATUSES.has(from)) {
            throw new Error(
                `Order is in terminal status "${from}" and cannot transition to "${to}".`
            );
        }
        const allowed = map[from ?? ""] ?? [];
        if (from && !allowed.includes(to)) {
            throw new Error(
                `Invalid transition from "${from}" to "${to}". Allowed: ${allowed.join(", ") || "(none)"}.`
            );
        }
    }

    /**
     * Record a status transition. Validates the transition against the
     * configurable adjacency map, appends to the status history, and emits a
     * timeline event. Returns the created history entry.
     */
    async recordStatusTransition(
        input: StatusTransitionInput,
        options?: { transitions?: Record<string, string[]> }
    ) {
        this.validateTransition(
            input.from_status ?? null,
            input.to_status,
            options?.transitions
        );

        const created = (await this.createOrderStatusHistories([
            {
                order_id: input.order_id,
                to_status: input.to_status,
                from_status: input.from_status ?? null,
                actor_type: input.actor_type ?? null,
                actor_id: input.actor_id ?? null,
                reason: input.reason ?? null,
                metadata: stringifyJson(input.metadata),
            },
        ])) as unknown as Record<string, unknown>[];

        // Emit a customer-visible timeline event for the transition.
        await this.createOrderEvents([
            {
                order_id: input.order_id,
                event_type: "status_change",
                message: `Order status changed to ${input.to_status}`,
                actor_type: input.actor_type ?? null,
                actor_id: input.actor_id ?? null,
                is_customer_visible: true,
                metadata: stringifyJson({
                    from: input.from_status ?? null,
                    to: input.to_status,
                    reason: input.reason ?? null,
                }),
            },
        ]);

        return created[0];
    }

    /**
     * Get the full status history for an order (chronological).
     */
    async getStatusHistory(orderId: string) {
        const rows = (await this.listOrderStatusHistories({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        return rows.sort(
            (a, b) =>
                new Date(a.created_at as string).getTime() -
                new Date(b.created_at as string).getTime()
        );
    }

    /**
     * Get the current (latest) status for an order, or null if none recorded.
     */
    async getCurrentStatus(orderId: string): Promise<string | null> {
        const history = await this.getStatusHistory(orderId);
        if (history.length === 0) return null;
        return history[history.length - 1].to_status as string;
    }

    /**
     * Register an order with the lifecycle module (creates the initial
     * "pending" status history entry). Idempotent — if a history entry already
     * exists, returns the current status without duplicating.
     */
    async registerOrder(
        orderId: string,
        options?: { actor_type?: string; actor_id?: string }
    ) {
        const existing = await this.getStatusHistory(orderId);
        if (existing.length > 0) {
            return existing[existing.length - 1];
        }
        return this.recordStatusTransition({
            order_id: orderId,
            from_status: null,
            to_status: "pending",
            actor_type: options?.actor_type ?? "system",
            actor_id: options?.actor_id ?? null,
        });
    }

    // ── Events ─────────────────────────────────────────────────────────────

    async addEvent(input: OrderEventInput) {
        const created = (await this.createOrderEvents([
            {
                order_id: input.order_id,
                event_type: input.event_type,
                message: input.message ?? null,
                actor_type: input.actor_type ?? null,
                actor_id: input.actor_id ?? null,
                is_customer_visible: input.is_customer_visible ?? true,
                metadata: stringifyJson(input.metadata),
            },
        ])) as unknown as Record<string, unknown>[];
        return created[0];
    }

    async listEvents(orderId: string, options?: { includeInternal?: boolean }) {
        const rows = (await this.listOrderEvents({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        const filtered = options?.includeInternal
            ? rows
            : rows.filter((r) => r.is_customer_visible === true);
        return filtered.sort(
            (a, b) =>
                new Date(a.created_at as string).getTime() -
                new Date(b.created_at as string).getTime()
        );
    }

    // ── Notes ──────────────────────────────────────────────────────────────

    async addNote(input: OrderNoteInput) {
        const created = (await this.createOrderNotes([
            {
                order_id: input.order_id,
                note_type: input.note_type,
                body: input.body,
                author_type: input.author_type ?? null,
                author_id: input.author_id ?? null,
            },
        ])) as unknown as Record<string, unknown>[];
        // Emit an internal timeline event for the note.
        await this.addEvent({
            order_id: input.order_id,
            event_type: "note_added",
            message: `Note added (${input.note_type})`,
            actor_type: input.author_type ?? null,
            actor_id: input.author_id ?? null,
            is_customer_visible: input.note_type === "customer",
            metadata: { note_type: input.note_type },
        });
        return created[0];
    }

    async listNotes(
        orderId: string,
        options?: { note_type?: "internal" | "customer" | "all" }
    ) {
        const rows = (await this.listOrderNotes({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        const type = options?.note_type ?? "all";
        const filtered =
            type === "all"
                ? rows
                : rows.filter((r) => r.note_type === type);
        return filtered.sort(
            (a, b) =>
                new Date(a.created_at as string).getTime() -
                new Date(b.created_at as string).getTime()
        );
    }

    async deleteNote(noteId: string) {
        await this.deleteOrderNotes([noteId]);
    }

    // ── Delivery Proof ─────────────────────────────────────────────────────

    async addDeliveryProof(input: DeliveryProofInput) {
        const capturedAt = input.captured_at
            ? new Date(input.captured_at)
            : new Date();
        const created = (await this.createDeliveryProofs([
            {
                order_id: input.order_id,
                delivery_id: input.delivery_id ?? null,
                delivery_partner_id: input.delivery_partner_id ?? null,
                photo_url: input.photo_url ?? null,
                signature_url: input.signature_url ?? null,
                note: input.note ?? null,
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                captured_at: capturedAt,
            },
        ])) as unknown as Record<string, unknown>[];
        // Emit a customer-visible timeline event.
        await this.addEvent({
            order_id: input.order_id,
            event_type: "proof_uploaded",
            message: "Delivery proof uploaded",
            actor_type: "delivery_partner",
            actor_id: input.delivery_partner_id ?? null,
            is_customer_visible: true,
            metadata: {
                photo_url: input.photo_url ?? null,
                signature_url: input.signature_url ?? null,
            },
        });
        return created[0];
    }

    async getDeliveryProofs(orderId: string) {
        const rows = (await this.listDeliveryProofs({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        return rows.sort(
            (a, b) =>
                new Date(a.captured_at as string).getTime() -
                new Date(b.captured_at as string).getTime()
        );
    }

    // ── Refunds ─────────────────────────────────────────────────────────────

    /**
     * Record a refund. Does NOT itself move money — the API layer coordinates
     * with the M7 Payment Provider abstraction and (optionally) the Wallet
     * module. This method is the auditable record of the refund.
     */
    async recordRefund(input: RefundInput) {
        if (input.amount <= 0) {
            throw new Error("Refund amount must be greater than zero.");
        }
        const created = (await this.createRefunds([
            {
                order_id: input.order_id,
                amount: Math.round(input.amount),
                refund_channel: input.refund_channel ?? "payment_provider",
                reason_code: input.reason_code ?? null,
                reason: input.reason ?? null,
                actor_type: input.actor_type ?? null,
                actor_id: input.actor_id ?? null,
                provider_refund_id: input.provider_refund_id ?? null,
                status: input.status ?? "processed",
                metadata: stringifyJson(input.metadata),
            },
        ])) as unknown as Record<string, unknown>[];

        // Emit a timeline event (customer-visible).
        await this.addEvent({
            order_id: input.order_id,
            event_type: "refund_issued",
            message: `Refund of ${input.amount} issued via ${input.refund_channel ?? "payment_provider"}`,
            actor_type: input.actor_type ?? null,
            actor_id: input.actor_id ?? null,
            is_customer_visible: true,
            metadata: {
                amount: input.amount,
                refund_channel: input.refund_channel ?? "payment_provider",
                reason: input.reason ?? null,
            },
        });

        return created[0];
    }

    async getRefunds(orderId: string) {
        const rows = (await this.listRefunds({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        return rows.sort(
            (a, b) =>
                new Date(a.created_at as string).getTime() -
                new Date(b.created_at as string).getTime()
        );
    }

    /**
     * Total refunded amount for an order (smallest currency unit).
     */
    async totalRefunded(orderId: string): Promise<number> {
        const refunds = await this.getRefunds(orderId);
        return refunds
            .filter((r) => r.status === "processed")
            .reduce((sum, r) => sum + (r.amount as number), 0);
    }

    // ── Reschedule ──────────────────────────────────────────────────────────

    async createRescheduleRequest(input: RescheduleRequestInput) {
        const created = (await this.createRescheduleRequests([
            {
                order_id: input.order_id,
                requested_by_type: input.requested_by_type ?? null,
                requested_by_id: input.requested_by_id ?? null,
                requested_date: input.requested_date ?? null,
                requested_slot_id: input.requested_slot_id ?? null,
                reason: input.reason ?? null,
                status: "requested",
            },
        ])) as unknown as Record<string, unknown>[];

        await this.addEvent({
            order_id: input.order_id,
            event_type: "reschedule_requested",
            message: "Delivery reschedule requested",
            actor_type: input.requested_by_type ?? null,
            actor_id: input.requested_by_id ?? null,
            is_customer_visible: true,
            metadata: {
                requested_date: input.requested_date ?? null,
                requested_slot_id: input.requested_slot_id ?? null,
            },
        });

        return created[0];
    }

    async getRescheduleRequests(orderId: string) {
        const rows = (await this.listRescheduleRequests({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        return rows.sort(
            (a, b) =>
                new Date(a.created_at as string).getTime() -
                new Date(b.created_at as string).getTime()
        );
    }

    async listPendingRescheduleRequests() {
        const rows = (await this.listRescheduleRequests({
            status: "requested" as unknown as string,
        })) as unknown as Record<string, unknown>[];
        return rows;
    }

    /**
     * Resolve a reschedule request (approve/reject). On approval, emits a
     * timeline event with the new slot details. The actual delivery slot
     * update is performed by the API layer (coordinating with the Delivery
     * module); this method records the resolution.
     */
    async resolveRescheduleRequest(
        requestId: string,
        resolution: RescheduleResolutionInput
    ) {
        const [existing] = (await this.listRescheduleRequests({
            id: requestId,
        } as Record<string, unknown>)) as unknown as Record<string, unknown>[];
        if (!existing) {
            throw new Error(`Reschedule request ${requestId} not found.`);
        }
        if (existing.status !== "requested") {
            throw new Error(
                `Reschedule request ${requestId} is already ${existing.status}.`
            );
        }

        await this.updateRescheduleRequests({
            selector: { id: requestId },
            data: {
                status: resolution.status,
                resolved_by_type: resolution.resolved_by_type ?? null,
                resolved_by_id: resolution.resolved_by_id ?? null,
                resolved_at: new Date(),
                resolution_note: resolution.resolution_note ?? null,
            },
        });

        await this.addEvent({
            order_id: existing.order_id as string,
            event_type: "reschedule_resolved",
            message: `Reschedule request ${resolution.status}`,
            actor_type: resolution.resolved_by_type ?? null,
            actor_id: resolution.resolved_by_id ?? null,
            is_customer_visible: true,
            metadata: {
                request_id: requestId,
                status: resolution.status,
                note: resolution.resolution_note ?? null,
            },
        });

        return { id: requestId, status: resolution.status };
    }

    // ── Staff Assignment ────────────────────────────────────────────────────

    async assignStaff(input: StaffAssignmentInput) {
        // Deactivate any existing active assignment for the same role on this order.
        const existing = (await this.listOrderStaffAssignments({
            order_id: input.order_id,
            role: input.role,
            is_active: true,
        })) as unknown as Record<string, unknown>[];
        for (const a of existing) {
            await this.updateOrderStaffAssignments({
                selector: { id: a.id as string },
                data: { is_active: false },
            });
        }

        const created = (await this.createOrderStaffAssignments([
            {
                order_id: input.order_id,
                role: input.role,
                staff_id: input.staff_id,
                staff_name: input.staff_name ?? null,
                assigned_by_type: input.assigned_by_type ?? null,
                assigned_by_id: input.assigned_by_id ?? null,
                is_active: true,
            },
        ])) as unknown as Record<string, unknown>[];

        await this.addEvent({
            order_id: input.order_id,
            event_type: "staff_assigned",
            message: `${input.role} assigned: ${input.staff_name ?? input.staff_id}`,
            actor_type: input.assigned_by_type ?? null,
            actor_id: input.assigned_by_id ?? null,
            is_customer_visible: false,
            metadata: { role: input.role, staff_id: input.staff_id },
        });

        return created[0];
    }

    async listStaffAssignments(orderId: string, options?: { activeOnly?: boolean }) {
        const rows = (await this.listOrderStaffAssignments({
            order_id: orderId,
        })) as unknown as Record<string, unknown>[];
        const filtered = options?.activeOnly
            ? rows.filter((r) => r.is_active === true)
            : rows;
        return filtered.sort(
            (a, b) =>
                new Date(a.created_at as string).getTime() -
                new Date(b.created_at as string).getTime()
        );
    }

    // ── Unified Timeline ────────────────────────────────────────────────────

    /**
     * Build a unified, chronological timeline for an order by merging status
     * history, events, notes, refunds, reschedule requests, delivery proofs,
     * and staff assignments into a single sorted list.
     *
     * `includeInternal` controls whether internal-only notes and staff
     * assignments are included (admin) or excluded (storefront).
     */
    async buildTimeline(
        orderId: string,
        options?: { includeInternal?: boolean }
    ): Promise<TimelineEntry[]> {
        const includeInternal = options?.includeInternal ?? false;

        const [history, events, notes, refunds, reschedules, proofs, assignments] =
            await Promise.all([
                this.getStatusHistory(orderId),
                this.listOrderEvents({ order_id: orderId }) as Promise<
                    Record<string, unknown>[]
                >,
                this.listNotes(orderId, {
                    note_type: includeInternal ? "all" : "customer",
                }),
                this.getRefunds(orderId),
                this.getRescheduleRequests(orderId),
                this.getDeliveryProofs(orderId),
                includeInternal
                    ? this.listStaffAssignments(orderId)
                    : Promise.resolve([] as Record<string, unknown>[]),
            ]);

        const entries: TimelineEntry[] = [];

        for (const h of history) {
            entries.push({
                id: h.id as string,
                type: "status",
                timestamp: new Date(h.created_at as string).toISOString(),
                title: `Status: ${h.to_status}`,
                description: (h.reason as string) ?? null,
                actor_type: (h.actor_type as string) ?? null,
                actor_id: (h.actor_id as string) ?? null,
                is_customer_visible: true,
                metadata: parseJsonField<Record<string, unknown>>(h.metadata),
            });
        }

        for (const e of events) {
            if (!includeInternal && e.is_customer_visible !== true) continue;
            entries.push({
                id: e.id as string,
                type: "event",
                timestamp: new Date(e.created_at as string).toISOString(),
                title: (e.message as string) ?? (e.event_type as string),
                description: (e.event_type as string) ?? null,
                actor_type: (e.actor_type as string) ?? null,
                actor_id: (e.actor_id as string) ?? null,
                is_customer_visible: (e.is_customer_visible as boolean) ?? true,
                metadata: parseJsonField<Record<string, unknown>>(e.metadata),
            });
        }

        for (const n of notes) {
            entries.push({
                id: n.id as string,
                type: "note",
                timestamp: new Date(n.created_at as string).toISOString(),
                title: `Note (${n.note_type})`,
                description: n.body as string,
                actor_type: (n.author_type as string) ?? null,
                actor_id: (n.author_id as string) ?? null,
                is_customer_visible: n.note_type === "customer",
                metadata: { note_type: n.note_type },
            });
        }

        for (const r of refunds) {
            entries.push({
                id: r.id as string,
                type: "refund",
                timestamp: new Date(r.created_at as string).toISOString(),
                title: `Refund: ${r.amount} (${r.refund_channel})`,
                description: (r.reason as string) ?? null,
                actor_type: (r.actor_type as string) ?? null,
                actor_id: (r.actor_id as string) ?? null,
                is_customer_visible: true,
                metadata: parseJsonField<Record<string, unknown>>(r.metadata),
            });
        }

        for (const rs of reschedules) {
            entries.push({
                id: rs.id as string,
                type: "reschedule",
                timestamp: new Date(rs.created_at as string).toISOString(),
                title: `Reschedule ${rs.status}`,
                description:
                    (rs.reason as string) ??
                    `Requested ${rs.requested_date ?? "new slot"}`,
                actor_type: (rs.requested_by_type as string) ?? null,
                actor_id: (rs.requested_by_id as string) ?? null,
                is_customer_visible: true,
                metadata: {
                    requested_date: rs.requested_date ?? null,
                    requested_slot_id: rs.requested_slot_id ?? null,
                    status: rs.status,
                },
            });
        }

        for (const p of proofs) {
            entries.push({
                id: p.id as string,
                type: "proof",
                timestamp: new Date(p.captured_at as string).toISOString(),
                title: "Delivery proof captured",
                description: (p.note as string) ?? null,
                actor_type: "delivery_partner",
                actor_id: (p.delivery_partner_id as string) ?? null,
                is_customer_visible: true,
                metadata: {
                    photo_url: p.photo_url ?? null,
                    signature_url: p.signature_url ?? null,
                },
            });
        }

        for (const a of assignments) {
            entries.push({
                id: a.id as string,
                type: "assignment",
                timestamp: new Date(a.created_at as string).toISOString(),
                title: `${a.role} assigned`,
                description: (a.staff_name as string) ?? (a.staff_id as string),
                actor_type: (a.assigned_by_type as string) ?? null,
                actor_id: (a.assigned_by_id as string) ?? null,
                is_customer_visible: false,
                metadata: { role: a.role, staff_id: a.staff_id },
            });
        }

        return entries.sort(
            (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
        );
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Whether a customer can cancel an order given its current status and the
     * configurable cancellation window (hours since placement).
     */
    canCustomerCancel(
        currentStatus: string,
        placedAt: Date | null,
        windowHours: number
    ): boolean {
        if (!CUSTOMER_CANCELLABLE_STATUSES.has(currentStatus)) return false;
        if (placedAt === null) return true; // unknown placement time — allow
        const elapsedHours =
            (Date.now() - placedAt.getTime()) / (1000 * 60 * 60);
        return elapsedHours <= windowHours;
    }

    /**
     * Expose the default transition map for admin inspection / Settings seeding.
     */
    getDefaultTransitions(): Record<string, string[]> {
        const copy: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(DEFAULT_TRANSITIONS)) {
            copy[key] = [...value];
        }
        return copy;
    }

    /**
     * Expose the list of valid statuses.
     */
    getValidStatuses(): string[] {
        return [...ORDER_STATUSES];
    }

    /**
     * Build an OrderSummary from a Medusa core order record + the lifecycle
     * current status. Used by the storefront order history endpoint.
     */
    buildOrderSummary(
        order: Record<string, unknown>,
        currentStatus: string | null,
        currentStatusSince: string | null
    ): OrderSummary {
        const items = (order.items as Record<string, unknown>[]) ?? [];
        const item_count = items.reduce(
            (sum, i) => sum + ((i.quantity as number) ?? 0),
            0
        );
        return {
            order_id: order.id as string,
            status: currentStatus ?? (order.status as string) ?? "pending",
            current_status_since: currentStatusSince,
            display_number: (order.display_id as unknown as string) ?? null,
            total_amount: (order.total as number) ?? null,
            currency_code: (order.currency_code as string) ?? null,
            placed_at: (order.created_at as string) ?? null,
            item_count,
            delivery_date:
                ((order.metadata as Record<string, unknown> | null)?.delivery_date as string) ??
                null,
            delivery_slot_id:
                ((order.metadata as Record<string, unknown> | null)?.delivery_slot_id as string) ??
                null,
        };
    }

    // ── AUTO-01 Kitchen Operations KDS Workflow Engine ──────────────────────

    /**
     * Automatic order queue prioritization engine.
     * Computes priority score: Midnight orders (+50), Express/Tight SLA (+30), Large AOV (+20).
     */
    calculateKdsQueuePriority(params: {
        isMidnight?: boolean;
        isExpress?: boolean;
        totalAmount?: number;
        minutesUntilDelivery?: number;
    }): number {
        let priority = 10; // Default base priority score

        if (params.isMidnight) priority += 50;
        if (params.isExpress) priority += 30;
        if (params.minutesUntilDelivery !== undefined && params.minutesUntilDelivery < 60) {
            priority += 40;
        }
        if (params.totalAmount && params.totalAmount >= 2000) {
            priority += 20;
        }

        return priority;
    }

    /**
     * Dynamic preparation time estimation math for kitchen staff.
     */
    estimatePrepTimeMinutes(items: { category?: string; qty: number; isCustom?: boolean }[]): number {
        if (!items || items.length === 0) return 20;

        let totalMinutes = 0;
        for (const item of items) {
            let baseMinutes = 20;
            if (item.isCustom) baseMinutes = 45;
            else if (item.category === "pastry") baseMinutes = 10;
            else if (item.category === "dessert") baseMinutes = 15;

            totalMinutes += baseMinutes + (item.qty - 1) * 5;
        }

        return Math.min(180, Math.max(15, totalMinutes));
    }

    /**
     * SLA countdown delay detection engine.
     * Triggers customer notifications only when delay exceeds threshold (>= 15 mins).
     */
    detectPrepDelay(params: {
        startedAt: Date;
        estimatedPrepMinutes: number;
        delayThresholdMinutes?: number;
    }): { isDelayed: boolean; delayMinutes: number; shouldNotifyCustomer: boolean } {
        const threshold = params.delayThresholdMinutes ?? 15;
        const elapsedMinutes = (Date.now() - params.startedAt.getTime()) / (1000 * 60);
        const delayMinutes = Math.max(0, Math.round(elapsedMinutes - params.estimatedPrepMinutes));

        const isDelayed = delayMinutes > 0;
        const shouldNotifyCustomer = delayMinutes >= threshold;

        return {
            isDelayed,
            delayMinutes,
            shouldNotifyCustomer,
        };
    }
}

export default OrderLifecycleModuleService;
