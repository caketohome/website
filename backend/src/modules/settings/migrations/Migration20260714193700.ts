import { Migration } from "@mikro-orm/migrations";

export class Migration20260714193700 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "setting" ("id" text not null, "group" text not null, "key" text not null, "value" text null, "is_json" boolean not null default false, "is_secret" boolean not null default false, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "setting_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_setting_group_key" ON "setting" ("group", "key") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "setting" cascade;');
    }
}
