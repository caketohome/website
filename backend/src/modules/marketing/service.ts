import { MedusaService } from "@medusajs/utils";
import {
    Campaign,
    CampaignEvent,
    CampaignMetric,
    Popup,
    GamificationReward,
    QRCode,
    NewsletterSubscriber,
    RecoveryJob,
} from "./models";
import {
    CAMPAIGN_TRANSITIONS,
    ACTIVE_CAMPAIGN_STATES,
    type CampaignStatus,
    type CampaignEventType,
    type CampaignEventActor,
    type CreateCampaignDTO,
    type UpdateCampaignDTO,
    type CampaignDTO,
    type CreateCampaignEventDTO,
    type CampaignEventDTO,
    type CreateCampaignMetricDTO,
    type CampaignMetricDTO,
    type TargetingSpec,
    type ChannelConfig,
} from "./types/common";

/**
 * Marketing Module Service — Phase 9 Milestone 9.1.
 *
 * Owns the marketing campaign lifecycle: creation, update, validated state
 * transitions, scheduling eligibility, budget/goal tracking, append-only
 * event log, and denormalized metric rollups. Integrates with M5 Analytics
 * (best-effort event mirroring) and M6 Notification (channel dispatch is
 * wired in Milestone 9.4 — this service exposes the channel config only).
 *
 * Naming convention: MedusaService auto-generates `listCampaigns`,
 * `listAndCountCampaigns`, `listCampaignEvents`, `listCampaignMetrics`
 * (returning raw model rows). This class exposes DTO-returning variants
 * suffixed with `DTO` (`listCampaignsDTO`, `listCampaignEventsDTO`,
 * `listCampaignMetricsDTO`) and a `retrieveCampaignDTO` accessor so there
 * is no method-name shadowing and no `@ts-ignore` is required.
 *
 * Concurrency: campaign state transitions and budget mutations are guarded
 * by an in-memory mutex keyed by campaign id, mirroring the pattern used
 * by the Rewards module. This prevents race conditions when two admin
 * actions or a scheduler + admin action hit the same campaign concurrently.
 */
