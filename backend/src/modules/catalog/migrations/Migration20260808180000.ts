import { Migration } from "@mikro-orm/migrations";

export class Migration20260808180000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "flavor_master" ("id" text not null, "name" text not null, "display_name" text null, "internal_code" text null, "description" text null, "image_url" text null, "icon" text null, "color" text null, "extra_price" real not null default 0, "prep_time_minutes" integer not null default 0, "sort_order" integer not null default 0, "status" text check ("status" in (\'active\', \'archived\')) not null default \'active\', "is_enabled" boolean not null default true, "available_online" boolean not null default true, "available_in_store" boolean not null default true, "available_for_pickup" boolean not null default true, "available_for_delivery" boolean not null default true, constraint "flavor_master_pkey" primary key ("id"));');

    this.addSql('create table if not exists "shape_master" ("id" text not null, "name" text not null, "image_url" text null, "preview_url" text null, "description" text null, "additional_price" real not null default 0, "max_weight" real not null default 10, "prep_time_minutes" integer not null default 0, "sort_order" integer not null default 0, "status" text check ("status" in (\'active\', \'archived\')) not null default \'active\', "is_enabled" boolean not null default true, constraint "shape_master_pkey" primary key ("id"));');

    this.addSql('create table if not exists "product_flavor_mapping" ("id" text not null, "product_id" text not null, "flavor_id" text not null, "price_override" real null, "is_enabled" boolean not null default true, constraint "product_flavor_mapping_pkey" primary key ("id"));');
    this.addSql('create index if not exists "product_flavor_mapping_product_id_index" on "product_flavor_mapping" ("product_id");');

    this.addSql('create table if not exists "product_shape_mapping" ("id" text not null, "product_id" text not null, "shape_id" text not null, "price_override" real null, "is_enabled" boolean not null default true, constraint "product_shape_mapping_pkey" primary key ("id"));');
    this.addSql('create index if not exists "product_shape_mapping_product_id_index" on "product_shape_mapping" ("product_id");');

    this.addSql('alter table if exists "product_meta" add column if not exists "enable_flavor_selection" boolean not null default true;');
    this.addSql('alter table if exists "product_meta" add column if not exists "enable_shape_selection" boolean not null default true;');

    this.addSql('drop table if exists "master_weight" cascade;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "product_shape_mapping" cascade;');
    this.addSql('drop table if exists "product_flavor_mapping" cascade;');
    this.addSql('drop table if exists "shape_master" cascade;');
    this.addSql('drop table if exists "flavor_master" cascade;');
  }

}
