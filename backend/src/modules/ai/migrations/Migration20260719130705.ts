import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719130705 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ai_memory_state" ("id" text not null, "memory_type" text not null, "entity_id" text null, "content" text not null, "company_id" text null, "branch_id" text null, "metadata" jsonb null, "last_accessed_at" timestamptz not null default now(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_memory_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_memory_state_deleted_at" ON "ai_memory_state" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ai_prompt_registry" ("id" text not null, "prompt_key" text not null, "version" text not null default '1.0.0', "template" text not null, "ab_test_split" integer not null default 1, "ab_test_group" text not null default 'A', "is_active" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_prompt_registry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_prompt_registry_deleted_at" ON "ai_prompt_registry" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_memory_state" cascade;`);

    this.addSql(`drop table if exists "ai_prompt_registry" cascade;`);
  }

}
