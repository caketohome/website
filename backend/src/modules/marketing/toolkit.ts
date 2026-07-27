import MarketingModuleService from "./service";
import {
    Popup,
    GamificationReward,
    QRCode,
    NewsletterSubscriber,
    RecoveryJob,
} from "./models";
import type {
    PopupDTO,
    PopupDisplayRules,
    PopupDisplayContext,
    CreatePopupDTO,
    UpdatePopupDTO,
    PopupTrigger,
    PopupStatus,
    GamificationRewardDTO,
    CreateGamificationRewardDTO,
    GamificationWidgetType,
    GamificationOutcome,
    GamificationPrizeConfig,
    QRCodeDTO,
    CreateQRCodeDTO,
    QRCodeTargetType,
    QRCodeStatus,
    NewsletterSubscriberDTO,
    CreateNewsletterSubscriberDTO,
    NewsletterSubscriberStatus,
    NewsletterSource,
    RecoveryJobDTO,
    CreateRecoveryJobDTO,
    RecoveryType,
    RecoveryStage,
} from "./types/toolkit";

/**
 * Phase 9 Milestone 9.2 — Marketing Toolkit service extension.
 *
 * Extends the existing MarketingModuleService (Milestone 9.1) with the
 * customer-engagement toolkit: popups, gamification, QR codes, newsletter
 * subscribers, and recovery jobs. The methods are attached to the
 * MarketingModuleService prototype at module-eval time, so any resolved
 * `marketingModuleService` instance gains them without modifying the existing
 * service.ts class body.
 *
 * The MedusaService base class auto-generates CRUD methods for each model
 * (createPopups, listPopups, updatePopups, deletePopups, etc.), so the toolkit
 * methods here are DTO-returning wrappers + business logic (popup display-rule
 * evaluation, gamification prize selection, QR code generation/resolution,
 * newsletter dedup, recovery-job scheduling).
 */

// ── Serialization helpers ────────────────────────────────────────────────────

function parseJSON<T>(raw: unknown, fallback: T): T {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as T;
        } catch {
            return fallback;
        }
    }
    return raw as T;
}

function serializeJSON(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
}

// ── DTO mappers ──────────────────────────────────────────────────────────────

