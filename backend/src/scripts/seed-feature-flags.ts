import { Logger } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ExecArgs } from "@medusajs/types";
import dotenv from "dotenv";
import { SETTINGS_MODULE } from "../modules/settings";

dotenv.config();

/**
 * Seeds the Phase 2 feature flags into the Settings module (group: feature_flags).
 * Idempotent — upserts each flag. Run with: `npx medusa exec ./src/scripts/seed-feature-flags.ts`
 *
 * Flags seeded:
 *   cms, homepage_builder, seo, blog, dynamic_navigation (Phase 2)
 *   customer_accounts (Phase 1)
 */
export default async function seedFeatureFlags({ container }: ExecArgs) {
    const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const settingsModule = container.resolve(SETTINGS_MODULE) as {
        upsertValue: (
            group: string,
            key: string,
            value: unknown,
            options?: { is_json?: boolean; description?: string }
        ) => Promise<void>;
    };

    const flags: Array<{ key: string; enabled: boolean; description: string }> = [
        { key: "customer_accounts", enabled: true, description: "Phase 1 — Mobile+OTP customer accounts" },
        { key: "cms", enabled: true, description: "Phase 2 — Enterprise CMS (pages, blog, landing)" },
        { key: "homepage_builder", enabled: true, description: "Phase 2 — Drag-and-drop homepage builder" },
        { key: "seo", enabled: true, description: "Phase 2 — SEO engine (sitemap, robots, JSON-LD, redirects)" },
        { key: "blog", enabled: true, description: "Phase 2 — Blog platform" },
        { key: "dynamic_navigation", enabled: true, description: "Phase 2 — Admin-managed navigation builder" },
        { key: "product_meta", enabled: true, description: "Phase 3 — Cake-specific product metadata (dietary, compliance, merchandising)" },
        { key: "reviews", enabled: true, description: "Phase 3 — Product reviews & ratings with moderation" },
        { key: "wishlist", enabled: true, description: "Phase 3 — Wishlist / saved favorites" },
        { key: "subscriptions", enabled: true, description: "Phase 3 — Recurring product subscriptions" },
        { key: "product_videos", enabled: true, description: "Phase 3 — Product videos via Media Module" },
        { key: "order_cancellation", enabled: true, description: "Phase 5 — Customer + shop order cancellation with reason" },
        { key: "refunds", enabled: true, description: "Phase 5 — Refund management (payment provider + refund-to-wallet)" },
        { key: "rescheduling", enabled: true, description: "Phase 5 — Delivery slot/date reschedule requests with approval flow" },
        { key: "invoices", enabled: true, description: "Phase 5 — Digital invoice / PDF invoice generation" },
        { key: "proof_of_delivery", enabled: true, description: "Phase 5 — Photo + signature proof of delivery capture" },
        { key: "order_timeline", enabled: true, description: "Phase 5 — Unified order timeline (status history + events + notes)" },
        { key: "staff_assignment", enabled: true, description: "Phase 5 — Staff assignment & accountability per order" },
        { key: "multi_branch", enabled: true, description: "Phase 6 — Multi-branch operations (CRUD, switcher, nearest allocation)" },
        { key: "branch_inventory", enabled: true, description: "Phase 6 — Branch-wise stock and inventory transfers" },
        { key: "branch_pricing", enabled: true, description: "Phase 6 — Branch-specific pricing overrides" },
        { key: "rewards_wallet", enabled: true, description: "Phase 7 — Customer wallet balance, credits, debits, adjustments" },
        { key: "rewards_gift_cards", enabled: true, description: "Phase 7 — Customer gift card usage and partial redemptions" },
        { key: "rewards_loyalty", enabled: true, description: "Phase 7 — Customer loyalty points earning, redemption, rules" },
        { key: "rewards_referrals", enabled: true, description: "Phase 7 — Customer referral program invite codes, qualification and rewards" },
        { key: "marketing_campaigns", enabled: true, description: "Phase 9 — Marketing campaign engine (scheduling, budget, goals, targeting, analytics hooks)" },
        { key: "marketing_public_campaigns", enabled: true, description: "Phase 9 — Public storefront campaign listing (featured/active campaigns)" },
        { key: "marketing", enabled: true, description: "Phase 9.2 — Marketing toolkit (popups, newsletter, QR codes, recovery jobs, storefront badges/banners)" },
        { key: "gamification", enabled: true, description: "Phase 9.2 — Gamification widgets (spin wheel, scratch cards, lucky draw) + reward issuance" },
        { key: "affiliate", enabled: false, description: "Phase 9.2 — Affiliate / influencer referral tracking (placeholder; full engine in a later milestone)" },
    ];

    logger.info("Seeding feature flags...");

    for (const flag of flags) {
        await settingsModule.upsertValue("feature_flags", flag.key, flag.enabled, {
            description: flag.description,
        });
        logger.info(`  ✓ ${flag.key} = ${flag.enabled}`);
    }

    logger.info("Feature flags seeded successfully.");
}
