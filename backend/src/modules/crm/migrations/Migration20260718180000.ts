import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260718180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "crm_email_template" (
        "id" text not null,
        "name" text not null,
        "subject" text not null,
        "body" text not null,
        "language_code" text not null default 'en',
        "category" text not null default 'transactional',
        "is_active" boolean not null default true,
        "version" integer not null default 1,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "crm_email_template_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crm_email_template_name_unique" ON "crm_email_template" ("name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_email_template_deleted_at" ON "crm_email_template" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "crm_automation_execution" (
        "id" text not null,
        "flow_id" text not null,
        "customer_id" text not null,
        "current_step_id" text null,
        "status" text not null default 'running',
        "next_execution_at" timestamptz null,
        "metadata" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "crm_automation_execution_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_execution_flow_id" ON "crm_automation_execution" ("flow_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_execution_customer_id" ON "crm_automation_execution" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_execution_next_execution_at" ON "crm_automation_execution" ("next_execution_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_execution_deleted_at" ON "crm_automation_execution" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`
      create table if not exists "crm_automation_log" (
        "id" text not null,
        "execution_id" text not null,
        "step_id" text not null,
        "step_type" text not null,
        "status" text not null,
        "note" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "crm_automation_log_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_log_execution_id" ON "crm_automation_log" ("execution_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_crm_automation_log_deleted_at" ON "crm_automation_log" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "crm_automation_log" cascade;`);
    this.addSql(`drop table if exists "crm_automation_execution" cascade;`);
    this.addSql(`drop table if exists "crm_email_template" cascade;`);
  }
}
