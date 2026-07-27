/**
 * Shared types for the Marketing module (Phase 9).
 *
 * These DTOs are consumed by the service layer, API routes, admin UI hooks,
 * and the storefront SDK. They are intentionally framework-agnostic (no
 * MikroORM / Medusa runtime types) so they can be imported anywhere.
 */

// ── Campaign ────────────────────────────────────────────────────────────────

export type CampaignStatus =
    | "draft"
    | "active"
    | "paused"
    | "completed"
    | "cancelled"
    | "archived";

export type CampaignType =
    | "promotion"
    | "seasonal"
    | "flash_sale"
    | "retention"
    | "acquisition"
    | "winback"
    | "brand"
    | "loyalty"
    | "referral"
    | "birthday"
    | "anniversary"
    | "festival";

export type CampaignGoalType =
    | "revenue"
    | "orders"
    | "conversions"
    | "clicks"
    | "reach"
    | "retention";

export type CampaignChannel =
    | "email"
    | "sms"
    | "whatsapp"
    | "push"
    | "in_app"
    | "webhook";

export interface ChannelConfig {
    channel: CampaignChannel;
    template_id?: string;
    enabled: boolean;
    weight?: number;
}

export interface TargetingSpec {
    /** Segment IDs (Milestone 9.3) to include */
    segment_ids?: string[];
    /** Branch IDs (Shop) to scope to */
    branch_ids?: string[];
    /** Customer tags to include */
    customer_tags?: string[];
    /** Geographic region filter (city/state/pincode) */
    region?: { cities?: string[]; states?: string[]; pincodes?: string[] };
    /** Loyalty tier filter (read-only integration with Rewards module) */
    loyalty_tiers?: string[];
    /** Customer registration date range */
    registered_after?: string;
    registered_before?: string;
    /** Include/exclude specific customer IDs */
    include_customer_ids?: string[];
    exclude_customer_ids?: string[];
}

export interface CreateCampaignDTO {
    name: string;
    description?: string | null;
    type?: CampaignType;
    status?: CampaignStatus;
    starts_at?: Date | string | null;
    ends_at?: Date | string | null;
    budget_total?: number | null;
    budget_currency?: string | null;
    goal_type?: CampaignGoalType | null;
    goal_target?: number | null;
    targeting?: TargetingSpec | null;
    channels?: ChannelConfig[] | null;
    offer_ids?: string[] | null;
    segment_ids?: string[] | null;
    branch_ids?: string[] | null;
    automation_flow_ids?: string[] | null;
    is_featured?: boolean;
    sort_order?: number;
    metadata?: Record<string, unknown> | null;
}

export interface UpdateCampaignDTO extends Partial<CreateCampaignDTO> {
    budget_spent?: number;
    goal_achieved?: number;
}

export interface CampaignDTO {
    id: string;
    name: string;
    description: string | null;
    type: CampaignType;
    status: CampaignStatus;
    starts_at: Date | null;
    ends_at: Date | null;
    budget_total: number | null;
    budget_currency: string | null;
    budget_spent: number;
    goal_type: CampaignGoalType | null;
    goal_target: number | null;
    goal_achieved: number;
    targeting: TargetingSpec | null;
    channels: ChannelConfig[] | null;
    offer_ids: string[] | null;
    segment_ids: string[] | null;
    branch_ids: string[] | null;
    automation_flow_ids: string[] | null;
    is_featured: boolean;
    sort_order: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

// ── Campaign Event ───────────────────────────────────────────────────────────

export type CampaignEventType =
    | "created"
    | "updated"
    | "activated"
    | "paused"
    | "resumed"
    | "completed"
    | "cancelled"
    | "archived"
    | "budget_threshold_reached"
    | "goal_reached"
    | "channel_dispatched"
    | "offer_redeemed";

export type CampaignEventActor =
    | "admin"
    | "system"
    | "scheduler"
    | "customer";

export interface CreateCampaignEventDTO {
    campaign_id: string;
    event_type: CampaignEventType;
    actor?: CampaignEventActor;
    note?: string | null;
    payload?: Record<string, unknown> | null;
}

export interface CampaignEventDTO {
    id: string;
    campaign_id: string;
    event_type: CampaignEventType;
    actor: CampaignEventActor;
    note: string | null;
    payload: Record<string, unknown> | null;
    created_at: Date;
}

// ── Campaign Metric ──────────────────────────────────────────────────────────

export type CampaignMetricKey =
    | "impressions"
    | "clicks"
    | "conversions"
    | "revenue"
    | "orders"
    | "spend"
    | "roi"
    | "ctr"
    | "cpc"
    | "cpa";

export type MetricGranularity = "day" | "week" | "month";

export interface CreateCampaignMetricDTO {
    campaign_id: string;
    metric: CampaignMetricKey | string;
    period: string;
    granularity?: MetricGranularity;
    value: number;
}

export interface CampaignMetricDTO {
    id: string;
    campaign_id: string;
    metric: string;
    period: string;
    granularity: MetricGranularity;
    value: number;
    created_at: Date;
    updated_at: Date;
}

// ── State machine ────────────────────────────────────────────────────────────

/**
 * Valid forward transitions for the campaign state machine.
 * Any transition not listed here is rejected by the service.
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
    draft: ["active", "archived", "cancelled"],
    active: ["paused", "completed", "cancelled", "archived"],
    paused: ["active", "completed", "cancelled", "archived"],
    completed: ["archived"],
    cancelled: ["archived", "draft"],
    archived: ["draft"],
};

/**
 * Terminal states — once reached, the campaign cannot return to a running
 * state except via the explicit archived → draft reset path.
 */
export const TERMINAL_CAMPAIGN_STATES: CampaignStatus[] = [
    "completed",
    "cancelled",
    "archived",
];

/**
 * States in which the campaign is considered "running" (eligible for
 * scheduling, dispatch, and analytics rollup).
 */
export const ACTIVE_CAMPAIGN_STATES: CampaignStatus[] = ["active"];
