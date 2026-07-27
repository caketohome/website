import { Migration } from '@mikro-orm/migrations';

export class Migration20260717060000 extends Migration {

  async up(): Promise<void> {
    // 1. Create city table
    this.addSql('create table if not exists "city" ("id" text not null, "name" text not null, "state" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "city_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_city_name" ON "city" (name) WHERE deleted_at IS NULL;');

    // 2. Create branch_region table
    this.addSql('create table if not exists "branch_region" ("id" text not null, "name" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_region_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_region_name" ON "branch_region" (name) WHERE deleted_at IS NULL;');

    // 3. Create branch table
    this.addSql('create table if not exists "branch" ("id" text not null, "name" text not null, "code" text not null, "is_open" boolean not null default false, "phone" text not null, "email" text not null, "address" text not null, "latitude" double precision not null, "longitude" double precision not null, "shop_id" text not null, "city_id" text null, "region_id" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_branch_code" ON "branch" (code) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_shop_id" ON "branch" (shop_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_city_id" ON "branch" (city_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_region_id" ON "branch" (region_id) WHERE deleted_at IS NULL;');

    // 4. Create branch_staff table
    this.addSql('create table if not exists "branch_staff" ("id" text not null, "first_name" text not null, "last_name" text not null, "email" text not null, "phone" text not null, "role" text not null, "is_active" boolean not null default true, "branch_id" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_staff_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_branch_staff_email" ON "branch_staff" (email) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_staff_branch_id" ON "branch_staff" (branch_id) WHERE deleted_at IS NULL;');

    // 5. Create branch_settings table
    this.addSql('create table if not exists "branch_settings" ("id" text not null, "delivery_radius_km" double precision not null default 10, "min_order_amount" double precision not null default 0, "free_delivery_threshold" double precision null, "auto_allocation_enabled" boolean not null default true, "allow_pickup" boolean not null default true, "allow_delivery" boolean not null default true, "branch_id" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_settings_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_branch_settings_branch_id" ON "branch_settings" (branch_id) WHERE deleted_at IS NULL;');

    // 6. Create branch_inventory table
    this.addSql('create table if not exists "branch_inventory" ("id" text not null, "product_id" text not null, "variant_id" text not null, "quantity" integer not null default 0, "reserved" integer not null default 0, "branch_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_inventory_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_inventory_branch_id" ON "branch_inventory" (branch_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_inventory_variant_id" ON "branch_inventory" (variant_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_branch_inventory_branch_variant" ON "branch_inventory" (branch_id, variant_id) WHERE deleted_at IS NULL;');

    // 7. Create inventory_transfer table
    this.addSql('create table if not exists "inventory_transfer" ("id" text not null, "from_branch_id" text null, "to_branch_id" text not null, "product_id" text not null, "variant_id" text not null, "quantity" integer not null, "status" text not null default \'pending\', "created_by" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inventory_transfer_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_inventory_transfer_from_branch" ON "inventory_transfer" (from_branch_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_inventory_transfer_to_branch" ON "inventory_transfer" (to_branch_id) WHERE deleted_at IS NULL;');

    // 8. Create branch_price table
    this.addSql('create table if not exists "branch_price" ("id" text not null, "variant_id" text not null, "price" double precision not null, "compare_at_price" double precision null, "branch_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_price_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_price_branch_id" ON "branch_price" (branch_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_branch_price_variant_id" ON "branch_price" (variant_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_branch_price_branch_variant" ON "branch_price" (branch_id, variant_id) WHERE deleted_at IS NULL;');

    // 9. Foreign Key Constraints
    this.addSql('alter table if exists "branch" add constraint "branch_shop_id_foreign" foreign key ("shop_id") references "shop" ("id") on update cascade on delete cascade;');
    this.addSql('alter table if exists "branch" add constraint "branch_city_id_foreign" foreign key ("city_id") references "city" ("id") on update cascade on delete set null;');
    this.addSql('alter table if exists "branch" add constraint "branch_region_id_foreign" foreign key ("region_id") references "branch_region" ("id") on update cascade on delete set null;');
    
    this.addSql('alter table if exists "branch_staff" add constraint "branch_staff_branch_id_foreign" foreign key ("branch_id") references "branch" ("id") on update cascade on delete cascade;');
    
    this.addSql('alter table if exists "branch_settings" add constraint "branch_settings_branch_id_foreign" foreign key ("branch_id") references "branch" ("id") on update cascade on delete cascade;');
    
    this.addSql('alter table if exists "branch_inventory" add constraint "branch_inventory_branch_id_foreign" foreign key ("branch_id") references "branch" ("id") on update cascade on delete cascade;');
    
    this.addSql('alter table if exists "inventory_transfer" add constraint "inventory_transfer_from_branch_id_foreign" foreign key ("from_branch_id") references "branch" ("id") on update cascade on delete set null;');
    this.addSql('alter table if exists "inventory_transfer" add constraint "inventory_transfer_to_branch_id_foreign" foreign key ("to_branch_id") references "branch" ("id") on update cascade on delete cascade;');
    
    this.addSql('alter table if exists "branch_price" add constraint "branch_price_branch_id_foreign" foreign key ("branch_id") references "branch" ("id") on update cascade on delete cascade;');
  }

  async down(): Promise<void> {
    this.addSql('alter table if exists "branch" drop constraint if exists "branch_shop_id_foreign";');
    this.addSql('alter table if exists "branch" drop constraint if exists "branch_city_id_foreign";');
    this.addSql('alter table if exists "branch" drop constraint if exists "branch_region_id_foreign";');
    this.addSql('alter table if exists "branch_staff" drop constraint if exists "branch_staff_branch_id_foreign";');
    this.addSql('alter table if exists "branch_settings" drop constraint if exists "branch_settings_branch_id_foreign";');
    this.addSql('alter table if exists "branch_inventory" drop constraint if exists "branch_inventory_branch_id_foreign";');
    this.addSql('alter table if exists "inventory_transfer" drop constraint if exists "inventory_transfer_from_branch_id_foreign";');
    this.addSql('alter table if exists "inventory_transfer" drop constraint if exists "inventory_transfer_to_branch_id_foreign";');
    this.addSql('alter table if exists "branch_price" drop constraint if exists "branch_price_branch_id_foreign";');

    this.addSql('drop table if exists "city" cascade;');
    this.addSql('drop table if exists "branch_region" cascade;');
    this.addSql('drop table if exists "branch" cascade;');
    this.addSql('drop table if exists "branch_staff" cascade;');
    this.addSql('drop table if exists "branch_settings" cascade;');
    this.addSql('drop table if exists "branch_inventory" cascade;');
    this.addSql('drop table if exists "inventory_transfer" cascade;');
    this.addSql('drop table if exists "branch_price" cascade;');
  }

}
