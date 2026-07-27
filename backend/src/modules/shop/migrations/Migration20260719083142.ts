import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719083142 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "branch_capacity" ("id" text not null, "max_cakes_per_hour" integer not null default 10, "max_cakes_per_day" integer not null default 50, "max_custom_cakes" integer not null default 5, "max_designer_cakes" integer not null default 5, "prep_buffer_hours" integer not null default 4, "rush_cutoff_time" text null, "blackout_dates" jsonb null, "version" integer not null default 1, "branch_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "branch_capacity_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_branch_capacity_branch_id_unique" ON "branch_capacity" ("branch_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_branch_capacity_deleted_at" ON "branch_capacity" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "slot_reservation" ("id" text not null, "cart_id" text not null, "slot_time" timestamptz not null, "status" text not null default 'reserved', "expires_at" timestamptz not null, "branch_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "slot_reservation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_slot_reservation_branch_id" ON "slot_reservation" ("branch_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_slot_reservation_deleted_at" ON "slot_reservation" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "branch_capacity" add constraint "branch_capacity_branch_id_foreign" foreign key ("branch_id") references "branch" ("id") on update cascade;`);
    this.addSql(`alter table if exists "slot_reservation" add constraint "slot_reservation_branch_id_foreign" foreign key ("branch_id") references "branch" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "branch_capacity" drop constraint if exists "branch_capacity_branch_id_foreign";`);
    this.addSql(`alter table if exists "slot_reservation" drop constraint if exists "slot_reservation_branch_id_foreign";`);
    this.addSql(`drop table if exists "branch_capacity" cascade;`);
    this.addSql(`drop table if exists "slot_reservation" cascade;`);
  }

}
