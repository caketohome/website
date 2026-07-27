import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260718170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "crm_segment" (
        "id" text not null,
        "name" text not null,
        "description" text null,
        "rules" text not null,
        "is_active" boolean not null default true,
        "metadata" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "crm_segment_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crm_segment_name_unique" ON "crm_segment" ("name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_segment_deleted_at" ON "crm_segment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "crm_customer_segment" (
        "id" text not null,
        "segment_id" text not null,
        "customer_id" text not null,
        "joined_at" timestamptz not null default now(),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "crm_customer_segment_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_segment_segment_id" ON "crm_customer_segment" ("segment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_segment_customer_id" ON "crm_customer_segment" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_customer_segment_deleted_at" ON "crm_customer_segment" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "crm_customer_segment" cascade;`);
    this.addSql(`drop table if exists "crm_segment" cascade;`);
  }
}
