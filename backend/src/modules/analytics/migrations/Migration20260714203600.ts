import { Migration } from "@mikro-orm/migrations";

export class Migration20260714203600 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "analytics_event" ("id" text not null, "event_type" text not null, "entity_id" text null, "customer_id" text null, "session_id" text null, "branch_id" text null, "payload" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_event_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_analytics_event_event_type" ON "analytics_event" ("event_type") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_analytics_event_session_id" ON "analytics_event" ("session_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_analytics_event_branch_id" ON "analytics_event" ("branch_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "analytics_event" cascade;');
    }
}
