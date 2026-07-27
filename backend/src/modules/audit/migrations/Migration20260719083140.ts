import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719083140 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "config_audit_log" ("id" text not null, "config_key" text not null, "old_value" text null, "new_value" text null, "changed_by" text null, "change_reason" text null, "ip_address" text null, "user_agent" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "config_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_config_audit_log_deleted_at" ON "config_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "config_audit_log" cascade;`);
  }

}
