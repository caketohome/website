import { Migration } from "@mikro-orm/migrations";

/**
 * Phase 9 Milestone 9.1 — Marketing Campaign Engine.
 *
 * Creates three tables:
 *   - marketing_campaign        — the campaign entity (budget, goals, schedule, targeting, channels)
 *   - marketing_campaign_event  — append-only lifecycle + analytics event log
 *   - marketing_campaign_metric — denormalized rollup for the analytics dashboard
 *
 * Backward compatible: all statements use `if not exists` and `down()` drops
 * the tables in reverse dependency order. Table names are prefixed with
 * `marketing_` to remain clearly distinct from the Phase 8 CRM `crm_campaign`
 * entity.
 */
export class Migration20260717180000 extends Migration {
    async up(): Promise<void> {
        // ── marketing_campaign ───────────────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_campaign" ("id" text not null, "name" text not null, "description" text null, "type" text not null default \'promotion\', "status" text not null default \'draft\', "starts_at" timestamptz null, "ends_at" timestamptz null, "budget_total" integer null, "budget_currency" text null, "budget_spent" integer not null default 0, "goal_type" text null, "goal_target" integer null, "goal_achieved" integer not null default 0, "targeting" text null, "channels" text null, "offer_ids" text null, "segment_ids" text null, "branch_ids" text null, "automation_flow_ids" text null, "is_featured" boolean not null default false, "sort_order" integer not null default 0, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_status" ON "marketing_campaign" ("status") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_type" ON "marketing_campaign" ("type") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_starts_at" ON "marketing_campaign" ("starts_at") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_ends_at" ON "marketing_campaign" ("ends_at") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_is_featured" ON "marketing_campaign" ("is_featured") WHERE deleted_at IS NULL;'
        );

        // ── marketing_campaign_event ─────────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_campaign_event" ("id" text not null, "campaign_id" text not null, "event_type" text not null, "actor" text not null default \'system\', "note" text null, "payload" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_event_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_event_campaign_id" ON "marketing_campaign_event" ("campaign_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_event_event_type" ON "marketing_campaign_event" ("event_type") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_event_created_at" ON "marketing_campaign_event" ("created_at") WHERE deleted_at IS NULL;'
        );

        // ── marketing_campaign_metric ─────────────────────────────────────────
        this.addSql(
            'create table if not exists "marketing_campaign_metric" ("id" text not null, "campaign_id" text not null, "metric" text not null, "period" text not null, "granularity" text not null default \'day\', "value" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_metric_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_metric_campaign_id" ON "marketing_campaign_metric" ("campaign_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_metric_metric" ON "marketing_campaign_metric" ("metric") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_metric_period" ON "marketing_campaign_metric" ("period") WHERE deleted_at IS NULL;'
        );
        // Composite uniqueness: one row per (campaign, metric, period, granularity).
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_campaign_metric_rollup" ON "marketing_campaign_metric" ("campaign_id", "metric", "period", "granularity") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "marketing_campaign_metric" cascade;');
        this.addSql('drop table if exists "marketing_campaign_event" cascade;');
        this.addSql('drop table if exists "marketing_campaign" cascade;');
    }
}
