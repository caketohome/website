import MarketingModuleService from "../service";
import {
    CAMPAIGN_TRANSITIONS,
    ACTIVE_CAMPAIGN_STATES,
    TERMINAL_CAMPAIGN_STATES,
} from "../types/common";

/**
 * Unit tests for the Marketing Module Service (Phase 9 Milestone 9.1).
 *
 * The MedusaService base class is mocked via Object.create + manual stubs,
 * mirroring the pattern used by the Rewards module test suite. This keeps
 * tests fast (no DB) and focused on the campaign lifecycle logic: state
 * machine validation, scheduling eligibility, budget/goal tracking, event
 * logging, and metric upsert.
 */

function createMockService() {
    const service = Object.create(
        MarketingModuleService.prototype
    ) as MarketingModuleService;

    const campaignStore: any[] = [];
    const eventStore: any[] = [];
    const metricStore: any[] = [];

    const mocks: any = {
        container: { analyticsModuleService: { track: jest.fn(async () => { }) } },

        createCampaigns: jest.fn(async (data: any | any[]) => {
            const arr = Array.isArray(data) ? data : [data];
            const created = arr.map((c, idx) => ({
                id: `mkt_camp_${campaignStore.length + idx + 1}`,
                created_at: new Date(),
                updated_at: new Date(),
                ...c,
            }));
            campaignStore.push(...created);
            return Array.isArray(data) ? created : created[0];
        }),

        updateCampaigns: jest.fn(async (selector: any, data: any) => {
            const records = campaignStore.filter((c) =>
                Object.entries(selector).every(([k, v]) => c[k] === v)
            );
            records.forEach((r) => Object.assign(r, data, { updated_at: new Date() }));
            return records[0];
        }),

        listCampaigns: jest.fn(async (filters: any, options: any) => {
            let rows = campaignStore.filter((c) =>
                Object.entries(filters).every(([k, v]) => c[k] === v)
            );
            const order = options?.order;
            if (order && order.created_at === "DESC") {
                rows = rows.sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                );
            }
            const skip = options?.skip ?? 0;
            const take = options?.take ?? 50;
            return rows.slice(skip, skip + take);
        }),

        listAndCountCampaigns: jest.fn(async (filters: any, options: any) => {
            const rows = campaignStore.filter((c) =>
                Object.entries(filters).every(([k, v]) => c[k] === v)
            );
            const skip = options?.skip ?? 0;
            const take = options?.take ?? 50;
            return [rows.slice(skip, skip + take), rows.length];
        }),

        deleteCampaigns: jest.fn(async (ids: string[]) => {
            ids.forEach((id) => {
                const idx = campaignStore.findIndex((c) => c.id === id);
                if (idx >= 0) campaignStore.splice(idx, 1);
            });
        }),

        createCampaignEvents: jest.fn(async (data: any | any[]) => {
            const arr = Array.isArray(data) ? data : [data];
            const created = arr.map((e, idx) => ({
                id: `mkt_cev_${eventStore.length + idx + 1}`,
                created_at: new Date(),
                ...e,
            }));
            eventStore.push(...created);
            return Array.isArray(data) ? created : created[0];
        }),

        listCampaignEvents: jest.fn(async (filters: any, options: any) => {
            let rows = eventStore.filter((e) =>
                Object.entries(filters).every(([k, v]) => e[k] === v)
            );
            const order = options?.order;
            if (order && order.created_at === "DESC") {
                rows = rows.sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                );
            }
            const skip = options?.skip ?? 0;
            const take = options?.take ?? 100;
            return rows.slice(skip, skip + take);
        }),

        listCampaignMetrics: jest.fn(async (filters: any, options: any) => {
            return metricStore.filter((m) =>
                Object.entries(filters).every(([k, v]) => m[k] === v)
            );
        }),

        createCampaignMetrics: jest.fn(async (data: any | any[]) => {
            const arr = Array.isArray(data) ? data : [data];
            const created = arr.map((m, idx) => ({
                id: `mkt_cmet_${metricStore.length + idx + 1}`,
                created_at: new Date(),
                updated_at: new Date(),
                ...m,
            }));
            metricStore.push(...created);
            return Array.isArray(data) ? created : created[0];
        }),

        updateCampaignMetrics: jest.fn(async (selector: any, data: any) => {
            const record = metricStore.find((m) => m.id === selector.id);
            if (record) Object.assign(record, data, { updated_at: new Date() });
            return record;
        }),
    };

    Object.assign(service, mocks);
    (service as any).locks = new Map();

    return { service, campaignStore, eventStore, metricStore };
}

