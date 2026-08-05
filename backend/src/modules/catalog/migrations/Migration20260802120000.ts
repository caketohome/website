import { Migration } from '@mikro-orm/migrations';

export class Migration20260802120000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "master_weight" ("id" text not null, "name" text not null, "display_name" text null, "weight_val" real not null, "unit" text not null default \'kg\', "display_order" integer not null default 0, "status" text check ("status" in (\'active\', \'archived\')) not null default \'active\', constraint "master_weight_pkey" primary key ("id"));');
    
    this.addSql('create table if not exists "product_weight_price" ("id" text not null, "product_id" text not null, "weight_id" text not null, "weight_name" text not null, "selling_price" real not null, "mrp" real null, "cost_price" real null, "prep_time_minutes" integer not null default 60, "is_enabled" boolean not null default true, constraint "product_weight_price_pkey" primary key ("id"));');

    this.addSql('create index if not exists "product_weight_price_product_id_index" on "product_weight_price" ("product_id");');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "product_weight_price" cascade;');
    this.addSql('drop table if exists "master_weight" cascade;');
  }

}
