import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260717181016 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "crm_customer_rfm" drop constraint if exists "crm_customer_rfm_customer_id_unique";`);
    this.addSql(`alter table if exists "crm_customer_blacklist" drop constraint if exists "crm_customer_blacklist_customer_id_unique";`);
    this.addSql(`create table if not exists "crm_automation_flow" ("id" text not null, "name" text not null, "trigger_type" text not null, "steps" jsonb null, "is_active" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "crm_automation_flow_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_flow_deleted_at" ON "crm_automation_flow" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "crm_campaign" ("id" text not null, "name" text not null, "reward_type" text not null, "reward_value" integer not null, "status" text not null default 'draft', "filters" jsonb null, "schedule_cron" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "crm_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_campaign_deleted_at" ON "crm_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "crm_customer_blacklist" ("id" text not null, "customer_id" text not null, "is_blacklisted" boolean not null default true, "reason" text null, "blacklisted_at" timestamptz not null, "blacklisted_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "crm_customer_blacklist_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crm_customer_blacklist_customer_id_unique" ON "crm_customer_blacklist" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_blacklist_customer_id" ON "crm_customer_blacklist" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_blacklist_deleted_at" ON "crm_customer_blacklist" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "crm_customer_note" ("id" text not null, "customer_id" text not null, "author_id" text null, "body" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "crm_customer_note_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_note_customer_id" ON "crm_customer_note" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_note_deleted_at" ON "crm_customer_note" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "crm_customer_rfm" ("id" text not null, "customer_id" text not null, "recency_score" integer not null default 0, "frequency_score" integer not null default 0, "monetary_score" integer not null default 0, "clv" integer not null default 0, "rfm_segment" text not null default 'New', "vip_tier" text not null default 'none', "last_calculated_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "crm_customer_rfm_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crm_customer_rfm_customer_id_unique" ON "crm_customer_rfm" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_rfm_customer_id" ON "crm_customer_rfm" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_rfm_deleted_at" ON "crm_customer_rfm" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "crm_automation_flow" cascade;`);

    this.addSql(`drop table if exists "crm_campaign" cascade;`);

    this.addSql(`drop table if exists "crm_customer_blacklist" cascade;`);

    this.addSql(`drop table if exists "crm_customer_note" cascade;`);

    this.addSql(`drop table if exists "crm_customer_rfm" cascade;`);
  }

}
