import { Migration } from "@mikro-orm/migrations";

export class Migration20260715210000 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "cms_page" ("id" text not null, "slug" text not null, "title" text not null, "type" text not null default \'page\', "status" text not null default \'draft\', "blocks" text null, "meta_title" text null, "meta_description" text null, "canonical_url" text null, "og_image" text null, "author" text null, "excerpt" text null, "featured_image" text null, "reading_time" integer not null default 0, "published_at" timestamptz null, "archived_at" timestamptz null, "language_code" text not null default \'en\', "template_id" text null, "category_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_page_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_page_slug_lang" ON "cms_page" ("slug", "language_code") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_page_type_status" ON "cms_page" ("type", "status") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_category" ("id" text not null, "name" text not null, "slug" text not null, "description" text null, "parent_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_category_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_category_slug" ON "cms_category" ("slug") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_tag" ("id" text not null, "name" text not null, "slug" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_tag_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_tag_slug" ON "cms_tag" ("slug") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_block" ("id" text not null, "name" text not null, "identifier" text not null, "type" text not null default \'rich_text\', "content" text null, "language_code" text not null default \'en\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_block_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_block_identifier" ON "cms_block" ("identifier", "language_code") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_homepage_section" ("id" text not null, "name" text not null, "section_type" text not null, "title" text null, "subtitle" text null, "config" text null, "sort_order" integer not null default 0, "is_active" boolean not null default true, "starts_at" timestamptz null, "ends_at" timestamptz null, "visibility" text null, "theme" text null, "language_code" text not null default \'en\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_homepage_section_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_homepage_section_active" ON "cms_homepage_section" ("is_active", "language_code") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_banner" ("id" text not null, "title" text null, "image_url" text not null, "mobile_image_url" text null, "link_url" text null, "alt_text" text null, "sort_order" integer not null default 0, "is_active" boolean not null default true, "starts_at" timestamptz null, "ends_at" timestamptz null, "target" text null, "language_code" text not null default \'en\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_banner_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_banner_active" ON "cms_banner" ("is_active", "language_code") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_navigation" ("id" text not null, "name" text not null, "location" text not null, "items" text null, "is_active" boolean not null default true, "language_code" text not null default \'en\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_navigation_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_navigation_location" ON "cms_navigation" ("location", "is_active", "language_code") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_redirect" ("id" text not null, "from_path" text not null, "to_url" text not null, "redirect_type" integer not null default 301, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_redirect_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_redirect_from" ON "cms_redirect" ("from_path") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_template" ("id" text not null, "name" text not null, "type" text not null default \'page\', "structure" text null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_template_pkey" primary key ("id"));'
        );

        this.addSql(
            'create table if not exists "cms_revision" ("id" text not null, "page_id" text not null, "version" integer not null default 1, "snapshot" text null, "author" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_revision_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_revision_page" ON "cms_revision" ("page_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "cms_asset_reference" ("id" text not null, "entity_type" text not null, "entity_id" text not null, "media_id" text not null, "field" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cms_asset_reference_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cms_asset_ref_entity" ON "cms_asset_reference" ("entity_type", "entity_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "cms_asset_reference" cascade;');
        this.addSql('drop table if exists "cms_revision" cascade;');
        this.addSql('drop table if exists "cms_template" cascade;');
        this.addSql('drop table if exists "cms_redirect" cascade;');
        this.addSql('drop table if exists "cms_navigation" cascade;');
        this.addSql('drop table if exists "cms_banner" cascade;');
        this.addSql('drop table if exists "cms_homepage_section" cascade;');
        this.addSql('drop table if exists "cms_block" cascade;');
        this.addSql('drop table if exists "cms_tag" cascade;');
        this.addSql('drop table if exists "cms_category" cascade;');
        this.addSql('drop table if exists "cms_page" cascade;');
    }
}
