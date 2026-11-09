-- Migration: c7_15_cms_schema_and_persistence_stabilization.sql
-- Purpose: Complete CMS Page Builder schema stabilization, adding missing columns to cms_page and cms_homepage_section,
--          and creating relational cms_revision, media, cms_block, cms_navigation, cms_banner, and cms_redirect tables.
-- Idempotency: Fully idempotent using IF NOT EXISTS and ADD COLUMN IF NOT EXISTS clauses.

BEGIN;

-- 1. Extend cms_page with full production schema
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'landing';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "blocks" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "meta_title" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "meta_description" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "canonical_url" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "og_image" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "author" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "excerpt" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "featured_image" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "reading_time" integer NOT NULL DEFAULT 0;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "published_at" timestamptz;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "language_code" text NOT NULL DEFAULT 'en';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "template_id" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "category_id" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "parent_id" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "breadcrumb_title" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "url_path" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "robots_tag" text NOT NULL DEFAULT 'index, follow';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "twitter_card" text NOT NULL DEFAULT 'summary_large_image';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "structured_data_type" text NOT NULL DEFAULT 'WebPage';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "visibility_rules" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "nav_location" text NOT NULL DEFAULT 'none';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "hide_from_nav" boolean NOT NULL DEFAULT false;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "analytics_summary" text;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_page_slug_lang" ON "cms_page" ("slug", "language_code") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_cms_page_type_status" ON "cms_page" ("type", "status") WHERE deleted_at IS NULL;

-- 2. Extend cms_homepage_section with full production schema
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT '';
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "section_type" text NOT NULL DEFAULT 'custom';
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "subtitle" text;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "config" text;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "starts_at" timestamptz;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "ends_at" timestamptz;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "visibility" text;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "theme" text;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "language_code" text NOT NULL DEFAULT 'en';
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

CREATE INDEX IF NOT EXISTS "IDX_cms_homepage_section_active" ON "cms_homepage_section" ("is_active", "language_code") WHERE deleted_at IS NULL;

-- 3. Create cms_revision table for durable rollback history
CREATE TABLE IF NOT EXISTS "cms_revision" (
  "id" text NOT NULL,
  "page_id" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "snapshot" text,
  "author" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "cms_revision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_cms_revision_page" ON "cms_revision" ("page_id") WHERE deleted_at IS NULL;

-- 4. Create media table for asset storage and metadata registry
CREATE TABLE IF NOT EXISTS "media" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "mime_type" text NOT NULL,
  "size" bigint NOT NULL,
  "folder" text NOT NULL DEFAULT 'uploads',
  "alt_text" text,
  "width" integer,
  "height" integer,
  "is_webp_generated" boolean DEFAULT false,
  "is_avif_generated" boolean DEFAULT false,
  "responsive_variants" jsonb,
  "blur_placeholder" text,
  "content_hash" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_media_folder" ON "media" ("folder") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_media_created_at" ON "media" ("created_at" DESC) WHERE deleted_at IS NULL;

-- 5. Create auxiliary CMS tables (blocks, navigation, banners, redirects)
CREATE TABLE IF NOT EXISTS "cms_block" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "identifier" text NOT NULL,
  "type" text NOT NULL DEFAULT 'rich_text',
  "content" text,
  "language_code" text NOT NULL DEFAULT 'en',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "cms_block_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_cms_block_identifier" ON "cms_block" ("identifier", "language_code") WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "cms_navigation" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "location" text NOT NULL,
  "items" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "language_code" text NOT NULL DEFAULT 'en',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "cms_navigation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_cms_navigation_location" ON "cms_navigation" ("location", "is_active", "language_code") WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "cms_banner" (
  "id" text NOT NULL,
  "title" text,
  "image_url" text NOT NULL,
  "mobile_image_url" text,
  "link_url" text,
  "alt_text" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "target" text,
  "language_code" text NOT NULL DEFAULT 'en',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "cms_banner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IDX_cms_banner_active" ON "cms_banner" ("is_active", "language_code") WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS "cms_redirect" (
  "id" text NOT NULL,
  "from_path" text NOT NULL,
  "to_url" text NOT NULL,
  "redirect_type" integer NOT NULL DEFAULT 301,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "cms_redirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cms_redirect_from" ON "cms_redirect" ("from_path") WHERE deleted_at IS NULL;

COMMIT;