class MarketingModuleService extends (MedusaService({
    Campaign,
    CampaignEvent,
    CampaignMetric,
    Popup,
    GamificationReward,
    QRCode,
    NewsletterSubscriber,
    RecoveryJob,
}) as any) {
    private locks = new Map<string, Promise<void>>();
    protected container: any;

    constructor(dependencies: any, ...args: any[]) {
        super(dependencies, ...args);
        this.container = dependencies;
    }

    // ── Concurrency ──────────────────────────────────────────────────────────

    private async acquireLock(key: string): Promise<() => void> {
        let resolveLock: () => void = () => { };
        const newLock = new Promise<void>((resolve) => {
            resolveLock = resolve;
        });

        const existingLock = this.locks.get(key) || Promise.resolve();
        this.locks.set(key, newLock);

        await existingLock;
        return () => {
            resolveLock();
            if (this.locks.get(key) === newLock) {
                this.locks.delete(key);
            }
        };
    }

    // ── Analytics hook (best-effort) ─────────────────────────────────────────

    private async trackAnalytics(
        eventName: string,
        campaignId: string,
        metadata: Record<string, unknown>
    ): Promise<void> {
        try {
            const analyticsModule = this.container.analyticsModuleService;
            if (analyticsModule && typeof analyticsModule.track === "function") {
                await analyticsModule.track({
                    event_type: eventName,
                    entity_id: campaignId,
                    payload: metadata,
                });
            }
        } catch {
            // Analytics failures must never break campaign operations.
        }
    }

    // ── Serialization helpers ────────────────────────────────────────────────

    private parseJSON<T>(raw: string | null | undefined, fallback: T): T {
        if (!raw) return fallback;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return fallback;
        }
    }

    private serializeJSON(value: unknown): string | null {
        if (value === null || value === undefined) return null;
        return JSON.stringify(value);
    }

    private toCampaignDTO(row: any): CampaignDTO {
        return {
            id: row.id,
            name: row.name,
            description: row.description ?? null,
            type: row.type ?? "promotion",
            status: row.status ?? "draft",
            starts_at: row.starts_at ?? null,
            ends_at: row.ends_at ?? null,
            budget_total: row.budget_total ?? null,
            budget_currency: row.budget_currency ?? null,
            budget_spent: row.budget_spent ?? 0,
            goal_type: row.goal_type ?? null,
            goal_target: row.goal_target ?? null,
            goal_achieved: row.goal_achieved ?? 0,
            targeting: this.parseJSON<TargetingSpec | null>(row.targeting, null),
            channels: this.parseJSON<ChannelConfig[] | null>(row.channels, null),
            offer_ids: this.parseJSON<string[] | null>(row.offer_ids, null),
            segment_ids: this.parseJSON<string[] | null>(row.segment_ids, null),
            branch_ids: this.parseJSON<string[] | null>(row.branch_ids, null),
            automation_flow_ids: this.parseJSON<string[] | null>(
                row.automation_flow_ids,
                null
            ),
            is_featured: row.is_featured ?? false,
            sort_order: row.sort_order ?? 0,
            metadata: this.parseJSON<Record<string, unknown> | null>(
                row.metadata,
                null
            ),
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    private toCampaignEventDTO(row: any): CampaignEventDTO {
        return {
            id: row.id,
            campaign_id: row.campaign_id,
            event_type: row.event_type,
            actor: row.actor ?? "system",
            note: row.note ?? null,
            payload: this.parseJSON<Record<string, unknown> | null>(
                row.payload,
                null
            ),
            created_at: row.created_at,
        };
    }

    private toCampaignMetricDTO(row: any): CampaignMetricDTO {
        return {
            id: row.id,
            campaign_id: row.campaign_id,
            metric: row.metric,
            period: row.period,
            granularity: row.granularity ?? "day",
            value: row.value ?? 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    // ── Campaign CRUD ────────────────────────────────────────────────────────

    async createCampaign(input: CreateCampaignDTO): Promise<CampaignDTO> {
        const status: CampaignStatus = input.status ?? "draft";
        const created = await this.createCampaigns({
            name: input.name,
            description: input.description ?? null,
            type: input.type ?? "promotion",
            status,
            starts_at: input.starts_at ? new Date(input.starts_at) : null,
            ends_at: input.ends_at ? new Date(input.ends_at) : null,
            budget_total: input.budget_total ?? null,
            budget_currency: input.budget_currency ?? null,
            budget_spent: 0,
            goal_type: input.goal_type ?? null,
            goal_target: input.goal_target ?? null,
            goal_achieved: 0,
            targeting: this.serializeJSON(input.targeting),
            channels: this.serializeJSON(input.channels),
            offer_ids: this.serializeJSON(input.offer_ids),
            segment_ids: this.serializeJSON(input.segment_ids),
            branch_ids: this.serializeJSON(input.branch_ids),
            automation_flow_ids: this.serializeJSON(input.automation_flow_ids),
            is_featured: input.is_featured ?? false,
            sort_order: input.sort_order ?? 0,
            metadata: this.serializeJSON(input.metadata),
        });

        const dto = this.toCampaignDTO(created);

        await this.recordEvent({
            campaign_id: dto.id,
            event_type: "created",
            actor: "admin",
            note: `Campaign "${dto.name}" created`,
            payload: { status: dto.status, type: dto.type },
        });
        await this.trackAnalytics("campaign_created", dto.id, {
            name: dto.name,
            type: dto.type,
        });

        return dto;
    }

    async updateCampaign(
        id: string,
        input: UpdateCampaignDTO
    ): Promise<CampaignDTO> {
        const release = await this.acquireLock(`campaign:${id}`);
        try {
            const existing = await this.retrieveCampaignDTO(id);
            const patch: Record<string, unknown> = {};

            if (input.name !== undefined) patch.name = input.name;
            if (input.description !== undefined)
                patch.description = input.description;
            if (input.type !== undefined) patch.type = input.type;
            if (input.starts_at !== undefined)
                patch.starts_at = input.starts_at ? new Date(input.starts_at) : null;
            if (input.ends_at !== undefined)
                patch.ends_at = input.ends_at ? new Date(input.ends_at) : null;
            if (input.budget_total !== undefined)
                patch.budget_total = input.budget_total;
            if (input.budget_currency !== undefined)
                patch.budget_currency = input.budget_currency;
            if (input.budget_spent !== undefined)
                patch.budget_spent = input.budget_spent;
            if (input.goal_type !== undefined) patch.goal_type = input.goal_type;
            if (input.goal_target !== undefined)
                patch.goal_target = input.goal_target;
            if (input.goal_achieved !== undefined)
                patch.goal_achieved = input.goal_achieved;
            if (input.targeting !== undefined)
                patch.targeting = this.serializeJSON(input.targeting);
            if (input.channels !== undefined)
                patch.channels = this.serializeJSON(input.channels);
            if (input.offer_ids !== undefined)
                patch.offer_ids = this.serializeJSON(input.offer_ids);
            if (input.segment_ids !== undefined)
                patch.segment_ids = this.serializeJSON(input.segment_ids);
            if (input.branch_ids !== undefined)
                patch.branch_ids = this.serializeJSON(input.branch_ids);
            if (input.automation_flow_ids !== undefined)
                patch.automation_flow_ids = this.serializeJSON(
                    input.automation_flow_ids
                );
            if (input.is_featured !== undefined)
                patch.is_featured = input.is_featured;
            if (input.sort_order !== undefined)
                patch.sort_order = input.sort_order;
            if (input.metadata !== undefined)
                patch.metadata = this.serializeJSON(input.metadata);

            // Status changes go through the transition validator, not a raw patch.
            if (input.status !== undefined && input.status !== existing.status) {
                const updated = await this.updateCampaigns({ id }, patch);
                const dto = this.toCampaignDTO(updated);
                await this.transitionCampaign(id, existing.status, input.status);
                return dto;
            }

            const updated = await this.updateCampaigns({ id }, patch);
            const dto = this.toCampaignDTO(updated);

            await this.recordEvent({
                campaign_id: id,
                event_type: "updated",
                actor: "admin",
                note: "Campaign updated",
                payload: { changed_fields: Object.keys(patch) },
            });

            return dto;
        } finally {
            release();
        }
    }

    async retrieveCampaignDTO(id: string): Promise<CampaignDTO> {
        const rows = await this.listCampaigns({ id });
        if (!rows || rows.length === 0) {
            throw new Error(`Campaign not found: ${id}`);
        }
        return this.toCampaignDTO(rows[0]);
    }

    async listCampaignsDTO(
        filters: Record<string, unknown> = {},
        options: {
            skip?: number;
            take?: number;
            order?: Record<string, "ASC" | "DESC">;
        } = {}
    ): Promise<CampaignDTO[]> {
        const rows = await this.listCampaigns(filters, {
            skip: options.skip ?? 0,
            take: options.take ?? 50,
            order: options.order ?? { created_at: "DESC" },
        });
        return rows.map((r: any) => this.toCampaignDTO(r));
    }

    async listAndCountCampaignsDTO(
        filters: Record<string, unknown> = {},
        options: {
            skip?: number;
            take?: number;
            order?: Record<string, "ASC" | "DESC">;
        } = {}
    ): Promise<[CampaignDTO[], number]> {
        const [rows, count] = await this.listAndCountCampaigns(filters, {
            skip: options.skip ?? 0,
            take: options.take ?? 50,
            order: options.order ?? { created_at: "DESC" },
        });
        return [rows.map((r: any) => this.toCampaignDTO(r)), count];
    }

    async deleteCampaign(id: string): Promise<void> {
        const release = await this.acquireLock(`campaign:${id}`);
        try {
            await this.deleteCampaigns([id]);
            await this.trackAnalytics("campaign_deleted", id, {});
        } finally {
            release();
        }
    }

    // ── State machine ────────────────────────────────────────────────────────

    /**
     * Validate and apply a campaign status transition. Throws if the
     * transition is not permitted by CAMPAIGN_TRANSITIONS.
     */
    async transitionCampaign(
        id: string,
        from: CampaignStatus,
        to: CampaignStatus
    ): Promise<CampaignDTO> {
        if (from === to) {
            return this.retrieveCampaignDTO(id);
        }
        const allowed = CAMPAIGN_TRANSITIONS[from] ?? [];
        if (!allowed.includes(to)) {
            throw new Error(`Invalid campaign transition: ${from} → ${to}`);
        }

        const release = await this.acquireLock(`campaign:${id}`);
        try {
            const updated = await this.updateCampaigns({ id }, { status: to });
            const dto = this.toCampaignDTO(updated);

            const eventType = this.transitionEventType(to);
            await this.recordEvent({
                campaign_id: id,
                event_type: eventType,
                actor: "admin",
                note: `Status transitioned ${from} → ${to}`,
                payload: { from, to },
            });
            await this.trackAnalytics(`campaign_${to}`, id, { from, to });

            return dto;
        } finally {
            release();
        }
    }

    private transitionEventType(to: CampaignStatus): CampaignEventType {
        switch (to) {
            case "active":
                return "activated";
            case "paused":
                return "paused";
            case "completed":
                return "completed";
            case "cancelled":
                return "cancelled";
            case "archived":
                return "archived";
            default:
                return "updated";
        }
    }

    /** Convenience: activate a campaign (draft/paused → active). */
    async activateCampaign(id: string): Promise<CampaignDTO> {
        const current = await this.retrieveCampaignDTO(id);
        return this.transitionCampaign(id, current.status, "active");
    }

    /** Convenience: pause an active campaign. */
    async pauseCampaign(id: string): Promise<CampaignDTO> {
        const current = await this.retrieveCampaignDTO(id);
        return this.transitionCampaign(id, current.status, "paused");
    }

    /** Convenience: mark a campaign completed (terminal). */
    async completeCampaign(id: string): Promise<CampaignDTO> {
        const current = await this.retrieveCampaignDTO(id);
        return this.transitionCampaign(id, current.status, "completed");
    }

    /** Convenience: cancel a campaign (terminal). */
    async cancelCampaign(id: string): Promise<CampaignDTO> {
        const current = await this.retrieveCampaignDTO(id);
        return this.transitionCampaign(id, current.status, "cancelled");
    }

    /** Convenience: archive a campaign. */
    async archiveCampaign(id: string): Promise<CampaignDTO> {
        const current = await this.retrieveCampaignDTO(id);
        return this.transitionCampaign(id, current.status, "archived");
    }

    // ── Scheduling eligibility ───────────────────────────────────────────────

    /**
     * Returns true if the campaign is currently within its scheduled window
     * (starts_at ≤ now ≤ ends_at) and is in an active state. Campaigns with
     * null starts_at are treated as eligible from the dawn of time; null
     * ends_at means no expiry.
     */
    isWithinSchedule(campaign: CampaignDTO, now: Date = new Date()): boolean {
        if (!ACTIVE_CAMPAIGN_STATES.includes(campaign.status)) return false;
        const ts = now.getTime();
        if (campaign.starts_at && ts < campaign.starts_at.getTime()) return false;
        if (campaign.ends_at && ts > campaign.ends_at.getTime()) return false;
        return true;
    }

    /**
     * List all campaigns that are currently eligible to run (active + within
     * schedule + budget not exhausted). Used by the scheduler/dispatcher
     * (Milestone 9.4) and by the storefront public-campaigns endpoint.
     */
    async listEligibleCampaigns(now: Date = new Date()): Promise<CampaignDTO[]> {
        const all = await this.listCampaignsDTO({ status: "active" }, { take: 500 });
        return all.filter((c) => {
            if (!this.isWithinSchedule(c, now)) return false;
            if (c.budget_total !== null && c.budget_spent >= c.budget_total) {
                return false;
            }
            return true;
        });
    }

    // ── Budget & goal tracking ────────────────────────────────────────────────

    /**
     * Atomically increment budget_spent by `amount`. Emits a
     * budget_threshold_reached event when spend crosses 80% / 100% of the
     * budget, and a goal_reached event when goal_achieved crosses goal_target.
     * Returns the updated campaign.
     */
    async recordSpend(
        id: string,
        amount: number,
        goalDelta: number = 0
    ): Promise<CampaignDTO> {
        const release = await this.acquireLock(`campaign:${id}`);
        try {
            const current = await this.retrieveCampaignDTO(id);
            const newSpent = (current.budget_spent ?? 0) + amount;
            const newAchieved = (current.goal_achieved ?? 0) + goalDelta;

            const updated = await this.updateCampaigns(
                { id },
                { budget_spent: newSpent, goal_achieved: newAchieved }
            );
            const dto = this.toCampaignDTO(updated);

            // Budget threshold events
            if (current.budget_total !== null && current.budget_total > 0) {
                const prevPct = (current.budget_spent / current.budget_total) * 100;
                const newPct = (newSpent / current.budget_total) * 100;
                if (prevPct < 80 && newPct >= 80) {
                    await this.recordEvent({
                        campaign_id: id,
                        event_type: "budget_threshold_reached",
                        actor: "system",
                        note: `Budget 80% threshold reached (${newPct.toFixed(1)}%)`,
                        payload: { spent: newSpent, total: current.budget_total },
                    });
                }
                if (prevPct < 100 && newPct >= 100) {
                    await this.recordEvent({
                        campaign_id: id,
                        event_type: "budget_threshold_reached",
                        actor: "system",
                        note: `Budget fully consumed (100%)`,
                        payload: { spent: newSpent, total: current.budget_total },
                    });
                }
            }

            // Goal reached event
            if (
                current.goal_target !== null &&
                current.goal_target > 0 &&
                current.goal_achieved < current.goal_target &&
                newAchieved >= current.goal_target
            ) {
                await this.recordEvent({
                    campaign_id: id,
                    event_type: "goal_reached",
                    actor: "system",
                    note: `Goal "${current.goal_type}" reached (${newAchieved}/${current.goal_target})`,
                    payload: {
                        goal_type: current.goal_type,
                        achieved: newAchieved,
                        target: current.goal_target,
                    },
                });
            }

            await this.trackAnalytics("campaign_spend", id, {
                amount,
                total_spent: newSpent,
            });

            return dto;
        } finally {
            release();
        }
    }

    // ── Event log ────────────────────────────────────────────────────────────

    async recordEvent(input: CreateCampaignEventDTO): Promise<CampaignEventDTO> {
        const actor: CampaignEventActor = input.actor ?? "system";
        const created = await this.createCampaignEvents({
            campaign_id: input.campaign_id,
            event_type: input.event_type,
            actor,
            note: input.note ?? null,
            payload: this.serializeJSON(input.payload),
        });
        return this.toCampaignEventDTO(created);
    }

    async listCampaignEventsDTO(
        campaignId: string,
        options: { skip?: number; take?: number } = {}
    ): Promise<CampaignEventDTO[]> {
        const rows = await this.listCampaignEvents(
            { campaign_id: campaignId },
            {
                skip: options.skip ?? 0,
                take: options.take ?? 100,
                order: { created_at: "DESC" },
            }
        );
        return rows.map((r: any) => this.toCampaignEventDTO(r));
    }

    // ── Metrics rollup ──────────────────────────────────────────────────────

    async upsertMetric(input: CreateCampaignMetricDTO): Promise<CampaignMetricDTO> {
        const granularity = input.granularity ?? "day";
        // Upsert by (campaign_id, metric, period, granularity).
        const existing = await this.listCampaignMetrics({
            campaign_id: input.campaign_id,
            metric: input.metric,
            period: input.period,
            granularity,
        });

        if (existing.length > 0) {
            const updated = await this.updateCampaignMetrics(
                { id: existing[0].id },
                { value: input.value }
            );
            return this.toCampaignMetricDTO(updated);
        }

        const created = await this.createCampaignMetrics({
            campaign_id: input.campaign_id,
            metric: input.metric,
            period: input.period,
            granularity,
            value: input.value,
        });
        return this.toCampaignMetricDTO(created);
    }

    async listCampaignMetricsDTO(
        campaignId: string,
        filters: { metric?: string; granularity?: string } = {}
    ): Promise<CampaignMetricDTO[]> {
        const query: Record<string, unknown> = { campaign_id: campaignId };
        if (filters.metric) query.metric = filters.metric;
        if (filters.granularity) query.granularity = filters.granularity;
        const rows = await this.listCampaignMetrics(query, {
            take: 500,
            order: { period: "ASC" },
        });
        return rows.map((r: any) => this.toCampaignMetricDTO(r));
    }

    // ── Dashboard helpers ─────────────────────────────────────────────────────

    /**
     * Aggregated overview for the marketing admin dashboard: counts by
     * status, total budget allocated, total spent, active campaign count.
     */
    async getOverview(): Promise<{
        total: number;
        by_status: Record<string, number>;
        active: number;
        total_budget_allocated: number;
        total_budget_spent: number;
    }> {
        const all = await this.listCampaignsDTO({}, { take: 1000 });
        const by_status: Record<string, number> = {};
        let active = 0;
        let total_budget_allocated = 0;
        let total_budget_spent = 0;

        for (const c of all) {
            by_status[c.status] = (by_status[c.status] ?? 0) + 1;
            if (ACTIVE_CAMPAIGN_STATES.includes(c.status)) active++;
            if (c.budget_total !== null) total_budget_allocated += c.budget_total;
            total_budget_spent += c.budget_spent ?? 0;
        }

        return {
            total: all.length,
            by_status,
            active,
            total_budget_allocated,
            total_budget_spent,
        };
    }

    /**
     * Validates coupon stacking rules and exclusion priorities.
     * Enforces that non-stackable coupons (e.g. CAKE50, SECRET15) cannot be combined with existing promo codes.
     */
    async validateCouponStacking(
        appliedCodes: string[],
        newCode: string
    ): Promise<{ valid: boolean; reason?: string }> {
        if (!newCode || newCode.trim().length === 0) {
            return { valid: false, reason: "Coupon code is required." };
        }

        if (!appliedCodes || appliedCodes.length === 0) {
            return { valid: true };
        }

        const exclusiveCodes = ["CAKE50", "SECRET15", "RECOVER10", "BIRTHDAY100"];
        const normalizedNew = newCode.toUpperCase().trim();
        const normalizedApplied = appliedCodes.map((c) => c.toUpperCase().trim());

        if (exclusiveCodes.includes(normalizedNew) && normalizedApplied.length > 0) {
            return {
                valid: false,
                reason: `Promo code "${newCode}" cannot be combined with other active discounts.`,
            };
        }

        for (const existing of normalizedApplied) {
            if (exclusiveCodes.includes(existing)) {
                return {
                    valid: false,
                    reason: `Existing promo code "${existing}" excludes additional coupon stacking.`,
                };
            }
        }

        return { valid: true };
    }
}

export default MarketingModuleService;
