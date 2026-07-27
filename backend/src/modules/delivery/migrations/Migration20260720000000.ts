import { Migration } from "@mikro-orm/migrations";

export class Migration20260720000000 extends Migration {
  async up(): Promise<void> {
    // ── driver_profile ───────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "driver_profile" ("id" text not null, "partner_id" text not null, "license_number" text not null, "vehicle_type" text not null default \'bike\', "vehicle_number" text not null, "is_verified" boolean not null default false, "rating" text not null default \'5.0\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_profile_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_driver_profile_partner_id" ON "driver_profile" ("partner_id") WHERE deleted_at IS NULL;'
    );

    // ── driver_wallet ────────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "driver_wallet" ("id" text not null, "partner_id" text not null, "balance" text not null default \'0.0\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_wallet_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_driver_wallet_partner_id" ON "driver_wallet" ("partner_id") WHERE deleted_at IS NULL;'
    );

    // ── driver_transaction ───────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "driver_transaction" ("id" text not null, "wallet_id" text not null, "amount" text not null, "type" text not null, "status" text not null default \'pending\', "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_transaction_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_driver_transaction_wallet_id" ON "driver_transaction" ("wallet_id") WHERE deleted_at IS NULL;'
    );

    // ── driver_attendance ────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "driver_attendance" ("id" text not null, "partner_id" text not null, "status" text not null default \'inactive\', "checked_in_at" timestamptz null, "checked_out_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_attendance_pkey" primary key ("id"));'
    );

    // ── driver_location ──────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "driver_location" ("id" text not null, "partner_id" text not null, "latitude" text not null, "longitude" text not null, "logged_at" timestamptz not null default now(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_location_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_driver_location_partner_id" ON "driver_location" ("partner_id") WHERE deleted_at IS NULL;'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "driver_location" cascade;');
    this.addSql('drop table if exists "driver_attendance" cascade;');
    this.addSql('drop table if exists "driver_transaction" cascade;');
    this.addSql('drop table if exists "driver_wallet" cascade;');
    this.addSql('drop table if exists "driver_profile" cascade;');
  }
}
