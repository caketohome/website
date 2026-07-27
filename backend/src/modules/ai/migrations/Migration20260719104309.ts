import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719104309 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "ai_provider_config" drop constraint if exists "ai_provider_config_provider_name_unique";`);
    this.addSql(`alter table if exists "ai_model_config" drop constraint if exists "ai_model_config_model_name_unique";`);
    this.addSql(`create table if not exists "ai_model_config" ("id" text not null, "model_name" text not null, "provider_name" text not null, "capability" text not null, "context_limit" integer not null default 4096, "input_token_cost" integer not null default 0, "output_token_cost" integer not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_model_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_model_config_model_name_unique" ON "ai_model_config" ("model_name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_model_config_deleted_at" ON "ai_model_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ai_provider_config" ("id" text not null, "provider_name" text not null, "is_enabled" boolean not null default false, "api_key" text null, "base_url" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_provider_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_provider_config_provider_name_unique" ON "ai_provider_config" ("provider_name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_provider_config_deleted_at" ON "ai_provider_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "ai_request_log" ("id" text not null, "provider" text not null, "model" text not null, "prompt_version" text null, "prompt_tokens" integer not null default 0, "completion_tokens" integer not null default 0, "cost" integer not null default 0, "latency_ms" integer not null default 0, "correlation_id" text null, "status" text not null default 'success', "failure_reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_request_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_request_log_deleted_at" ON "ai_request_log" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_model_config" cascade;`);

    this.addSql(`drop table if exists "ai_provider_config" cascade;`);

    this.addSql(`drop table if exists "ai_request_log" cascade;`);
  }

}
