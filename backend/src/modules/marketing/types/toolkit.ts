/**
 * Phase 9 Milestone 9.2 — Marketing Toolkit shared types.
 *
 * DTOs for popups, gamification rewards, QR codes, newsletter subscribers,
 * and recovery jobs. Framework-agnostic so they can be imported by the
 * service, API routes, admin hooks, and storefront SDK.
 */

// ── Popup ────────────────────────────────────────────────────────────────────

export type PopupTrigger =
    | "exit_intent"
    | "entry"
    | "scroll"
    | "time_delay"
    | "manual";

export type PopupStatus = "draft" | "active" | "paused" | "archived";

export interface PopupDisplayRules {
    /** Show on every page, or restrict to specific URL patterns */
    url_patterns?: string[];
    /** Exclude URL patterns */
    exclude_url_patterns?: string[];
    /** Show only on these page types: home | product | category | cart | checkout | blog | cms */
    page_types?: string[];
    /** Seconds to wait before showing (time_delay trigger) */
    delay_seconds?: number;
    /** Scroll percentage to trigger at (scroll trigger) */
    scroll_percentage?: number;
    /** Suppress for this many hours after the popup is shown */
    suppress_hours?: number;
    /** Suppress for logged-in customers */
    suppress_logged_in?: boolean;
    /** Show only to logged-in customers */
    require_logged_in?: boolean;
    /** Show only on mobile/desktop */
    device?: "mobile" | "desktop" | "both";
    /** Show only for customers in these segments */
    customer_segments?: string[];
    /** Show only for these branch IDs */
    branch_ids?: string[];
    /** Max times to show per customer */
    max_per_customer?: number;
}

export interface CreatePopupDTO {
    name: string;
    trigger?: PopupTrigger;
    headline?: string | null;
    body?: string | null;
    cta_label?: string | null;
    cta_url?: string | null;
    image_url?: string | null;
    offer_code?: string | null;
    display_rules?: PopupDisplayRules | null;
    status?: PopupStatus;
    sort_order?: number;
    metadata?: Record<string, unknown> | null;
}

export interface UpdatePopupDTO extends Partial<CreatePopupDTO> { }

export interface PopupDTO {
    id: string;
    name: string;
    trigger: PopupTrigger;
    headline: string | null;
    body: string | null;
    cta_label: string | null;
    cta_url: string | null;
    image_url: string | null;
    offer_code: string | null;
    display_rules: PopupDisplayRules | null;
    status: PopupStatus;
    sort_order: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

// ── Gamification ─────────────────────────────────────────────────────────────

export type GamificationWidgetType = "spin_wheel" | "scratch_card" | "lucky_draw";
export type GamificationOutcome = "win" | "lose" | "retry";

export interface GamificationPrizeConfig {
    /** Reward label shown on the wheel/card slot */
    label: string;
    /** Probability weight (relative to other prizes) */
    weight: number;
    /** Optional M2 Offer ID backing this prize */
    offer_id?: string;
    /** Optional coupon code to issue */
    coupon_code?: string;
    /** Reward value in minor units */
    reward_value?: number;
    /** "win" | "lose" | "retry" */
    outcome?: GamificationOutcome;
}

export interface CreateGamificationRewardDTO {
    widget_type: GamificationWidgetType;
    name: string;
    offer_id?: string | null;
    customer_id?: string | null;
    session_id?: string | null;
    outcome?: GamificationOutcome;
    reward_label?: string | null;
    coupon_code?: string | null;
    reward_value?: number;
    redeemed?: boolean;
    metadata?: Record<string, unknown> | null;
}

export interface GamificationRewardDTO {
    id: string;
    widget_type: GamificationWidgetType;
    name: string;
    offer_id: string | null;
    customer_id: string | null;
    session_id: string | null;
    outcome: GamificationOutcome;
    reward_label: string | null;
    coupon_code: string | null;
    reward_value: number;
    redeemed: boolean;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

// ── QR Code ──────────────────────────────────────────────────────────────────

export type QRCodeTargetType = "campaign" | "offer" | "landing_page" | "url";
export type QRCodeStatus = "active" | "disabled" | "expired";

export interface CreateQRCodeDTO {
    name: string;
    code?: string; // auto-generated if omitted
    target_type?: QRCodeTargetType;
    target_id?: string | null;
    offer_code?: string | null;
    campaign_id?: string | null;
    status?: QRCodeStatus;
    metadata?: Record<string, unknown> | null;
}

export interface QRCodeDTO {
    id: string;
    name: string;
    code: string;
    target_type: QRCodeTargetType;
    target_id: string | null;
    offer_code: string | null;
    campaign_id: string | null;
    scan_count: number;
    status: QRCodeStatus;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

// ── Newsletter ───────────────────────────────────────────────────────────────

export type NewsletterSubscriberStatus =
    | "subscribed"
    | "unsubscribed"
    | "bounced";
export type NewsletterSource =
    | "footer"
    | "popup"
    | "checkout"
    | "manual"
    | "import";

export interface CreateNewsletterSubscriberDTO {
    email: string;
    phone?: string | null;
    customer_id?: string | null;
    status?: NewsletterSubscriberStatus;
    source?: NewsletterSource;
    tags?: string[] | null;
    metadata?: Record<string, unknown> | null;
}

export interface NewsletterSubscriberDTO {
    id: string;
    email: string;
    phone: string | null;
    customer_id: string | null;
    status: NewsletterSubscriberStatus;
    source: NewsletterSource;
    tags: string[] | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

// ── Recovery Job ─────────────────────────────────────────────────────────────

export type RecoveryType = "abandoned_cart" | "wishlist" | "recently_viewed";
export type RecoveryStage =
    | "pending"
    | "sent"
    | "recovered"
    | "expired"
    | "cancelled";

export interface CreateRecoveryJobDTO {
    type: RecoveryType;
    customer_id?: string | null;
    session_id?: string | null;
    cart_id?: string | null;
    email?: string | null;
    phone?: string | null;
    stage?: RecoveryStage;
    scheduled_at?: Date | string | null;
    offer_code?: string | null;
    attempts?: number;
    metadata?: Record<string, unknown> | null;
}

export interface RecoveryJobDTO {
    id: string;
    type: RecoveryType;
    customer_id: string | null;
    session_id: string | null;
    cart_id: string | null;
    email: string | null;
    phone: string | null;
    stage: RecoveryStage;
    scheduled_at: Date | null;
    sent_at: Date | null;
    recovered_at: Date | null;
    offer_code: string | null;
    attempts: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}

// ── Popup display evaluation context ─────────────────────────────────────────

export interface PopupDisplayContext {
    url?: string;
    page_type?: string;
    is_logged_in?: boolean;
    customer_id?: string;
    customer_segments?: string[];
    branch_id?: string;
    device?: "mobile" | "desktop";
    /** Map of popupId → last shown timestamp (ms) for suppress_hours */
    shown_history?: Record<string, number>;
    /** Map of popupId → times shown to this customer */
    shown_counts?: Record<string, number>;
}
