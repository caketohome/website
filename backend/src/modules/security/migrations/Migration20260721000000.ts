import { Migration } from "@mikro-orm/migrations";

export class Migration20260721000000 extends Migration {
  async up(): Promise<void> {
    // ── UserTwoFactor ────────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "security_user_two_factor" ("id" text not null, "user_id" text not null, "secret" text not null, "is_enabled" boolean not null default false, "recovery_codes" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "security_user_two_factor_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_security_user_two_factor_user_id" ON "security_user_two_factor" ("user_id") WHERE deleted_at IS NULL;'
    );

    // ── IpWhitelist ──────────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "security_ip_whitelist" ("id" text not null, "ip_address" text not null, "description" text null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "security_ip_whitelist_pkey" primary key ("id"));'
    );

    // ── BlockedIp ────────────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "security_blocked_ip" ("id" text not null, "ip_address" text not null, "reason" text not null, "blocked_until" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "security_blocked_ip_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_security_blocked_ip_ip_address" ON "security_blocked_ip" ("ip_address") WHERE deleted_at IS NULL;'
    );

    // ── SecurityEvent ────────────────────────────────────────────────────────
    this.addSql(
      'create table if not exists "security_event" ("id" text not null, "ip_address" text null, "user_id" text null, "event_type" text not null, "severity" text not null default \'low\', "details" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "security_event_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_security_event_ip_address" ON "security_event" ("ip_address") WHERE deleted_at IS NULL;'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_security_event_user_id" ON "security_event" ("user_id") WHERE deleted_at IS NULL;'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "security_event" cascade;');
    this.addSql('drop table if exists "security_blocked_ip" cascade;');
    this.addSql('drop table if exists "security_ip_whitelist" cascade;');
    this.addSql('drop table if exists "security_user_two_factor" cascade;');
  }
}
