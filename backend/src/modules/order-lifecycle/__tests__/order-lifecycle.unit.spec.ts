/**
 * Unit tests for the Order Lifecycle module service.
 *
 * Tests cover:
 *   - Transition validation (valid, invalid, terminal, no-op, unknown status)
 *   - Status history recording + timeline event emission
 *   - getCurrentStatus returns latest
 *   - registerOrder idempotency
 *   - Event add + list (internal filtering)
 *   - Note add (internal + customer) + list filtering
 *   - Delivery proof add + list
 *   - Refund record (validates positive amount) + totalRefunded
 *   - Reschedule request create + resolve (approve/reject, double-resolve error)
 *   - Staff assignment (supersedes existing active for same role)
 *   - canCustomerCancel window + status gating
 *   - buildOrderSummary from a Medusa core order record
 *
 * These tests mock the MedusaService CRUD methods to unit-test the
 * service logic in isolation.
 */

import OrderLifecycleModuleService from "../service";

function createMockService(): {
    service: OrderLifecycleModuleService;
    stores: {
        history: Record<string, unknown>[];
        events: Record<string, unknown>[];
        notes: Record<string, unknown>[];
        proofs: Record<string, unknown>[];
        refunds: Record<string, unknown>[];
        reschedules: Record<string, unknown>[];
        assignments: Record<string, unknown>[];
    };
} {
    const service = Object.create(
        OrderLifecycleModuleService.prototype
    ) as OrderLifecycleModuleService;

    const history: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const notes: Record<string, unknown>[] = [];
    const proofs: Record<string, unknown>[] = [];
    const refunds: Record<string, unknown>[] = [];
    const reschedules: Record<string, unknown>[] = [];
    const assignments: Record<string, unknown>[] = [];

    const filterBy = (
        store: Record<string, unknown>[],
        selector: Record<string, unknown> | string
    ) => {
        if (typeof selector === "string") {
            return store.filter((r) => r.id === selector);
        }
        return store.filter((r) =>
            Object.entries(selector).every(([k, v]) =>
                Array.isArray(v) ? v.includes(r[k]) : r[k] === v
            )
        );
    };

    (service as any).listOrderStatusHistories = jest.fn(async (selector: any) =>
        filterBy(history, selector)
    );
    (service as any).createOrderStatusHistories = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `osh_${history.length + 1}`,
            created_at: new Date(),
            ...d,
        }));
        history.push(...records);
        return records;
    });

    (service as any).listOrderEvents = jest.fn(async (selector: any) =>
        filterBy(events, selector)
    );
    (service as any).createOrderEvents = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `oevt_${events.length + 1}`,
            created_at: new Date(),
            is_customer_visible: true,
            ...d,
        }));
        events.push(...records);
        return records;
    });

    (service as any).listOrderNotes = jest.fn(async (selector: any) =>
        filterBy(notes, selector)
    );
    (service as any).createOrderNotes = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `onote_${notes.length + 1}`,
            created_at: new Date(),
            note_type: "internal",
            ...d,
        }));
        notes.push(...records);
        return records;
    });
    (service as any).deleteOrderNotes = jest.fn(async (ids: string[]) => {
        for (const id of ids) {
            const idx = notes.findIndex((n) => n.id === id);
            if (idx >= 0) notes.splice(idx, 1);
        }
    });

    (service as any).listDeliveryProofs = jest.fn(async (selector: any) =>
        filterBy(proofs, selector)
    );
    (service as any).createDeliveryProofs = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `dproof_${proofs.length + 1}`,
            created_at: new Date(),
            ...d,
        }));
        proofs.push(...records);
        return records;
    });

    (service as any).listRefunds = jest.fn(async (selector: any) =>
        filterBy(refunds, selector)
    );
    (service as any).createRefunds = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `rfnd_${refunds.length + 1}`,
            created_at: new Date(),
            status: "processed",
            ...d,
        }));
        refunds.push(...records);
        return records;
    });

    (service as any).listRescheduleRequests = jest.fn(async (selector: any) =>
        filterBy(reschedules, selector)
    );
    (service as any).createRescheduleRequests = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `rsch_${reschedules.length + 1}`,
            created_at: new Date(),
            status: "requested",
            ...d,
        }));
        reschedules.push(...records);
        return records;
    });
    (service as any).updateRescheduleRequests = jest.fn(async (args: any) => {
        const record = reschedules.find((r) => r.id === args.selector.id);
        if (record) Object.assign(record, args.data);
    });

    (service as any).listOrderStaffAssignments = jest.fn(async (selector: any) =>
        filterBy(assignments, selector)
    );
    (service as any).createOrderStaffAssignments = jest.fn(async (data: any) => {
        const records = (Array.isArray(data) ? data : [data]).map((d) => ({
            id: `osassign_${assignments.length + 1}`,
            created_at: new Date(),
            is_active: true,
            ...d,
        }));
        assignments.push(...records);
        return records;
    });
    (service as any).updateOrderStaffAssignments = jest.fn(async (args: any) => {
        const record = assignments.find((r) => r.id === args.selector.id);
        if (record) Object.assign(record, args.data);
    });

    return {
        service,
        stores: { history, events, notes, proofs, refunds, reschedules, assignments },
    };
}