function toPopupDTO(row: any): PopupDTO {
    return {
        id: row.id,
        name: row.name,
        trigger: (row.trigger ?? "exit_intent") as PopupTrigger,
        headline: row.headline ?? null,
        body: row.body ?? null,
        cta_label: row.cta_label ?? null,
        cta_url: row.cta_url ?? null,
        image_url: row.image_url ?? null,
        offer_code: row.offer_code ?? null,
        display_rules: parseJSON<PopupDisplayRules | null>(
            row.display_rules,
            null
        ),
        status: (row.status ?? "draft") as PopupStatus,
        sort_order: row.sort_order ?? 0,
        metadata: parseJSON<Record<string, unknown> | null>(row.metadata, null),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function toGamificationRewardDTO(row: any): GamificationRewardDTO {
    return {
        id: row.id,
        widget_type: row.widget_type as GamificationWidgetType,
        name: row.name,
        offer_id: row.offer_id ?? null,
        customer_id: row.customer_id ?? null,
        session_id: row.session_id ?? null,
        outcome: (row.outcome ?? "lose") as GamificationOutcome,
        reward_label: row.reward_label ?? null,
        coupon_code: row.coupon_code ?? null,
        reward_value: row.reward_value ?? 0,
        redeemed: row.redeemed ?? false,
        metadata: parseJSON<Record<string, unknown> | null>(row.metadata, null),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function toQRCodeDTO(row: any): QRCodeDTO {
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        target_type: (row.target_type ?? "url") as QRCodeTargetType,
        target_id: row.target_id ?? null,
        offer_code: row.offer_code ?? null,
        campaign_id: row.campaign_id ?? null,
        scan_count: row.scan_count ?? 0,
        status: (row.status ?? "active") as QRCodeStatus,
        metadata: parseJSON<Record<string, unknown> | null>(row.metadata, null),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function toNewsletterSubscriberDTO(row: any): NewsletterSubscriberDTO {
    return {
        id: row.id,
        email: row.email,
        phone: row.phone ?? null,
        customer_id: row.customer_id ?? null,
        status: (row.status ?? "subscribed") as NewsletterSubscriberStatus,
        source: (row.source ?? "footer") as NewsletterSource,
        tags: parseJSON<string[] | null>(row.tags, null),
        metadata: parseJSON<Record<string, unknown> | null>(row.metadata, null),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function toRecoveryJobDTO(row: any): RecoveryJobDTO {
    return {
        id: row.id,
        type: row.type as RecoveryType,
        customer_id: row.customer_id ?? null,
        session_id: row.session_id ?? null,
        cart_id: row.cart_id ?? null,
        email: row.email ?? null,
        phone: row.phone ?? null,
        stage: (row.stage ?? "pending") as RecoveryStage,
        scheduled_at: row.scheduled_at ?? null,
        sent_at: row.sent_at ?? null,
        recovered_at: row.recovered_at ?? null,
        offer_code: row.offer_code ?? null,
        attempts: row.attempts ?? 0,
        metadata: parseJSON<Record<string, unknown> | null>(row.metadata, null),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// ── QR code token generator ──────────────────────────────────────────────────

function generateQRToken(length: number = 8): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

// ── Popup methods ────────────────────────────────────────────────────────────

async function createPopup(
    this: any,
    input: CreatePopupDTO
): Promise<PopupDTO> {
    const created = await this.createPopups({
        name: input.name,
        trigger: input.trigger ?? "exit_intent",
        headline: input.headline ?? null,
        body: input.body ?? null,
        cta_label: input.cta_label ?? null,
        cta_url: input.cta_url ?? null,
        image_url: input.image_url ?? null,
        offer_code: input.offer_code ?? null,
        display_rules: serializeJSON(input.display_rules),
        status: input.status ?? "draft",
        sort_order: input.sort_order ?? 0,
        metadata: serializeJSON(input.metadata),
    });
    return toPopupDTO(created);
}

async function updatePopup(
    this: any,
    id: string,
    input: UpdatePopupDTO
): Promise<PopupDTO> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.trigger !== undefined) patch.trigger = input.trigger;
    if (input.headline !== undefined) patch.headline = input.headline;
    if (input.body !== undefined) patch.body = input.body;
    if (input.cta_label !== undefined) patch.cta_label = input.cta_label;
    if (input.cta_url !== undefined) patch.cta_url = input.cta_url;
    if (input.image_url !== undefined) patch.image_url = input.image_url;
    if (input.offer_code !== undefined) patch.offer_code = input.offer_code;
    if (input.display_rules !== undefined)
        patch.display_rules = serializeJSON(input.display_rules);
    if (input.status !== undefined) patch.status = input.status;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
    if (input.metadata !== undefined)
        patch.metadata = serializeJSON(input.metadata);
    const updated = await this.updatePopups({ id }, patch);
    return toPopupDTO(updated);
}

async function retrievePopupDTO(this: any, id: string): Promise<PopupDTO> {
    const rows = await this.listPopups({ id });
    if (!rows || rows.length === 0) {
        throw new Error(`Popup not found: ${id}`);
    }
    return toPopupDTO(rows[0]);
}

async function listPopupsDTO(
    this: any,
    filters: Record<string, unknown> = {}
): Promise<PopupDTO[]> {
    const rows = await this.listPopups(filters, { take: 200 });
    return rows.map((r: any) => toPopupDTO(r));
}

async function deletePopup(this: any, id: string): Promise<void> {
    await this.deletePopups([id]);
}

/**
 * Evaluate popup display rules against a storefront context. Returns true if
 * the popup should be shown to this visitor right now. Pure function over the
 * popup + context (no DB calls beyond fetching the popup).
 */
function evaluatePopupDisplay(
    popup: PopupDTO,
    ctx: PopupDisplayContext,
    now: Date = new Date()
): boolean {
    if (popup.status !== "active") return false;
    const rules = popup.display_rules ?? {};

    // Device filter
    if (rules.device && rules.device !== "both" && ctx.device) {
        if (rules.device !== ctx.device) return false;
    }

    // Logged-in filters
    if (rules.require_logged_in && !ctx.is_logged_in) return false;
    if (rules.suppress_logged_in && ctx.is_logged_in) return false;

    // URL pattern matching (simple glob-style: * matches any)
    if (rules.url_patterns && rules.url_patterns.length > 0 && ctx.url) {
        const matched = rules.url_patterns.some((p) =>
            matchGlob(p, ctx.url!)
        );
        if (!matched) return false;
    }
    if (
        rules.exclude_url_patterns &&
        rules.exclude_url_patterns.length > 0 &&
        ctx.url
    ) {
        const excluded = rules.exclude_url_patterns.some((p) =>
            matchGlob(p, ctx.url!)
        );
        if (excluded) return false;
    }

    // Page type filter
    if (rules.page_types && rules.page_types.length > 0 && ctx.page_type) {
        if (!rules.page_types.includes(ctx.page_type)) return false;
    }

    // Customer segment filter
    if (
        rules.customer_segments &&
        rules.customer_segments.length > 0 &&
        ctx.customer_segments
    ) {
        const has = rules.customer_segments.some((s) =>
            ctx.customer_segments!.includes(s)
        );
        if (!has) return false;
    }

    // Branch filter
    if (rules.branch_ids && rules.branch_ids.length > 0 && ctx.branch_id) {
        if (!rules.branch_ids.includes(ctx.branch_id)) return false;
    }

    // Suppress hours (cooldown after last shown)
    if (rules.suppress_hours && ctx.shown_history?.[popup.id]) {
        const lastShown = ctx.shown_history[popup.id];
        const elapsedHours = (now.getTime() - lastShown) / (1000 * 60 * 60);
        if (elapsedHours < rules.suppress_hours) return false;
    }

    // Max per customer
    if (rules.max_per_customer && ctx.shown_counts?.[popup.id]) {
        if (ctx.shown_counts[popup.id] >= rules.max_per_customer) return false;
    }

    return true;
}

function matchGlob(pattern: string, value: string): boolean {
    // Convert glob to regex: * → .*, ? → .
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");
    const re = new RegExp(`^${escaped}$`, "i");
    return re.test(value);
}

/**
 * List active popups that should be shown for the given storefront context.
 * Used by the storefront popup component.
 */
async function listEligiblePopups(
    this: any,
    ctx: PopupDisplayContext
): Promise<PopupDTO[]> {
    const all = await this.listPopupsDTO({ status: "active" });
    return all.filter((p: PopupDTO) => evaluatePopupDisplay(p, ctx));
}

// ── Gamification methods ─────────────────────────────────────────────────────

async function createGamificationReward(
    this: any,
    input: CreateGamificationRewardDTO
): Promise<GamificationRewardDTO> {
    const created = await this.createGamificationRewards({
        widget_type: input.widget_type,
        name: input.name,
        offer_id: input.offer_id ?? null,
        customer_id: input.customer_id ?? null,
        session_id: input.session_id ?? null,
        outcome: input.outcome ?? "lose",
        reward_label: input.reward_label ?? null,
        coupon_code: input.coupon_code ?? null,
        reward_value: input.reward_value ?? 0,
        redeemed: input.redeemed ?? false,
        metadata: serializeJSON(input.metadata),
    });
    return toGamificationRewardDTO(created);
}

async function listGamificationRewardsDTO(
    this: any,
    filters: Record<string, unknown> = {}
): Promise<GamificationRewardDTO[]> {
    const rows = await this.listGamificationRewards(filters, { take: 200 });
    return rows.map((r: any) => toGamificationRewardDTO(r));
}

async function markGamificationRewardRedeemed(
    this: any,
    id: string
): Promise<GamificationRewardDTO> {
    const updated = await this.updateGamificationRewards(
        { id },
        { redeemed: true }
    );
    return toGamificationRewardDTO(updated);
}

/**
 * Play a gamification widget: pick a prize using weighted random selection,
 * record the outcome, and return the reward DTO. The actual reward issuance
 * (coupon code, wallet credit, etc.) is handled by the caller via the M2
 * Rules Engine — this method only selects + records.
 *
 * Fraud control: enforces a configurable per-customer/per-session daily play
 * limit (read from the prize config metadata).
 */
async function playGamification(
    this: any,
    input: {
        widget_type: GamificationWidgetType;
        name: string;
        prizes: GamificationPrizeConfig[];
        customer_id?: string | null;
        session_id?: string | null;
        daily_limit?: number;
    }
): Promise<GamificationRewardDTO> {
    if (!input.prizes || input.prizes.length === 0) {
        throw new Error("playGamification requires at least one prize");
    }

    // Daily limit fraud control
    if (input.daily_limit && input.daily_limit > 0) {
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        const filter: Record<string, unknown> = {
            widget_type: input.widget_type,
            created_at: { $gte: since },
        };
        if (input.customer_id) filter.customer_id = input.customer_id;
        else if (input.session_id) filter.session_id = input.session_id;
        const recent = await this.listGamificationRewards(filter, {
            take: 1000,
        });
        if (recent.length >= input.daily_limit) {
            throw new Error(
                `Daily play limit (${input.daily_limit}) reached for ${input.widget_type}`
            );
        }
    }

    // Weighted random selection
    const totalWeight = input.prizes.reduce(
        (sum, p) => sum + Math.max(0, p.weight),
        0
    );
    let picked = input.prizes[0];
    if (totalWeight > 0) {
        const r = Math.random() * totalWeight;
        let acc = 0;
        for (const prize of input.prizes) {
            acc += Math.max(0, prize.weight);
            if (r <= acc) {
                picked = prize;
                break;
            }
        }
    }

    return this.createGamificationReward({
        widget_type: input.widget_type,
        name: input.name,
        offer_id: picked.offer_id ?? null,
        customer_id: input.customer_id ?? null,
        session_id: input.session_id ?? null,
        outcome: picked.outcome ?? "win",
        reward_label: picked.label,
        coupon_code: picked.coupon_code ?? null,
        reward_value: picked.reward_value ?? 0,
        redeemed: false,
        metadata: { prize: picked },
    });
}

// ── QR code methods ──────────────────────────────────────────────────────────

async function createQRCode(
    this: any,
    input: CreateQRCodeDTO
): Promise<QRCodeDTO> {
    let code = input.code;
    if (!code) {
        // Generate a unique token, retrying on collision.
        for (let attempt = 0; attempt < 10; attempt++) {
            const candidate = generateQRToken(8);
            const existing = await this.listQRCodes({ code: candidate });
            if (!existing || existing.length === 0) {
                code = candidate;
                break;
            }
        }
        if (!code) throw new Error("Failed to generate unique QR code token");
    }

    const created = await this.createQRCodes({
        name: input.name,
        code,
        target_type: input.target_type ?? "url",
        target_id: input.target_id ?? null,
        offer_code: input.offer_code ?? null,
        campaign_id: input.campaign_id ?? null,
        scan_count: 0,
        status: input.status ?? "active",
        metadata: serializeJSON(input.metadata),
    });
    return toQRCodeDTO(created);
}

async function listQRCodesDTO(
    this: any,
    filters: Record<string, unknown> = {}
): Promise<QRCodeDTO[]> {
    const rows = await this.listQRCodes(filters, { take: 200 });
    return rows.map((r: any) => toQRCodeDTO(r));
}

async function retrieveQRCodeDTO(this: any, id: string): Promise<QRCodeDTO> {
    const rows = await this.listQRCodes({ id });
    if (!rows || rows.length === 0) {
        throw new Error(`QR code not found: ${id}`);
    }
    return toQRCodeDTO(rows[0]);
}

/**
 * Resolve a QR code by its short token. Increments the scan count and returns
 * the target URL + optional offer code. Used by the storefront QR redirect
 * endpoint.
 */
async function resolveQRCode(
    this: any,
    code: string
): Promise<QRCodeDTO & { target_url: string | null }> {
    const rows = await this.listQRCodes({ code });
    if (!rows || rows.length === 0) {
        throw new Error(`QR code not found: ${code}`);
    }
    const row = rows[0];
    // Increment scan count
    await this.updateQRCodes(
        { id: row.id },
        { scan_count: (row.scan_count ?? 0) + 1 }
    );
    const dto = toQRCodeDTO(row);

    // Resolve target URL based on target_type
    let target_url: string | null = null;
    switch (dto.target_type) {
        case "url":
            target_url = dto.target_id ?? null;
            break;
        case "campaign":
            target_url = dto.target_id ? `/campaigns/${dto.target_id}` : null;
            break;
        case "offer":
            target_url = dto.target_id ? `/offers/${dto.target_id}` : null;
            break;
        case "landing_page":
            target_url = dto.target_id ? `/${dto.target_id}` : null;
            break;
    }
    return { ...dto, target_url };
}

async function deleteQRCode(this: any, id: string): Promise<void> {
    await this.deleteQRCodes([id]);
}

// ── Newsletter methods ───────────────────────────────────────────────────────

async function subscribeNewsletter(
    this: any,
    input: CreateNewsletterSubscriberDTO
): Promise<NewsletterSubscriberDTO> {
    // Dedup by email: if already subscribed, no-op; if unsubscribed/bounced,
    // re-subscribe.
    const existing = await this.listNewsletterSubscribers({
        email: input.email,
    });
    if (existing && existing.length > 0) {
        const row = existing[0];
        if (row.status === "subscribed") {
            return toNewsletterSubscriberDTO(row);
        }
        const updated = await this.updateNewsletterSubscribers(
            { id: row.id },
            {
                status: "subscribed",
                source: input.source ?? row.source,
                phone: input.phone ?? row.phone,
                customer_id: input.customer_id ?? row.customer_id,
                tags: serializeJSON(input.tags) ?? row.tags,
                metadata: serializeJSON(input.metadata) ?? row.metadata,
            }
        );
        return toNewsletterSubscriberDTO(updated);
    }
    const created = await this.createNewsletterSubscribers({
        email: input.email,
        phone: input.phone ?? null,
        customer_id: input.customer_id ?? null,
        status: input.status ?? "subscribed",
        source: input.source ?? "footer",
        tags: serializeJSON(input.tags),
        metadata: serializeJSON(input.metadata),
    });
    return toNewsletterSubscriberDTO(created);
}

async function unsubscribeNewsletter(
    this: any,
    email: string
): Promise<NewsletterSubscriberDTO | null> {
    const existing = await this.listNewsletterSubscribers({ email });
    if (!existing || existing.length === 0) return null;
    const row = existing[0];
    const updated = await this.updateNewsletterSubscribers(
        { id: row.id },
        { status: "unsubscribed" }
    );
    return toNewsletterSubscriberDTO(updated);
}

async function listNewsletterSubscribersDTO(
    this: any,
    filters: Record<string, unknown> = {}
): Promise<NewsletterSubscriberDTO[]> {
    const rows = await this.listNewsletterSubscribers(filters, { take: 500 });
    return rows.map((r: any) => toNewsletterSubscriberDTO(r));
}

// ── Recovery job methods ─────────────────────────────────────────────────────

async function createRecoveryJob(
    this: any,
    input: CreateRecoveryJobDTO
): Promise<RecoveryJobDTO> {
    const created = await this.createRecoveryJobs({
        type: input.type,
        customer_id: input.customer_id ?? null,
        session_id: input.session_id ?? null,
        cart_id: input.cart_id ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        stage: input.stage ?? "pending",
        scheduled_at: input.scheduled_at
            ? new Date(input.scheduled_at)
            : null,
        offer_code: input.offer_code ?? null,
        attempts: input.attempts ?? 0,
        metadata: serializeJSON(input.metadata),
    });
    return toRecoveryJobDTO(created);
}

async function listRecoveryJobsDTO(
    this: any,
    filters: Record<string, unknown> = {}
): Promise<RecoveryJobDTO[]> {
    const rows = await this.listRecoveryJobs(filters, { take: 500 });
    return rows.map((r: any) => toRecoveryJobDTO(r));
}

/**
 * List recovery jobs that are due to be dispatched (stage=pending and
 * scheduled_at ≤ now). Used by the scheduled dispatcher (Milestone 9.4) and
 * by the admin recovery dashboard.
 */
async function listDueRecoveryJobs(
    this: any,
    now: Date = new Date()
): Promise<RecoveryJobDTO[]> {
    const rows = await this.listRecoveryJobs(
        { stage: "pending" },
        { take: 500 }
    );
    return rows
        .map((r: any) => toRecoveryJobDTO(r))
        .filter((j: RecoveryJobDTO) => {
            if (!j.scheduled_at) return true; // no schedule = due immediately
            return j.scheduled_at.getTime() <= now.getTime();
        });
}

async function markRecoveryJobSent(
    this: any,
    id: string
): Promise<RecoveryJobDTO> {
    const updated = await this.updateRecoveryJobs(
        { id },
        {
            stage: "sent",
            sent_at: new Date(),
            attempts: 1, // attempts is a count; the dispatcher increments
        }
    );
    return toRecoveryJobDTO(updated);
}

async function markRecoveryJobRecovered(
    this: any,
    id: string
): Promise<RecoveryJobDTO> {
    const updated = await this.updateRecoveryJobs(
        { id },
        { stage: "recovered", recovered_at: new Date() }
    );
    return toRecoveryJobDTO(updated);
}

async function cancelRecoveryJob(
    this: any,
    id: string
): Promise<RecoveryJobDTO> {
    const updated = await this.updateRecoveryJobs(
        { id },
        { stage: "cancelled" }
    );
    return toRecoveryJobDTO(updated);
}

/**
 * Schedule an abandoned-cart recovery job with a configurable delay (in
 * minutes). Idempotent: if a pending job already exists for the same
 * cart_id, it returns the existing job instead of creating a duplicate.
 */
async function scheduleAbandonedCartRecovery(
    this: any,
    input: {
        cart_id: string;
        customer_id?: string | null;
        session_id?: string | null;
        email?: string | null;
        phone?: string | null;
        delay_minutes?: number;
        offer_code?: string | null;
        metadata?: Record<string, unknown> | null;
    }
): Promise<RecoveryJobDTO> {
    // Idempotency: check for existing pending job for this cart
    const existing = await this.listRecoveryJobs({
        cart_id: input.cart_id,
        stage: "pending",
    });
    if (existing && existing.length > 0) {
        return toRecoveryJobDTO(existing[0]);
    }
    const delay = input.delay_minutes ?? 60; // default 1 hour
    const scheduledAt = new Date(Date.now() + delay * 60 * 1000);
    return this.createRecoveryJob({
        type: "abandoned_cart",
        customer_id: input.customer_id ?? null,
        session_id: input.session_id ?? null,
        cart_id: input.cart_id,
        email: input.email ?? null,
        phone: input.phone ?? null,
        stage: "pending",
        scheduled_at: scheduledAt,
        offer_code: input.offer_code ?? null,
        metadata: input.metadata ?? null,
    });
}

// ── Attach to prototype ──────────────────────────────────────────────────────

(MarketingModuleService.prototype as any).createPopup = createPopup;
(MarketingModuleService.prototype as any).updatePopup = updatePopup;
(MarketingModuleService.prototype as any).retrievePopupDTO = retrievePopupDTO;
(MarketingModuleService.prototype as any).listPopupsDTO = listPopupsDTO;
(MarketingModuleService.prototype as any).deletePopup = deletePopup;
(MarketingModuleService.prototype as any).evaluatePopupDisplay =
    evaluatePopupDisplay;
(MarketingModuleService.prototype as any).listEligiblePopups =
    listEligiblePopups;

(MarketingModuleService.prototype as any).createGamificationReward =
    createGamificationReward;
(MarketingModuleService.prototype as any).listGamificationRewardsDTO =
    listGamificationRewardsDTO;
(MarketingModuleService.prototype as any).markGamificationRewardRedeemed =
    markGamificationRewardRedeemed;
(MarketingModuleService.prototype as any).playGamification = playGamification;

(MarketingModuleService.prototype as any).createQRCode = createQRCode;
(MarketingModuleService.prototype as any).listQRCodesDTO = listQRCodesDTO;
(MarketingModuleService.prototype as any).retrieveQRCodeDTO = retrieveQRCodeDTO;
(MarketingModuleService.prototype as any).resolveQRCode = resolveQRCode;
(MarketingModuleService.prototype as any).deleteQRCode = deleteQRCode;

(MarketingModuleService.prototype as any).subscribeNewsletter =
    subscribeNewsletter;
(MarketingModuleService.prototype as any).unsubscribeNewsletter =
    unsubscribeNewsletter;
(MarketingModuleService.prototype as any).listNewsletterSubscribersDTO =
    listNewsletterSubscribersDTO;

(MarketingModuleService.prototype as any).createRecoveryJob = createRecoveryJob;
(MarketingModuleService.prototype as any).listRecoveryJobsDTO =
    listRecoveryJobsDTO;
(MarketingModuleService.prototype as any).listDueRecoveryJobs =
    listDueRecoveryJobs;
(MarketingModuleService.prototype as any).markRecoveryJobSent =
    markRecoveryJobSent;
(MarketingModuleService.prototype as any).markRecoveryJobRecovered =
    markRecoveryJobRecovered;
(MarketingModuleService.prototype as any).cancelRecoveryJob = cancelRecoveryJob;
(MarketingModuleService.prototype as any).scheduleAbandonedCartRecovery =
    scheduleAbandonedCartRecovery;

export {
    evaluatePopupDisplay,
    matchGlob,
    generateQRToken,
    toPopupDTO,
    toGamificationRewardDTO,
    toQRCodeDTO,
    toNewsletterSubscriberDTO,
    toRecoveryJobDTO,
};
