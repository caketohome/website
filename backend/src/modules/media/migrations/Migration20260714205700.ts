import { Migration } from "@mikro-orm/migrations";

export class Migration20260714205700 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "media" ("id" text not null, "name" text not null, "url" text not null, "thumbnail_url" text null, "mime_type" text not null, "size" integer not null default 0, "folder" text not null default \'root\', "alt_text" text null, "width" integer null, "height" integer null, "is_webp_generated" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "media_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_media_folder" ON "media" ("folder") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "media" cascade;');
    }
}
