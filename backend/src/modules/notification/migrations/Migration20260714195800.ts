import { Migration } from "@mikro-orm/migrations";

export class Migration20260714195800 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "notification_template" ("id" text not null, "name" text not null, "channel" text not null, "event" text not null, "subject" text null, "body" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "notification_template_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_notification_template_event_channel" ON "notification_template" ("event", "channel") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "notification_log" ("id" text not null, "channel" text not null, "recipient" text not null, "template_id" text null, "event" text null, "status" text not null default \'pending\', "provider" text null, "error" text null, "payload" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "notification_log_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_notification_log_recipient" ON "notification_log" ("recipient") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "notification_log" cascade;');
        this.addSql('drop table if exists "notification_template" cascade;');
    }
}