describe("Marketing Module — Campaign Engine Unit Tests", () => {
    // ── Campaign creation ─────────────────────────────────────────────────────

    it("should create a campaign in draft status by default", async () => {
        const { service, campaignStore, eventStore } = createMockService();

        const campaign = await service.createCampaign({
            name: "Diwali Festival 2026",
            type: "festival",
            budget_total: 100000,
            budget_currency: "INR",
        });

        expect(campaign.id).toBeDefined();
        expect(campaign.name).toBe("Diwali Festival 2026");
        expect(campaign.status).toBe("draft");
        expect(campaign.type).toBe("festival");
        expect(campaign.budget_spent).toBe(0);
        expect(campaign.goal_achieved).toBe(0);
        expect(campaignStore.length).toBe(1);

        // A "created" event should be logged.
        expect(eventStore.length).toBe(1);
        expect(eventStore[0].event_type).toBe("created");
    });

    it("should serialize JSON fields (targeting, channels, offer_ids) on create", async () => {
        const { service, campaignStore } = createMockService();

        await service.createCampaign({
            name: "Summer Sale",
            targeting: { segment_ids: ["seg_1"] },
            channels: [{ channel: "email", enabled: true }],
            offer_ids: ["ofr_1", "ofr_2"],
        });

        expect(campaignStore[0].targeting).toBe(JSON.stringify({ segment_ids: ["seg_1"] }));
        expect(campaignStore[0].channels).toBe(
            JSON.stringify([{ channel: "email", enabled: true }])
        );
        expect(campaignStore[0].offer_ids).toBe(JSON.stringify(["ofr_1", "ofr_2"]));
    });

    // ── Retrieve ──────────────────────────────────────────────────────────────

    it("should retrieve a campaign by id and deserialize JSON fields", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({
            name: "Test",
            targeting: { branch_ids: ["br_1"] },
        });

        const retrieved = await service.retrieveCampaignDTO(created.id);
        expect(retrieved.id).toBe(created.id);
        expect(retrieved.targeting).toEqual({ branch_ids: ["br_1"] });
    });

    it("should throw when retrieving a non-existent campaign", async () => {
        const { service } = createMockService();

        await expect(service.retrieveCampaignDTO("missing")).rejects.toThrow(
            "Campaign not found: missing"
        );
    });

    // ── Update ─────────────────────────────────────────────────────────────────

    it("should update campaign fields and log an updated event", async () => {
        const { service, eventStore } = createMockService();

        const created = await service.createCampaign({ name: "Old Name" });
        eventStore.length = 0; // clear the "created" event

        const updated = await service.updateCampaign(created.id, {
            name: "New Name",
            budget_total: 50000,
        });

        expect(updated.name).toBe("New Name");
        expect(updated.budget_total).toBe(50000);
        expect(eventStore.length).toBe(1);
        expect(eventStore[0].event_type).toBe("updated");
    });

    // ── State machine ──────────────────────────────────────────────────────────

    it("should allow draft → active transition", async () => {
        const { service, eventStore } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        eventStore.length = 0;

        const activated = await service.activateCampaign(created.id);
        expect(activated.status).toBe("active");
        expect(eventStore[0].event_type).toBe("activated");
    });

    it("should allow active → paused transition", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await service.activateCampaign(created.id);
        const paused = await service.pauseCampaign(created.id);
        expect(paused.status).toBe("paused");
    });

    it("should allow paused → active (resume) transition", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await service.activateCampaign(created.id);
        await service.pauseCampaign(created.id);
        const resumed = await service.activateCampaign(created.id);
        expect(resumed.status).toBe("active");
    });

    it("should allow active → completed (terminal) transition", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await service.activateCampaign(created.id);
        const completed = await service.completeCampaign(created.id);
        expect(completed.status).toBe("completed");
    });

    it("should allow active → cancelled (terminal) transition", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await service.activateCampaign(created.id);
        const cancelled = await service.cancelCampaign(created.id);
        expect(cancelled.status).toBe("cancelled");
    });

    it("should allow completed → archived transition", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await service.activateCampaign(created.id);
        await service.completeCampaign(created.id);
        const archived = await service.archiveCampaign(created.id);
        expect(archived.status).toBe("archived");
    });

    it("should reject invalid transition (draft → completed)", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await expect(service.completeCampaign(created.id)).rejects.toThrow(
            /Invalid campaign transition/
        );
    });

    it("should reject invalid transition (completed → active)", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        await service.activateCampaign(created.id);
        await service.completeCampaign(created.id);

        await expect(service.activateCampaign(created.id)).rejects.toThrow(
            /Invalid campaign transition/
        );
    });

    it("should treat no-op transition (same status) as a pass-through", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({ name: "C" });
        const result = await service.transitionCampaign(created.id, "draft", "draft");
        expect(result.status).toBe("draft");
    });

    // ── Scheduling eligibility ─────────────────────────────────────────────────

    it("isWithinSchedule should return false for draft campaigns", () => {
        const { service } = createMockService();
        const campaign = {
            status: "draft",
            starts_at: null,
            ends_at: null,
        } as any;
        expect(service.isWithinSchedule(campaign)).toBe(false);
    });

    it("isWithinSchedule should return true for active campaign with no schedule bounds", () => {
        const { service } = createMockService();
        const campaign = {
            status: "active",
            starts_at: null,
            ends_at: null,
        } as any;
        expect(service.isWithinSchedule(campaign)).toBe(true);
    });

    it("isWithinSchedule should return false when now is before starts_at", () => {
        const { service } = createMockService();
        const now = new Date("2026-07-17T12:00:00Z");
        const campaign = {
            status: "active",
            starts_at: new Date("2026-07-18T00:00:00Z"),
            ends_at: null,
        } as any;
        expect(service.isWithinSchedule(campaign, now)).toBe(false);
    });

    it("isWithinSchedule should return false when now is after ends_at", () => {
        const { service } = createMockService();
        const now = new Date("2026-07-17T12:00:00Z");
        const campaign = {
            status: "active",
            starts_at: null,
            ends_at: new Date("2026-07-16T00:00:00Z"),
        } as any;
        expect(service.isWithinSchedule(campaign, now)).toBe(false);
    });

    it("isWithinSchedule should return true when now is within the window", () => {
        const { service } = createMockService();
        const now = new Date("2026-07-17T12:00:00Z");
        const campaign = {
            status: "active",
            starts_at: new Date("2026-07-16T00:00:00Z"),
            ends_at: new Date("2026-07-18T00:00:00Z"),
        } as any;
        expect(service.isWithinSchedule(campaign, now)).toBe(true);
    });

    it("listEligibleCampaigns should return only active + in-schedule + budget-not-exhausted", async () => {
        const { service } = createMockService();
        const now = new Date("2026-07-17T12:00:00Z");

        // Active, in schedule, budget remaining → eligible
        const c1 = await service.createCampaign({ name: "Eligible", budget_total: 10000 });
        await service.activateCampaign(c1.id);

        // Active but budget exhausted → not eligible
        const c2 = await service.createCampaign({ name: "Exhausted", budget_total: 1000 });
        await service.activateCampaign(c2.id);
        await service.recordSpend(c2.id, 1000);

        // Draft → not eligible
        await service.createCampaign({ name: "Draft" });

        const eligible = await service.listEligibleCampaigns(now);
        const names = eligible.map((c) => c.name);
        expect(names).toContain("Eligible");
        expect(names).not.toContain("Exhausted");
        expect(names).not.toContain("Draft");
    });

    // ── Budget & goal tracking ────────────────────────────────────────────────

    it("recordSpend should increment budget_spent and goal_achieved atomically", async () => {
        const { service } = createMockService();

        const created = await service.createCampaign({
            name: "C",
            budget_total: 10000,
            goal_type: "orders",
            goal_target: 5,
        });
        await service.activateCampaign(created.id);

        const after = await service.recordSpend(created.id, 2000, 2);
        expect(after.budget_spent).toBe(2000);
        expect(after.goal_achieved).toBe(2);
    });

    it("recordSpend should emit budget_threshold_reached at 80%", async () => {
        const { service, eventStore } = createMockService();

        const created = await service.createCampaign({
            name: "C",
            budget_total: 10000,
        });
        await service.activateCampaign(created.id);
        eventStore.length = 0;

        await service.recordSpend(created.id, 8000);
        const thresholdEvents = eventStore.filter(
            (e) => e.event_type === "budget_threshold_reached"
        );
        expect(thresholdEvents.length).toBe(1);
        expect(thresholdEvents[0].note).toContain("80%");
    });

    it("recordSpend should emit budget_threshold_reached at 100%", async () => {
        const { service, eventStore } = createMockService();

        const created = await service.createCampaign({
            name: "C",
            budget_total: 10000,
        });
        await service.activateCampaign(created.id);
        eventStore.length = 0;

        await service.recordSpend(created.id, 10000);
        const fullEvents = eventStore.filter(
            (e) =>
                e.event_type === "budget_threshold_reached" &&
                e.note?.includes("100%")
        );
        expect(fullEvents.length).toBe(1);
    });

    it("recordSpend should emit goal_reached when goal_achieved crosses target", async () => {
        const { service, eventStore } = createMockService();

        const created = await service.createCampaign({
            name: "C",
            goal_type: "orders",
            goal_target: 10,
        });
        await service.activateCampaign(created.id);
        eventStore.length = 0;

        await service.recordSpend(created.id, 0, 10);
        const goalEvents = eventStore.filter((e) => e.event_type === "goal_reached");
        expect(goalEvents.length).toBe(1);
        expect(goalEvents[0].note).toContain("orders");
    });

    it("recordSpend should not emit goal_reached if goal already met", async () => {
        const { service, eventStore } = createMockService();

        const created = await service.createCampaign({
            name: "C",
            goal_type: "orders",
            goal_target: 5,
        });
        await service.activateCampaign(created.id);

        await service.recordSpend(created.id, 0, 5);
        eventStore.length = 0;
        await service.recordSpend(created.id, 0, 3);

        const goalEvents = eventStore.filter((e) => e.event_type === "goal_reached");
        expect(goalEvents.length).toBe(0);
    });

    // ── Event log ─────────────────────────────────────────────────────────────

    it("recordEvent should persist an event with serialized payload", async () => {
        const { service, eventStore } = createMockService();

        const event = await service.recordEvent({
            campaign_id: "mkt_camp_1",
            event_type: "channel_dispatched",
            actor: "system",
            note: "Email sent",
            payload: { channel: "email", count: 500 },
        });

        expect(event.event_type).toBe("channel_dispatched");
        expect(eventStore[0].payload).toBe(JSON.stringify({ channel: "email", count: 500 }));
    });

    it("listCampaignEventsDTO should return events for a campaign in desc order", async () => {
        const { service } = createMockService();

        await service.recordEvent({
            campaign_id: "c1",
            event_type: "created",
        });
        await new Promise((r) => setTimeout(r, 5));
        await service.recordEvent({
            campaign_id: "c1",
            event_type: "activated",
        });

        const events = await service.listCampaignEventsDTO("c1");
        expect(events.length).toBe(2);
        // Desc order: activated (later) first
        expect(events[0].event_type).toBe("activated");
        expect(events[1].event_type).toBe("created");
    });

    // ── Metrics upsert ─────────────────────────────────────────────────────────

    it("upsertMetric should create a new metric row when none exists", async () => {
        const { service, metricStore } = createMockService();

        const metric = await service.upsertMetric({
            campaign_id: "c1",
            metric: "clicks",
            period: "2026-07-17",
            granularity: "day",
            value: 42,
        });

        expect(metric.value).toBe(42);
        expect(metricStore.length).toBe(1);
    });

    it("upsertMetric should update an existing metric row in place", async () => {
        const { service, metricStore } = createMockService();

        await service.upsertMetric({
            campaign_id: "c1",
            metric: "clicks",
            period: "2026-07-17",
            granularity: "day",
            value: 42,
        });
        const updated = await service.upsertMetric({
            campaign_id: "c1",
            metric: "clicks",
            period: "2026-07-17",
            granularity: "day",
            value: 100,
        });

        expect(updated.value).toBe(100);
        expect(metricStore.length).toBe(1); // no duplicate
    });

    it("listCampaignMetricsDTO should filter by metric and granularity", async () => {
        const { service } = createMockService();

        await service.upsertMetric({
            campaign_id: "c1",
            metric: "clicks",
            period: "2026-07-17",
            value: 10,
        });
        await service.upsertMetric({
            campaign_id: "c1",
            metric: "revenue",
            period: "2026-07-17",
            value: 5000,
        });

        const clicks = await service.listCampaignMetricsDTO("c1", { metric: "clicks" });
        expect(clicks.length).toBe(1);
        expect(clicks[0].metric).toBe("clicks");
    });

    // ── Dashboard overview ─────────────────────────────────────────────────────

    it("getOverview should aggregate counts by status and budget totals", async () => {
        const { service } = createMockService();

        const c1 = await service.createCampaign({
            name: "A",
            budget_total: 10000,
        });
        const c2 = await service.createCampaign({
            name: "B",
            budget_total: 20000,
        });
        await service.activateCampaign(c1.id);
        await service.recordSpend(c1.id, 3000);

        const overview = await service.getOverview();
        expect(overview.total).toBe(2);
        expect(overview.by_status.draft).toBe(1);
        expect(overview.by_status.active).toBe(1);
        expect(overview.active).toBe(1);
        expect(overview.total_budget_allocated).toBe(30000);
        expect(overview.total_budget_spent).toBe(3000);
    });

    // ── Delete ─────────────────────────────────────────────────────────────────

    it("deleteCampaign should remove the campaign", async () => {
        const { service, campaignStore } = createMockService();

        const created = await service.createCampaign({ name: "To Delete" });
        await service.deleteCampaign(created.id);
        expect(campaignStore.length).toBe(0);
    });

    // ── State machine constants ────────────────────────────────────────────────

    it("CAMPAIGN_TRANSITIONS should define valid forward paths for all states", () => {
        const states = Object.keys(CAMPAIGN_TRANSITIONS);
        expect(states).toContain("draft");
        expect(states).toContain("active");
        expect(states).toContain("paused");
        expect(states).toContain("completed");
        expect(states).toContain("cancelled");
        expect(states).toContain("archived");
    });

    it("ACTIVE_CAMPAIGN_STATES should only contain active", () => {
        expect(ACTIVE_CAMPAIGN_STATES).toEqual(["active"]);
    });

    it("TERMINAL_CAMPAIGN_STATES should include completed, cancelled, archived", () => {
        expect(TERMINAL_CAMPAIGN_STATES).toContain("completed");
        expect(TERMINAL_CAMPAIGN_STATES).toContain("cancelled");
        expect(TERMINAL_CAMPAIGN_STATES).toContain("archived");
    });
});
