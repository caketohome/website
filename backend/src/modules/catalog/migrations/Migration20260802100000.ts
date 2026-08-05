import { Migration } from "@mikro-orm/migrations";

/**
 * Enterprise PIM System Migration.
 *
 * Extends product_meta table with rich PIM fields (SKU, barcode, tags, occasion, brand, cake_type, prices, variants, add-ons, SEO)
 * and creates pim_category table for enterprise category management.
 */
export class Migration20260802100000 extends Migration {
    async up(): Promise<void> {
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "sku" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "barcode" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "tags" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "occasion" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "brand" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "cake_type" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "cost_price" real null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "mrp" real null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "gst_rate" real null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "tax_class" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "add_ons_json" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "variants_json" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "customization_config_json" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "seo_keywords" text null;');
        this.addSql('ALTER TABLE "product_meta" ADD COLUMN IF NOT EXISTS "canonical_url" text null;');

        this.addSql(
            'create table if not exists "pim_category" ("id" text not null, "name" text not null, "slug" text not null, "description" text null, "parent_id" text null, "image_url" text null, "banner_url" text null, "display_order" integer not null default 0, "status" text not null default \'active\', "visibility" text not null default \'public\', "seo_title" text null, "seo_description" text null, "og_image" text null, "branch_ids" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pim_category_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pim_category_slug" ON "pim_category" ("slug") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_pim_category_parent_id" ON "pim_category" ("parent_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_pim_category_status" ON "pim_category" ("status") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('DROP TABLE IF EXISTS "pim_category" CASCADE;');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "sku";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "barcode";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "tags";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "occasion";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "brand";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "cake_type";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "cost_price";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "mrp";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "gst_rate";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "tax_class";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "add_ons_json";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "variants_json";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "customization_config_json";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "seo_keywords";');
        this.addSql('ALTER TABLE "product_meta" DROP COLUMN IF EXISTS "canonical_url";');
    }
}
