import { Migration } from '@mikro-orm/migrations';

export class Migration20260717043000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "delivery_zone" ("id" text not null, "pincode" text not null, "branch_id" text not null, "delivery_fee" numeric not null default 0, "is_serviceable" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_zone_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_pincode" ON "delivery_zone" (pincode) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "delivery_zone" cascade;');
  }

}
