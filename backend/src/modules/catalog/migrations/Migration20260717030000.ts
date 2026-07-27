import { Migration } from "@mikro-orm/migrations";

/**
 * Phase 3 — Catalog module migration.
 *
 * Creates the catalog extension tables:
 *   - product_meta        (cake-specific metadata, one row per product)
 *   - product_review       (customer ratings + reviews with moderation)
 *   - wishlist_item        (saved products per customer)
 *   - stock_notification   (notify-me-when-back-in-stock)
 *   - subscription         (recurring product orders)
 *
 * All tables soft-link to the Medusa core product/customer by id; the core
 * catalog is never modified.
 */
export class Migration20260717030000 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "product_meta" ("id" text not null, "product_id" text not null, "eggless" boolean not null default false, "sugar_free" boolean not null default false, "gluten_free" boolean not null default false, "vegan" boolean not null default false, "ingredients" text null, "allergens" text null, "nutritional_info" text null, "shelf_life" text null, "storage_instructions" text null, "fssai_license" text null, "video_url" text null, "is_featured" boolean not null default false, "is_bestseller" boolean not null default false, "is_new_arrival" boolean not null default false, "search_document" text null, "meta" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_meta_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_meta_product_id" ON "product_meta" ("product_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "product_review" ("id" text not null, "product_id" text not null, "customer_id" text null, "customer_name" text null, "rating" integer not null, "title" text null, "body" text null, "images" text null, "status" text not null default \'pending\', "reply" text null, "replied_at" timestamptz null, "verified_purchase" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_review_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_product_review_product_id" ON "product_review" ("product_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_product_review_status" ON "product_review" ("status") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_product_review_customer_id" ON "product_review" ("customer_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "wishlist_item" ("id" text not null, "customer_id" text not null, "product_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_item_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_customer_product" ON "wishlist_item" ("customer_id", "product_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_customer_id" ON "wishlist_item" ("customer_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "stock_notification" ("id" text not null, "product_id" text not null, "variant_id" text null, "customer_id" text null, "email" text null, "phone" text null, "status" text not null default \'pending\', "notified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "stock_notification_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_stock_notification_product_id" ON "stock_notification" ("product_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_stock_notification_status" ON "stock_notification" ("status") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "subscription" ("id" text not null, "customer_id" text not null, "product_id" text not null, "variant_id" text null, "frequency" text not null default \'monthly\', "quantity" integer not null default 1, "next_date" timestamptz not null, "status" text not null default \'active\', "max_deliveries" integer null, "deliveries_count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "subscription_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_subscription_customer_id" ON "subscription" ("customer_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_subscription_status" ON "subscription" ("status") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_subscription_next_date" ON "subscription" ("next_date") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "subscription" cascade;');
        this.addSql('drop table if exists "stock_notification" cascade;');
        this.addSql('drop table if exists "wishlist_item" cascade;');
        this.addSql('drop table if exists "product_review" cascade;');
        this.addSql('drop table if exists "product_meta" cascade;');
    }
}
