import { Migration } from '@mikro-orm/migrations';

export class Migration20240925143313 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "shop" ("id" text not null, "handle" text not null, "is_open" boolean not null default false, "name" text not null, "description" text null, "phone" text not null, "email" text not null, "address" text not null, "image_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_pkey" primary key ("id"));');

    this.addSql('create table if not exists "shop_manager" ("id" text not null, "first_name" text not null, "last_name" text not null, "email" text not null, "avatar_url" text null, "shop_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_manager_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_shop_manager_shop_id" ON "shop_manager" (shop_id) WHERE deleted_at IS NULL;');

    this.addSql('alter table if exists "shop_manager" add constraint "shop_manager_shop_id_foreign" foreign key ("shop_id") references "shop" ("id") on update cascade;');
  }

  async down(): Promise<void> {
    this.addSql('alter table if exists "shop_manager" drop constraint if exists "shop_manager_shop_id_foreign";');

    this.addSql('drop table if exists "shop" cascade;');

    this.addSql('drop table if exists "shop_manager" cascade;');
  }

}
