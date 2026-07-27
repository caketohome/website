import { Migration } from "@mikro-orm/migrations";

export class Migration20260718200000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table if not exists "report_schedule" ("id" text not null, "recipient_email" text not null, "report_type" text not null, "frequency" text not null, "branch_id" text null, "last_sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "report_schedule_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_report_schedule_recipient_email" ON "report_schedule" ("recipient_email") WHERE deleted_at IS NULL;'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "report_schedule" cascade;');
  }
}
