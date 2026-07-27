import { Migration } from "@mikro-orm/migrations";

export class Migration20260718130000 extends Migration {
  async up(): Promise<void> {
    // ── analytics_expense ────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "analytics_expense" ("id" text not null, "branch_id" text null, "name" text not null, "category" text not null, "amount" integer not null, "recorded_by" text null, "expense_date" timestamptz not null, "description" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_expense_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_expense_branch_id" ON "analytics_expense" ("branch_id") WHERE deleted_at IS NULL;'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_expense_expense_date" ON "analytics_expense" ("expense_date") WHERE deleted_at IS NULL;'
    );

    // ── analytics_franchise ──────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "analytics_franchise" ("id" text not null, "shop_id" text not null, "franchisee_name" text not null, "agreement_details" text null, "commission_rate" double precision not null, "is_active" boolean not null default true, "created_by" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_franchise_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_analytics_franchise_shop_id" ON "analytics_franchise" ("shop_id") WHERE deleted_at IS NULL;'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "analytics_franchise" cascade;');
    this.addSql('drop table if exists "analytics_expense" cascade;');
  }
}
