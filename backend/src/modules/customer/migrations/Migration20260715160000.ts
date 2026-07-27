import { Migration } from "@mikro-orm/migrations";

export class Migration20260715160000 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "customer_phone" ("id" text not null, "phone" text not null, "phone_verified" boolean not null default false, "otp_hash" text null, "otp_expires_at" timestamptz null, "otp_attempts" integer not null default 0, "customer_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "customer_phone_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_phone_phone" ON "customer_phone" ("phone") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cust_address" ("id" text not null, "customer_id" text not null, "label" text null, "first_name" text null, "last_name" text null, "phone" text null, "line1" text not null, "line2" text null, "city" text not null, "state" text null, "pincode" text null, "country" text not null default \'IN\', "latitude" numeric null, "longitude" numeric null, "is_default_shipping" boolean not null default false, "is_default_billing" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cust_address_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cust_address_customer_id" ON "cust_address" ("customer_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "login_event" ("id" text not null, "customer_id" text null, "phone" text null, "ip" text null, "user_agent" text null, "device" text null, "success" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "login_event_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_login_event_customer_id" ON "login_event" ("customer_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "login_event" cascade;');
        this.addSql('drop table if exists "cust_address" cascade;');
        this.addSql('drop table if exists "customer_phone" cascade;');
    }
}
