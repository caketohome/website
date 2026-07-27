import { Migration } from "@mikro-orm/migrations";

/**
 * Extends the media table with folder hierarchy, responsive variants,
 * blur placeholders, AVIF flag, content hash (duplicate detection), and metadata.
 * Backward-compatible: only adds nullable/defaulted columns.
 */
export class Migration20260715211000 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "parent_id" text null;'
        );
        this.addSql(
            'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "is_avif_generated" boolean not null default false;'
        );
        this.addSql(
            'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "responsive_variants" text null;'
        );
        this.addSql(
            'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "blur_placeholder" text null;'
        );
        this.addSql(
            'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "content_hash" text null;'
        );
        this.addSql(
            'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "metadata" text null;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_media_content_hash" ON "media" ("content_hash") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_media_parent_id" ON "media" ("parent_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('DROP INDEX IF EXISTS "IDX_media_content_hash";');
        this.addSql('DROP INDEX IF EXISTS "IDX_media_parent_id";');
        this.addSql('ALTER TABLE "media" DROP COLUMN IF EXISTS "metadata";');
        this.addSql('ALTER TABLE "media" DROP COLUMN IF EXISTS "content_hash";');
        this.addSql('ALTER TABLE "media" DROP COLUMN IF EXISTS "blur_placeholder";');
        this.addSql('ALTER TABLE "media" DROP COLUMN IF EXISTS "responsive_variants";');
        this.addSql('ALTER TABLE "media" DROP COLUMN IF EXISTS "is_avif_generated";');
        this.addSql('ALTER TABLE "media" DROP COLUMN IF EXISTS "parent_id";');
    }
}