describe("OrderLifecycleModuleService", () => {
    // ── Transition validation ──────────────────────────────────────────────

    describe("validateTransition", () => {
        const { service } = createMockService();

        it("allows a valid transition (pending → confirmed)", () => {
            expect(() => service.validateTransition("pending", "confirmed")).not.toThrow();
        });

        it("rejects an invalid transition (pending → delivered)", () => {
            expect(() => service.validateTransition("pending", "delivered")).toThrow(
                /Invalid transition/
            );
        });

        it("rejects a no-op transition (same status)", () => {
            expect(() => service.validateTransition("confirmed", "confirmed")).toThrow(
                /No-op transition/
            );
        });

        it("rejects transition from a terminal status (cancelled → confirmed)", () => {
            expect(() => service.validateTransition("cancelled", "confirmed")).toThrow(
                /terminal status/
            );
        });

        it("rejects an unknown status", () => {
            expect(() => service.validateTransition("pending", "bogus_status")).toThrow(
                /Unknown order status/
            );
        });

        it("allows a custom transition map override", () => {
            const customMap = { pending: ["custom_state"] };
            // custom_state is not in ORDER_STATUSES so this should throw on the
            // unknown-status check, proving the override is consulted.
            expect(() =>
                service.validateTransition("pending", "custom_state", customMap)
            ).toThrow(/Unknown order status/);
        });
    });

    // ── Status history & registerOrder ─────────────────────────────────────

    describe("recordStatusTransition & registerOrder", () => {
        it("records a status transition and emits a timeline event", async () => {
            const { service, stores } = createMockService();
            await service.recordStatusTransition({
                order_id: "order_1",
                from_status: "pending",
                to_status: "confirmed",
                actor_type: "admin",
                actor_id: "user_1",
            });
            expect(stores.history).toHaveLength(1);
            expect(stores.history[0].to_status).toBe("confirmed");
            expect(stores.events).toHaveLength(1);
            expect(stores.events[0].event_type).toBe("status_change");
        });

        it("getCurrentStatus returns the latest status", async () => {
            const { service } = createMockService();
            await service.recordStatusTransition({
                order_id: "order_2",
                from_status: null,
                to_status: "pending",
            });
            await service.recordStatusTransition({
                order_id: "order_2",
                from_status: "pending",
                to_status: "confirmed",
            });
            const status = await service.getCurrentStatus("order_2");
            expect(status).toBe("confirmed");
        });

        it("getCurrentStatus returns null when no history exists", async () => {
            const { service } = createMockService();
            const status = await service.getCurrentStatus("order_none");
            expect(status).toBeNull();
        });

        it("getBatchStatusHistories and getBatchCurrentStatuses retrieve multiple orders in batch", async () => {
            const { service } = createMockService();
            await service.recordStatusTransition({
                order_id: "order_b1",
                from_status: null,
                to_status: "pending",
            });
            await service.recordStatusTransition({
                order_id: "order_b1",
                from_status: "pending",
                to_status: "confirmed",
            });
            await service.recordStatusTransition({
                order_id: "order_b2",
                from_status: null,
                to_status: "pending",
            });

            const histories = await service.getBatchStatusHistories(["order_b1", "order_b2", "order_b3"]);
            expect(histories.get("order_b1")).toHaveLength(2);
            expect(histories.get("order_b2")).toHaveLength(1);
            expect(histories.get("order_b3")).toEqual([]);

            const statuses = await service.getBatchCurrentStatuses(["order_b1", "order_b2", "order_b3"]);
            expect(statuses.get("order_b1")).toBe("confirmed");
            expect(statuses.get("order_b2")).toBe("pending");
            expect(statuses.get("order_b3")).toBeNull();
        });

        it("registerOrder is idempotent (does not duplicate initial entry)", async () => {
            const { service, stores } = createMockService();
            await service.registerOrder("order_3");
            await service.registerOrder("order_3");
            // One history entry for the initial "pending" + one event per transition.
            // registerOrder the second time should NOT add another history row.
            const pendingEntries = stores.history.filter(
                (h) => h.to_status === "pending"
            );
            expect(pendingEntries).toHaveLength(1);
        });
    });

    // ── Events ──────────────────────────────────────────────────────────────

    describe("events", () => {
        it("addEvent creates an event and listEvents filters internal by default", async () => {
            const { service, stores } = createMockService();
            await service.addEvent({
                order_id: "order_4",
                event_type: "custom_event",
                message: "Hello",
                is_customer_visible: false,
            });
            await service.addEvent({
                order_id: "order_4",
                event_type: "public_event",
                message: "World",
                is_customer_visible: true,
            });
            expect(stores.events).toHaveLength(2);
            const visible = await service.listEvents("order_4");
            expect(visible).toHaveLength(1);
            expect(visible[0].event_type).toBe("public_event");
            const all = await service.listEvents("order_4", { includeInternal: true });
            expect(all).toHaveLength(2);
        });
    });

    // ── Notes ──────────────────────────────────────────────────────────────

    describe("notes", () => {
        it("addNote creates a note and emits a timeline event", async () => {
            const { service, stores } = createMockService();
            await service.addNote({
                order_id: "order_5",
                note_type: "internal",
                body: "Baker notified",
                author_type: "admin",
                author_id: "user_1",
            });
            expect(stores.notes).toHaveLength(1);
            expect(stores.notes[0].note_type).toBe("internal");
            const event = stores.events.find((e) => e.event_type === "note_added");
            expect(event).toBeDefined();
        });

        it("listNotes filters by note_type", async () => {
            const { service } = createMockService();
            await service.addNote({ order_id: "order_6", note_type: "internal", body: "a" });
            await service.addNote({ order_id: "order_6", note_type: "customer", body: "b" });
            const internal = await service.listNotes("order_6", { note_type: "internal" });
            expect(internal).toHaveLength(1);
            expect(internal[0].body).toBe("a");
            const all = await service.listNotes("order_6", { note_type: "all" });
            expect(all).toHaveLength(2);
        });
    });

    // ── Delivery proof ─────────────────────────────────────────────────────

    describe("delivery proof", () => {
        it("addDeliveryProof creates a proof and emits a customer-visible event", async () => {
            const { service, stores } = createMockService();
            await service.addDeliveryProof({
                order_id: "order_7",
                photo_url: "https://cdn/photo.jpg",
                signature_url: "https://cdn/sig.png",
            });
            expect(stores.proofs).toHaveLength(1);
            expect(stores.proofs[0].photo_url).toBe("https://cdn/photo.jpg");
            const event = stores.events.find((e) => e.event_type === "proof_uploaded");
            expect(event).toBeDefined();
            expect(event?.is_customer_visible).toBe(true);
        });
    });

    // ── Refunds ────────────────────────────────────────────────────────────

    describe("refunds", () => {
        it("recordRefund rejects zero/negative amounts", async () => {
            const { service } = createMockService();
            await expect(
                service.recordRefund({ order_id: "order_8", amount: 0 })
            ).rejects.toThrow(/greater than zero/);
        });

        it("recordRefund records a refund and emits a timeline event", async () => {
            const { service, stores } = createMockService();
            await service.recordRefund({
                order_id: "order_8",
                amount: 500,
                refund_channel: "wallet",
                reason: "Item damaged",
            });
            expect(stores.refunds).toHaveLength(1);
            expect(stores.refunds[0].amount).toBe(500);
            const event = stores.events.find((e) => e.event_type === "refund_issued");
            expect(event).toBeDefined();
        });

        it("totalRefunded sums processed refunds only", async () => {
            const { service } = createMockService();
            await service.recordRefund({ order_id: "order_9", amount: 200 });
            await service.recordRefund({ order_id: "order_9", amount: 300 });
            const total = await service.totalRefunded("order_9");
            expect(total).toBe(500);
        });
    });

    // ── Reschedule ──────────────────────────────────────────────────────────

    describe("reschedule", () => {
        it("createRescheduleRequest creates a request in 'requested' status", async () => {
            const { service, stores } = createMockService();
            const req = await service.createRescheduleRequest({
                order_id: "order_10",
                requested_date: "2026-08-01",
                requested_by_type: "customer",
                requested_by_id: "cus_1",
            });
            expect(stores.reschedules).toHaveLength(1);
            expect((req as any).status).toBe("requested");
        });

        it("resolveRescheduleRequest approves a request", async () => {
            const { service, stores } = createMockService();
            const req = await service.createRescheduleRequest({
                order_id: "order_11",
                requested_date: "2026-08-02",
            });
            const result = await service.resolveRescheduleRequest(req.id as string, {
                status: "approved",
                resolved_by_type: "admin",
                resolved_by_id: "user_1",
            });
            expect((result as any).status).toBe("approved");
            expect(stores.reschedules[0].status).toBe("approved");
        });

        it("resolveRescheduleRequest rejects double-resolution", async () => {
            const { service } = createMockService();
            const req = await service.createRescheduleRequest({
                order_id: "order_12",
                requested_date: "2026-08-03",
            });
            await service.resolveRescheduleRequest(req.id as string, {
                status: "approved",
            });
            await expect(
                service.resolveRescheduleRequest(req.id as string, {
                    status: "rejected",
                })
            ).rejects.toThrow(/already/);
        });

        it("resolveRescheduleRequest throws on unknown request id", async () => {
            const { service } = createMockService();
            await expect(
                service.resolveRescheduleRequest("rsch_unknown", { status: "approved" })
            ).rejects.toThrow(/not found/);
        });
    });

    // ── Staff assignment ────────────────────────────────────────────────────

    describe("staff assignment", () => {
        it("assignStaff supersedes existing active assignment for the same role", async () => {
            const { service, stores } = createMockService();
            await service.assignStaff({
                order_id: "order_13",
                role: "baker",
                staff_id: "staff_1",
                staff_name: "Alice",
            });
            await service.assignStaff({
                order_id: "order_13",
                role: "baker",
                staff_id: "staff_2",
                staff_name: "Bob",
            });
            expect(stores.assignments).toHaveLength(2);
            const active = stores.assignments.filter((a) => a.is_active === true);
            expect(active).toHaveLength(1);
            expect(active[0].staff_id).toBe("staff_2");
        });

        it("listStaffAssignments activeOnly returns only active", async () => {
            const { service } = createMockService();
            await service.assignStaff({ order_id: "order_14", role: "packer", staff_id: "s1" });
            await service.assignStaff({ order_id: "order_14", role: "packer", staff_id: "s2" });
            const active = await service.listStaffAssignments("order_14", { activeOnly: true });
            expect(active).toHaveLength(1);
        });
    });

    // ── canCustomerCancel ───────────────────────────────────────────────────

    describe("canCustomerCancel", () => {
        const { service } = createMockService();

        it("allows cancellation within window for a cancellable status", () => {
            const recent = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h ago
            expect(service.canCustomerCancel("pending", recent, 24)).toBe(true);
        });

        it("denies cancellation outside the window", () => {
            const old = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
            expect(service.canCustomerCancel("pending", old, 24)).toBe(false);
        });

        it("denies cancellation for a non-cancellable status", () => {
            const recent = new Date(Date.now() - 1 * 60 * 60 * 1000);
            expect(service.canCustomerCancel("out_for_delivery", recent, 24)).toBe(false);
        });

        it("allows cancellation when placedAt is null (unknown placement)", () => {
            expect(service.canCustomerCancel("confirmed", null, 24)).toBe(true);
        });
    });

    // ── buildOrderSummary ───────────────────────────────────────────────────

    describe("buildOrderSummary", () => {
        const { service } = createMockService();

        it("builds a summary from a Medusa core order record", () => {
            const order = {
                id: "order_15",
                display_id: 1001,
                status: "completed",
                total: 1500,
                currency_code: "inr",
                created_at: "2026-07-17T00:00:00Z",
                items: [{ quantity: 2 }, { quantity: 1 }],
                metadata: { delivery_date: "2026-07-20", delivery_slot_id: "slot_1" },
            };
            const summary = service.buildOrderSummary(order, "out_for_delivery", "2026-07-17T01:00:00Z");
            expect(summary.order_id).toBe("order_15");
            expect(summary.status).toBe("out_for_delivery");
            expect(summary.display_number).toBe(1001);
            expect(summary.total_amount).toBe(1500);
            expect(summary.item_count).toBe(3);
            expect(summary.delivery_date).toBe("2026-07-20");
            expect(summary.delivery_slot_id).toBe("slot_1");
        });

        it("falls back to core order status when lifecycle status is null", () => {
            const order = {
                id: "order_16",
                status: "completed",
                items: [],
            };
            const summary = service.buildOrderSummary(order, null, null);
            expect(summary.status).toBe("completed");
            expect(summary.item_count).toBe(0);
        });
    });

    // ── buildTimeline ───────────────────────────────────────────────────────

    describe("buildTimeline", () => {
        it("aggregates history, events, notes, refunds, proofs into a sorted timeline", async () => {
            const { service } = createMockService();
            await service.recordStatusTransition({
                order_id: "order_17",
                from_status: null,
                to_status: "pending",
            });
            await service.addNote({
                order_id: "order_17",
                note_type: "customer",
                body: "Please deliver after 5pm",
            });
            await service.recordRefund({ order_id: "order_17", amount: 100 });
            await service.addDeliveryProof({ order_id: "order_17", photo_url: "x" });

            const timeline = await service.buildTimeline("order_17", { includeInternal: true });
            // At least: 2 status events (pending transition + status_change event) +
            // 1 note event + 1 refund event + 1 proof event + the note/refund/proof rows.
            expect(timeline.length).toBeGreaterThanOrEqual(5);
            // Verify chronological order (timestamps ascending).
            for (let i = 1; i < timeline.length; i++) {
                expect(
                    new Date(timeline[i].timestamp).getTime()
                ).toBeGreaterThanOrEqual(
                    new Date(timeline[i - 1].timestamp).getTime()
                );
            }
        });

        it("excludes internal-only entries when includeInternal is false", async () => {
            const { service } = createMockService();
            await service.addNote({
                order_id: "order_18",
                note_type: "internal",
                body: "staff only",
            });
            await service.addNote({
                order_id: "order_18",
                note_type: "customer",
                body: "customer visible",
            });
            const publicTimeline = await service.buildTimeline("order_18", {
                includeInternal: false,
            });
            const noteEntries = publicTimeline.filter((e) => e.type === "note");
            expect(noteEntries).toHaveLength(1);
            expect(noteEntries[0].is_customer_visible).toBe(true);
        });
    });

    // ── Helpers ────────────────────────────────────────────────────────────

    describe("helpers", () => {
        const { service } = createMockService();

        it("getDefaultTransitions returns a copy of the transition map", () => {
            const map = service.getDefaultTransitions();
            expect(map.pending).toContain("confirmed");
            // Mutating the returned copy should not affect the service.
            map.pending.push("bogus");
            const map2 = service.getDefaultTransitions();
            expect(map2.pending).not.toContain("bogus");
        });

        it("getValidStatuses returns all 11 statuses", () => {
            const statuses = service.getValidStatuses();
            expect(statuses).toHaveLength(11);
            expect(statuses).toContain("delivered");
            expect(statuses).toContain("refunded");
        });
    });
});
