import { Migration } from "@mikro-orm/migrations";

export class Migration20260714213700 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "audit_log" ("id" text not null, "actor_id" text null, "actor_type" text null, "action" text not null, "entity" text null, "entity_id" text null, "ip_address" text null, "user_agent" text null, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "audit_log_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_audit_log_actor_id" ON "audit_log" ("actor_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_audit_log_entity" ON "audit_log" ("entity", "entity_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_audit_log_action" ON "audit_log" ("action") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "audit_log" cascade;');
    }
}
