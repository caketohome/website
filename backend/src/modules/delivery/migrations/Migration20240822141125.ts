import { Migration } from '@mikro-orm/migrations';

export class Migration20240822141125 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "delivery" ("id" text not null, "transaction_id" text null, "delivery_partner_id" text null, "delivery_status" text check ("delivery_status" in (\'pending\', \'shop_declined\', \'shop_accepted\', \'pickup_claimed\', \'shop_preparing\', \'ready_for_pickup\', \'in_transit\', \'delivered\')) not null default \'pending\', "eta" timestamptz null, "delivered_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_pkey" primary key ("id"));');

    this.addSql('create table if not exists "delivery_partner" ("id" text not null, "first_name" text not null, "last_name" text not null, "email" text not null, "phone" text not null, "avatar_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_partner_pkey" primary key ("id"));');

    this.addSql('create table if not exists "delivery_delivery_partner" ("id" text not null, "delivery_id" text not null, "delivery_partner_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_delivery_partner_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_delivery_delivery_partner_delivery_id" ON "delivery_delivery_partner" (delivery_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_delivery_delivery_partner_delivery_partner_id" ON "delivery_delivery_partner" (delivery_partner_id) WHERE deleted_at IS NULL;');

    this.addSql('alter table if exists "delivery_delivery_partner" add constraint "delivery_delivery_partner_delivery_id_foreign" foreign key ("delivery_id") references "delivery" ("id") on update cascade;');
    this.addSql('alter table if exists "delivery_delivery_partner" add constraint "delivery_delivery_partner_delivery_partner_id_foreign" foreign key ("delivery_partner_id") references "delivery_partner" ("id") on update cascade;');
  }

  async down(): Promise<void> {
    this.addSql('alter table if exists "delivery_delivery_partner" drop constraint if exists "delivery_delivery_partner_delivery_id_foreign";');

    this.addSql('alter table if exists "delivery_delivery_partner" drop constraint if exists "delivery_delivery_partner_delivery_partner_id_foreign";');

    this.addSql('drop table if exists "delivery" cascade;');

    this.addSql('drop table if exists "delivery_partner" cascade;');

    this.addSql('drop table if exists "delivery_delivery_partner" cascade;');
  }

}
