import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719104558 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "connector_config" drop constraint if exists "connector_config_name_unique";`);
    this.addSql(`create table if not exists "connector_config" ("id" text not null, "name" text not null, "is_enabled" boolean not null default false, "test_mode" boolean not null default true, "sandbox_mode" boolean not null default true, "credentials" jsonb null, "health_status" text not null default 'unknown', "last_health_check" timestamptz null, "config_version" text not null default '1.0.0', "schema_version" text not null default '1.0.0', "migration_version" text not null default '1.0.0', "rollback_version" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "connector_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_connector_config_name_unique" ON "connector_config" ("name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_connector_config_deleted_at" ON "connector_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "connector_config" cascade;`);
  }

}
