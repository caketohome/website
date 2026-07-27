import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719123908 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "ai_circuit_breaker_state" drop constraint if exists "ai_circuit_breaker_state_provider_name_unique";`);
    this.addSql(`create table if not exists "ai_circuit_breaker_state" ("id" text not null, "provider_name" text not null, "state" text not null default 'closed', "failure_count" integer not null default 0, "last_failed_at" timestamptz null, "cooldown_until" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_circuit_breaker_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_circuit_breaker_state_provider_name_unique" ON "ai_circuit_breaker_state" ("provider_name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_circuit_breaker_state_deleted_at" ON "ai_circuit_breaker_state" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "ai_knowledge_base" add column if not exists "confidence" integer not null default 1, add column if not exists "retrieval_score" integer null, add column if not exists "last_updated" timestamptz not null;`);
    this.addSql(`alter table if exists "ai_knowledge_base" alter column "published_at" drop default;`);
    this.addSql(`alter table if exists "ai_knowledge_base" alter column "published_at" type timestamptz using ("published_at"::timestamptz);`);

    this.addSql(`alter table if exists "ai_request_log" add column if not exists "workflow_id" text null, add column if not exists "actor_id" text null, add column if not exists "module" text null, add column if not exists "retry_count" integer not null default 0, add column if not exists "fallback_provider" text null, add column if not exists "embedding_model" text null, add column if not exists "context_builder_version" text not null default '1.0.0', add column if not exists "retrieved_documents" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_circuit_breaker_state" cascade;`);

    this.addSql(`alter table if exists "ai_knowledge_base" drop column if exists "confidence", drop column if exists "retrieval_score", drop column if exists "last_updated";`);

    this.addSql(`alter table if exists "ai_knowledge_base" alter column "published_at" type timestamptz using ("published_at"::timestamptz);`);
    this.addSql(`alter table if exists "ai_knowledge_base" alter column "published_at" set default Sun Jul 19 2026 17:04:09 GMT+0530 (India Standard Time);`);

    this.addSql(`alter table if exists "ai_request_log" drop column if exists "workflow_id", drop column if exists "actor_id", drop column if exists "module", drop column if exists "retry_count", drop column if exists "fallback_provider", drop column if exists "embedding_model", drop column if exists "context_builder_version", drop column if exists "retrieved_documents";`);
  }

}
