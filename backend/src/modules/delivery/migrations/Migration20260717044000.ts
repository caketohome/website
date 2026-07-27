import { Migration } from '@mikro-orm/migrations';

export class Migration20260717044000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "delivery_slot" ("id" text not null, "branch_id" text not null, "slot_name" text not null, "start_time" text not null, "end_time" text not null, "max_capacity" integer not null default 10, "extra_charge" numeric not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_slot_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_delivery_slot_branch_id" ON "delivery_slot" (branch_id) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "delivery_slot" cascade;');
  }

}
