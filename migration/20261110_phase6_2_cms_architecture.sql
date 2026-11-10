-- CakeToHome — Phase 6.2 CMS, Page Builder & Content Architecture Migration
-- Idempotent, safe migration for PostgreSQL 16
-- Preserves all existing business, order, invoice, and payment tables untouched.

BEGIN;

-- 1. Extend cms_page table
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "type" VARCHAR(32) DEFAULT 'landing';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) DEFAULT 'draft';
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "meta_title" VARCHAR(255);
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "canonical_url" VARCHAR(512);
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "og_image" TEXT;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "blocks" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ;
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cms_page" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cms_page_slug ON "cms_page" ("slug");
CREATE INDEX IF NOT EXISTS idx_cms_page_status ON "cms_page" ("status");
CREATE INDEX IF NOT EXISTS idx_cms_page_type ON "cms_page" ("type");

-- 2. Extend or align cms_homepage_section
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "section_type" VARCHAR(64);
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT TRUE;
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cms_homepage_section" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

-- 3. Create cms_revision table for immutable version history
CREATE TABLE IF NOT EXISTS "cms_revision" (
  "id" VARCHAR(64) PRIMARY KEY,
  "page_id" VARCHAR(64) NOT NULL REFERENCES "cms_page"("id") ON DELETE CASCADE,
  "version" INT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "change_summary" TEXT,
  "author" VARCHAR(128) NOT NULL DEFAULT 'Admin',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cms_revision_page_version UNIQUE ("page_id", "version")
);
CREATE INDEX IF NOT EXISTS idx_cms_revision_page_id ON "cms_revision" ("page_id");
CREATE INDEX IF NOT EXISTS idx_cms_revision_created_at ON "cms_revision" ("created_at" DESC);

-- 4. Create cms_block table for reusable components
CREATE TABLE IF NOT EXISTS "cms_block" (
  "id" VARCHAR(64) PRIMARY KEY,
  "identifier" VARCHAR(64) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "content" JSONB NOT NULL,
  "language_code" VARCHAR(10) NOT NULL DEFAULT 'en',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cms_block_identifier ON "cms_block" ("identifier");
CREATE INDEX IF NOT EXISTS idx_cms_block_type ON "cms_block" ("type");

-- 5. Create media table
CREATE TABLE IF NOT EXISTS "media" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnail_url" TEXT,
  "mime_type" VARCHAR(64) NOT NULL,
  "size" BIGINT NOT NULL,
  "folder" VARCHAR(64) NOT NULL DEFAULT 'general',
  "alt_text" TEXT,
  "width" INT,
  "height" INT,
  "is_webp_generated" BOOLEAN DEFAULT FALSE,
  "is_avif_generated" BOOLEAN DEFAULT FALSE,
  "responsive_variants" JSONB,
  "blur_placeholder" TEXT,
  "content_hash" VARCHAR(64),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_media_folder ON "media" ("folder");
CREATE INDEX IF NOT EXISTS idx_media_created_at ON "media" ("created_at" DESC);

-- 6. Create cms_navigation table
CREATE TABLE IF NOT EXISTS "cms_navigation" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(128) NOT NULL,
  "location" VARCHAR(32) NOT NULL UNIQUE,
  "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cms_navigation_location ON "cms_navigation" ("location");

-- 7. Create cms_redirect table
CREATE TABLE IF NOT EXISTS "cms_redirect" (
  "id" VARCHAR(64) PRIMARY KEY,
  "from_path" VARCHAR(512) NOT NULL UNIQUE,
  "to_path" VARCHAR(512) NOT NULL,
  "status_code" INT NOT NULL DEFAULT 301,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cms_redirect_from_path ON "cms_redirect" ("from_path");

-- 8. Create cms_theme_setting table
CREATE TABLE IF NOT EXISTS "cms_theme_setting" (
  "id" VARCHAR(64) PRIMARY KEY,
  "scope" VARCHAR(32) NOT NULL UNIQUE DEFAULT 'global',
  "tokens" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Create cms_page_template table
CREATE TABLE IF NOT EXISTS "cms_page_template" (
  "id" VARCHAR(64) PRIMARY KEY,
  "template_key" VARCHAR(64) NOT NULL UNIQUE,
  "name" VARCHAR(128) NOT NULL,
  "page_type" VARCHAR(32) NOT NULL,
  "description" TEXT,
  "default_sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "supported_blocks" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
