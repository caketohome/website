import { Migration } from "@mikro-orm/migrations";

/**
 * Phase 9 Milestone 9.2 — Marketing Toolkit.
 *
 * Creates five tables extending the existing Marketing module (Milestone 9.1):
 *   - marketing_popup                 — exit-intent / marketing popups
 *   - marketing_gamification_reward   — spin wheel / scratch card / lucky draw ledger
 *   - marketing_qr_code               — QR code promotions
 *   - marketing_newsletter_subscriber — newsletter subscriptions
 *   - marketing_recovery_job          — abandoned cart / wishlist / recently-viewed recovery
 *
 * Backward compatible: all statements use `if not exists` and `down()` drops
 * the tables in reverse dependency order. No existing tables are modified.
 */
export class Migration20260718060000 extends Migration {
    async up(): Promise<void> {
        // ── marketing_popup ───────────────────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_popup" ("id" text not null, "name" text not null, "trigger" text not null default \'exit_intent\', "headline" text null, "body" text null, "cta_label" text null, "cta_url" text null, "image_url" text null, "offer_code" text null, "display_rules" text null, "status" text not null default \'draft\', "sort_order" integer not null default 0, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_popup_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_popup_status" ON "marketing_popup" ("status") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_popup_trigger" ON "marketing_popup" ("trigger") WHERE deleted_at IS NULL;'
        );

        // ── marketing_gamification_reward ──────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_gamification_reward" ("id" text not null, "widget_type" text not null, "name" text not null, "offer_id" text null, "customer_id" text null, "session_id" text null, "outcome" text not null default \'lose\', "reward_label" text null, "coupon_code" text null, "reward_value" integer not null default 0, "redeemed" boolean not null default false, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_gamification_reward_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_gamification_widget_type" ON "marketing_gamification_reward" ("widget_type") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_gamification_customer_id" ON "marketing_gamification_reward" ("customer_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_gamification_session_id" ON "marketing_gamification_reward" ("session_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_gamification_offer_id" ON "marketing_gamification_reward" ("offer_id") WHERE deleted_at IS NULL;'
        );

        // ── marketing_qr_code ─────────────────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_qr_code" ("id" text not null, "name" text not null, "code" text not null, "target_type" text not null default \'url\', "target_id" text null, "offer_code" text null, "campaign_id" text null, "scan_count" integer not null default 0, "status" text not null default \'active\', "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_qr_code_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_qr_code_code" ON "marketing_qr_code" ("code") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_qr_code_status" ON "marketing_qr_code" ("status") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_qr_code_campaign_id" ON "marketing_qr_code" ("campaign_id") WHERE deleted_at IS NULL;'
        );

        // ── marketing_newsletter_subscriber ───────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_newsletter_subscriber" ("id" text not null, "email" text not null, "phone" text null, "customer_id" text null, "status" text not null default \'subscribed\', "source" text not null default \'footer\', "tags" text null, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_newsletter_subscriber_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_newsletter_subscriber_email" ON "marketing_newsletter_subscriber" ("email") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_newsletter_subscriber_status" ON "marketing_newsletter_subscriber" ("status") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_newsletter_subscriber_customer_id" ON "marketing_newsletter_subscriber" ("customer_id") WHERE deleted_at IS NULL;'
        );

        // ── marketing_recovery_job ─────────────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_recovery_job" ("id" text not null, "type" text not null, "customer_id" text null, "session_id" text null, "cart_id" text null, "email" text null, "phone" text null, "stage" text not null default \'pending\', "scheduled_at" timestamptz null, "sent_at" timestamptz null, "recovered_at" timestamptz null, "offer_code" text null, "attempts" integer not null default 0, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_recovery_job_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_recovery_job_type" ON "marketing_recovery_job" ("type") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_recovery_job_stage" ON "marketing_recovery_job" ("stage") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_recovery_job_scheduled_at" ON "marketing_recovery_job" ("scheduled_at") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_recovery_job_customer_id" ON "marketing_recovery_job" ("customer_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_recovery_job_cart_id" ON "marketing_recovery_job" ("cart_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "marketing_recovery_job" cascade;');
        this.addSql('drop table if exists "marketing_newsletter_subscriber" cascade;');
        this.addSql('drop table if exists "marketing_qr_code" cascade;');
        this.addSql('drop table if exists "marketing_gamification_reward" cascade;');
        this.addSql('drop table if exists "marketing_popup" cascade;');
    }
}
