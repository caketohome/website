import { Migration } from "@mikro-orm/migrations";

export class Migration20260714212800 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "language" ("id" text not null, "code" text not null, "name" text not null, "is_default" boolean not null default false, "is_enabled" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "language_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_language_code" ON "language" ("code") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "loc_currency" ("id" text not null, "code" text not null, "symbol" text not null, "name" text not null, "rate" integer not null default 1, "is_default" boolean not null default false, "is_enabled" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loc_currency_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loc_currency_code" ON "loc_currency" ("code") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "translation" ("id" text not null, "language_code" text not null, "key" text not null, "value" text not null, "namespace" text not null default \'common\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "translation_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_translation_language_code" ON "translation" ("language_code") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "translation" cascade;');
        this.addSql('drop table if exists "loc_currency" cascade;');
        this.addSql('drop table if exists "language" cascade;');
    }
}
