import { model } from "@medusajs/utils";

/**
 * Marketing Campaign — Phase 9 Milestone 9.1.
 *
 * Enterprise marketing campaign engine. A Campaign is a scheduled, budgeted,
 * targeted marketing initiative that orchestrates offers (M2 Rules Engine),
 * segments (Milestone 9.3), automation flows (Milestone 9.4), and channels
 * (email/SMS/WhatsApp/push — M6 Notification).
 *
 * Lifecycle: draft → active → paused → archived (with terminal `completed`
 * and `cancelled` states). State transitions are validated by the service.
 *
 * This model is intentionally distinct from the CRM `crm_campaign` entity
 * (Phase 8), which is a lightweight reward-dispatch campaign. The marketing
 * campaign is the full marketing-operations object: budget, goals, audience
 * targeting, scheduling, channel mix, and analytics hooks.
 *
 * Integrations (read-only / by-reference — no business logic duplication):
 *  - Offers: `offer_ids` JSON references M2 Offer records (coupons/promos).
 *  - Segments: `segment_ids` JSON references Milestone 9.3 segments.
 *  - Branches: `branch_ids` JSON references Shop Branch records.
 *  - Analytics: hooks emit events via M5 AnalyticsModuleService.
 *  - Notifications: dispatched via M6 NotificationModuleService.
 */
export const Campaign = model.define("marketing_campaign", {
    id: model
        .id({
            prefix: "mkt_camp",
        })
        .primaryKey(),
    /** Human-readable campaign name (admin-facing) */
    name: model.text(),
    /** Admin-facing description / brief */
    description: model.text().nullable(),
    /** Campaign type — drives UI grouping & analytics categorization */
    type: model.text().default("promotion"),
    /** Lifecycle status: draft | active | paused | completed | cancelled | archived */
    status: model.text().default("draft"),
    /** Activation timestamp (campaign becomes eligible to run at/after this) */
    starts_at: model.dateTime().nullable(),
    /** Expiration timestamp (campaign stops being eligible after this) */
    ends_at: model.dateTime().nullable(),
    /** Total budget in minor units (paise/cents). NULL = unlimited. */
    budget_total: model.number().nullable(),
    /** Currency code (ISO 4217) for the budget, e.g. "INR" */
    budget_currency: model.text().nullable(),
    /** Amount spent so far in minor units (denormalized from analytics/redemptions) */
    budget_spent: model.number().default(0),
    /** Primary goal type: revenue | orders | conversions | clicks | reach | retention */
    goal_type: model.text().nullable(),
    /** Target value for the goal (e.g. target revenue in minor units, target order count) */
    goal_target: model.number().nullable(),
    /** Achieved value for the goal (denormalized from analytics) */
    goal_achieved: model.number().default(0),
    /**
     * Audience targeting spec — JSON-serialized TargetingSpec.
     * References segment_ids, branch_ids, customer tags, geographic region,
     * loyalty tier (read-only), etc. Evaluated by the segmentation engine
     * (Milestone 9.3) — this model only stores the spec.
     */
    targeting: model.text().nullable(),
    /**
     * Channel mix — JSON-serialized ChannelConfig[].
     * Each entry: { channel: "email"|"sms"|"whatsapp"|"push"|"in_app"|"webhook",
     *              template_id?: string, enabled: boolean, weight?: number }
     */
    channels: model.text().nullable(),
    /** JSON-serialized string[] — Offer IDs (M2) linked to this campaign */
    offer_ids: model.text().nullable(),
    /** JSON-serialized string[] — Segment IDs (Milestone 9.3) linked to this campaign */
    segment_ids: model.text().nullable(),
    /** JSON-serialized string[] — Branch IDs (Shop) this campaign is scoped to */
    branch_ids: model.text().nullable(),
    /** JSON-serialized string[] — Automation Flow IDs (Milestone 9.4) to trigger */
    automation_flow_ids: model.text().nullable(),
    /** Whether this campaign is featured/visible on the storefront */
    is_featured: model.boolean().default(false),
    /** Sort order for storefront display */
    sort_order: model.number().default(0),
    /** JSON-serialized Record<string, unknown> — freeform metadata */
    metadata: model.text().nullable(),
});

/**
 * Campaign Event — append-only audit + analytics hook log.
 *
 * Every meaningful campaign lifecycle event is recorded here for the
 * unified timeline, audit trail, and analytics aggregation:
 *   created, activated, paused, resumed, completed, cancelled, archived,
 *   budget_threshold_reached, goal_reached, channel_dispatched, offer_redeemed.
 *
 * This is the marketing-domain event log; it complements (does not
 * duplicate) the M5 Analytics event stream — analytics events are
 * best-effort mirrored via the service's trackAnalytics helper.
 */
export const CampaignEvent = model.define("marketing_campaign_event", {
    id: model
        .id({
            prefix: "mkt_cev",
        })
        .primaryKey(),
    campaign_id: model.text(),
    /** Event type (see class docstring for the enumerated set) */
    event_type: model.text(),
    /** Actor who triggered the event: "admin" | "system" | "scheduler" | "customer" */
    actor: model.text().default("system"),
    /** Human-readable event detail / reason */
    note: model.text().nullable(),
    /** JSON-serialized payload snapshot (context, deltas, channel info, etc.) */
    payload: model.text().nullable(),
});

/**
 * Campaign Metric — denormalized rollup for the marketing analytics dashboard
 * (Milestone 9.7). One row per (campaign, metric, period) tuple.
 *
 * Populated by scheduled aggregation jobs from M5 Analytics events +
 * CampaignEvent log. Stored locally to keep dashboard queries O(campaigns)
 * rather than scanning the full analytics event stream.
 */
export const CampaignMetric = model.define("marketing_campaign_metric", {
    id: model
        .id({
            prefix: "mkt_cmet",
        })
        .primaryKey(),
    campaign_id: model.text(),
    /** Metric key: impressions | clicks | conversions | revenue | orders | spend | roi | ctr | cpc | cpa */
    metric: model.text(),
    /** Period bucket key, e.g. "2026-07-17" (day) or "2026-W29" (week) or "2026-07" (month) */
    period: model.text(),
    /** Granularity: day | week | month */
    granularity: model.text().default("day"),
    /** Numeric value for the metric in this period */
    value: model.number().default(0),
});
