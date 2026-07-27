import { model } from "@medusajs/utils";

/**
 * Phase 9 Milestone 9.2 — Marketing Toolkit models.
 *
 * These models extend the existing Marketing module (Milestone 9.1) with the
 * customer-engagement toolkit: exit-intent popups, gamification rewards,
 * QR-code promotions, newsletter subscribers, and recovery jobs (abandoned
 * cart / wishlist / recently-viewed).
 *
 * They do NOT duplicate the Rules/Offer engine — gamification rewards and QR
 * promotions reference M2 Offer IDs by reference, and the actual discount /
 * free-item issuance flows through `rulesModuleService.evaluate()` +
 * `recordRedemption()`.
 */

// ── Exit-Intent / Marketing Popup ────────────────────────────────────────────
export const Popup = model.define("marketing_popup", {
    id: model
        .id({
            prefix: "mkt_pop",
        })
        .primaryKey(),
    /** Admin-facing name */
    name: model.text(),
    /** Popup variant: exit_intent | entry | scroll | time_delay | manual */
    trigger: model.text().default("exit_intent"),
    /** Headline text shown in the popup */
    headline: model.text().nullable(),
    /** Body copy / subtext */
    body: model.text().nullable(),
    /** CTA button label */
    cta_label: model.text().nullable(),
    /** CTA target URL (e.g. /campaigns/flash-sale) */
    cta_url: model.text().nullable(),
    /** Optional image URL from the Media module */
    image_url: model.text().nullable(),
    /** Optional offer/coupon code to reveal on CTA */
    offer_code: model.text().nullable(),
    /** JSON-serialized display rules (see PopupDisplayRules type) */
    display_rules: model.text().nullable(),
    /** Lifecycle status */
    status: model.text().default("draft"),
    /** Sort order for admin listing */
    sort_order: model.number().default(0),
    /** JSON-serialized freeform metadata */
    metadata: model.text().nullable(),
});

// ── Gamification Reward ──────────────────────────────────────────────────────
// Tracks issuance of rewards from gamification widgets (spin wheel, scratch
// cards, lucky draw). The actual reward (discount, free item, wallet cashback,
// loyalty points) is configured by referencing an M2 Offer ID — the engine
// evaluates + records the redemption. This table is the audit + fraud-control
// ledger for gamification plays.
export const GamificationReward = model.define("marketing_gamification_reward", {
    id: model
        .id({
            prefix: "mkt_gam",
        })
        .primaryKey(),
    /** Widget type: spin_wheel | scratch_card | lucky_draw */
    widget_type: model.text(),
    /** Admin-facing campaign/widget name */
    name: model.text(),
    /** Optional M2 Offer ID that backs this reward (by reference) */
    offer_id: model.text().nullable(),
    /** Customer who played (nullable for anonymous plays) */
    customer_id: model.text().nullable(),
    /** Anonymous session identifier (for guest fraud control) */
    session_id: model.text().nullable(),
    /** Reward outcome: win | lose | retry */
    outcome: model.text().default("lose"),
    /** Reward label shown to customer (e.g. "10% off coupon") */
    reward_label: model.text().nullable(),
    /** Coupon code issued (if any) */
    coupon_code: model.text().nullable(),
    /** Reward value in minor units (e.g. discount amount) */
    reward_value: model.number().default(0),
    /** Whether the reward has been redeemed by the customer */
    redeemed: model.boolean().default(false),
    /** JSON-serialized freeform metadata (prize config, spin result, etc.) */
    metadata: model.text().nullable(),
});

// ── QR Code Promotion ────────────────────────────────────────────────────────
// A scannable QR code that resolves to a campaign / offer / landing page.
// The `code` is the short token embedded in the QR image; scanning it hits
// the store resolve endpoint which redirects to `target_url` and optionally
// reveals an offer code.
export const QRCode = model.define("marketing_qr_code", {
    id: model
        .id({
            prefix: "mkt_qr",
        })
        .primaryKey(),
    /** Admin-facing name */
    name: model.text(),
    /** Short unique token embedded in the QR image */
    code: model.text(),
    /** Where the QR resolves: campaign | offer | landing_page | url */
    target_type: model.text().default("url"),
    /** Target identifier (campaign id, offer id, cms page slug, or raw URL) */
    target_id: model.text().nullable(),
    /** Optional offer/coupon code to reveal on scan */
    offer_code: model.text().nullable(),
    /** Optional campaign ID link (by reference) */
    campaign_id: model.text().nullable(),
    /** Scan count (denormalized) */
    scan_count: model.number().default(0),
    /** Lifecycle status */
    status: model.text().default("active"),
    /** JSON-serialized freeform metadata */
    metadata: model.text().nullable(),
});

// ── Newsletter Subscriber ────────────────────────────────────────────────────
// Extends the existing /api/subscribe flow (which is an SSE delivery stream,
// NOT newsletter). This is the newsletter subscription store. The existing
// frontend subscribe route is preserved; this table is populated by the new
// /store/marketing/newsletter endpoint.
export const NewsletterSubscriber = model.define("marketing_newsletter_subscriber", {
    id: model
        .id({
            prefix: "mkt_nl",
        })
        .primaryKey(),
    /** Subscriber email (unique) */
    email: model.text(),
    /** Optional phone (for SMS newsletter) */
    phone: model.text().nullable(),
    /** Optional customer ID if subscribed while logged in */
    customer_id: model.text().nullable(),
    /** Subscription status: subscribed | unsubscribed | bounced */
    status: model.text().default("subscribed"),
    /** Source of subscription: footer | popup | checkout | manual | import */
    source: model.text().default("footer"),
    /** Optional segments/tags (JSON-serialized string[]) */
    tags: model.text().nullable(),
    /** JSON-serialized freeform metadata */
    metadata: model.text().nullable(),
});

// ── Recovery Job ─────────────────────────────────────────────────────────────
// Abandoned cart / wishlist / recently-viewed recovery. A scheduled job scans
// for eligible customers and creates a RecoveryJob row; the dispatcher (wired
// in Milestone 9.4) sends the recovery email/SMS via M6 Notification. This
// table is the scheduling + audit ledger.
export const RecoveryJob = model.define("marketing_recovery_job", {
    id: model
        .id({
            prefix: "mkt_rec",
        })
        .primaryKey(),
    /** Recovery type: abandoned_cart | wishlist | recently_viewed */
    type: model.text(),
    /** Customer ID (nullable for guest carts) */
    customer_id: model.text().nullable(),
    /** Anonymous session identifier (for guest carts) */
    session_id: model.text().nullable(),
    /** Cart ID (for abandoned cart recovery) */
    cart_id: model.text().nullable(),
    /** Customer email (for dispatch + dedup) */
    email: model.text().nullable(),
    /** Customer phone (for SMS dispatch) */
    phone: model.text().nullable(),
    /** Stage: pending | sent | recovered | expired | cancelled */
    stage: model.text().default("pending"),
    /** Scheduled dispatch time */
    scheduled_at: model.dateTime().nullable(),
    /** Actual dispatch time */
    sent_at: model.dateTime().nullable(),
    /** Recovery time (when the customer completed the action) */
    recovered_at: model.dateTime().nullable(),
    /** Optional offer/coupon code included in the recovery message */
    offer_code: model.text().nullable(),
    /** Number of reminder attempts */
    attempts: model.number().default(0),
    /** JSON-serialized freeform metadata (cart snapshot, items, etc.) */
    metadata: model.text().nullable(),
});
