import { Migration } from "@mikro-orm/migrations";

export class Migration20260714214600 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "webhook_endpoint" ("id" text not null, "url" text not null, "events" text not null, "secret" text null, "is_active" boolean not null default true, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_endpoint_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_webhook_endpoint_is_active" ON "webhook_endpoint" ("is_active") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "webhook_delivery" ("id" text not null, "webhook_id" text not null, "event" text not null, "payload" text null, "status" text not null default \'pending\', "response_code" integer null, "error" text null, "attempts" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_delivery_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_webhook_delivery_webhook_id" ON "webhook_delivery" ("webhook_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "webhook_delivery" cascade;');
        this.addSql('drop table if exists "webhook_endpoint" cascade;');
    }
}
