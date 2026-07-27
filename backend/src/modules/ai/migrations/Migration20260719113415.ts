import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719113415 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "ai_knowledge_base" ("id" text not null, "document_id" text not null, "document_version" text not null default '1.0.0', "source_module" text not null, "published_at" timestamptz not null default now(), "expires_at" timestamptz null, "language" text not null default 'en', "company_id" text null, "branch_id" text null, "content_chunk" text not null, "embedding" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_knowledge_base_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ai_knowledge_base_deleted_at" ON "ai_knowledge_base" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_knowledge_base" cascade;`);
  }

}
