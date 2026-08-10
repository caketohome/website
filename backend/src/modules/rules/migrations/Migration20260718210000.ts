import { Migration } from "@mikro-orm/migrations";

/**
 * Enterprise Marketing & Coupon System Migration:
 * Adds enterprise restriction columns, limits, approval workflows,
 * audit log table, daily metrics table, and high-performance indexes.
 */
export class Migration20260718210000 extends Migration {
    async up(): Promise<void> {
        // ── Offer table enterprise additions ───────────────────────────────
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "start_time" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "end_time" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT \'Asia/Kolkata\';');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "never_expires" boolean NOT NULL DEFAULT false;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "daily_limit" integer NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "monthly_limit" integer NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "auto_apply" boolean NOT NULL DEFAULT false;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "delivery_mode" text NOT NULL DEFAULT \'all\';');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "allowed_payment_methods" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "min_order_value" integer NOT NULL DEFAULT 0;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "max_discount_value" integer NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "min_quantity" integer NOT NULL DEFAULT 1;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_branches" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_cities" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_pincodes" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "excluded_pincodes" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_products" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_categories" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_flavors" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_shapes" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "applicable_weights" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "customer_eligibility" text NOT NULL DEFAULT \'all\';');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "allowed_customer_ids" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "allowed_phones" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "allowed_emails" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "customer_tags" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "exclude_discounted_items" boolean NOT NULL DEFAULT false;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "exclude_flash_sales" boolean NOT NULL DEFAULT false;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "approval_status" text NOT NULL DEFAULT \'approved\';');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "created_by" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "approved_by" text NULL;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "total_discount_given" integer NOT NULL DEFAULT 0;');
        this.addSql('ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "total_revenue_generated" integer NOT NULL DEFAULT 0;');

        // Indexes for fast coupon lookups
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_code" ON "offer" ("code") WHERE deleted_at IS NULL;');
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_status" ON "offer" ("status") WHERE deleted_at IS NULL;');
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_auto_apply" ON "offer" ("auto_apply") WHERE deleted_at IS NULL;');

        // ── Offer Redemption additional columns ────────────────────────────
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "customer_phone" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "customer_email" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "order_number" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "branch_id" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "branch_name" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "city" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "pincode" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "order_total" integer NOT NULL DEFAULT 0;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "payment_method" text NULL;');
        this.addSql('ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "order_status" text NOT NULL DEFAULT \'completed\';');

        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_redemption_offer_id" ON "offer_redemption" ("offer_id") WHERE deleted_at IS NULL;');
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_redemption_customer_id" ON "offer_redemption" ("customer_id") WHERE deleted_at IS NULL;');
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_redemption_branch_id" ON "offer_redemption" ("branch_id") WHERE deleted_at IS NULL;');

        // ── Offer Audit Log table ──────────────────────────────────────────
        this.addSql(`
            CREATE TABLE IF NOT EXISTS "offer_audit_log" (
                "id" text NOT NULL PRIMARY KEY,
                "offer_id" text NOT NULL,
                "offer_code" text NULL,
                "actor_id" text NULL,
                "actor_email" text NULL,
                "action" text NOT NULL,
                "changes_json" text NULL,
                "ip_address" text NULL,
                "user_agent" text NULL,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz NULL
            );
        `);
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_audit_log_offer_id" ON "offer_audit_log" ("offer_id") WHERE deleted_at IS NULL;');

        // ── Offer Daily Metric table ───────────────────────────────────────
        this.addSql(`
            CREATE TABLE IF NOT EXISTS "offer_daily_metric" (
                "id" text NOT NULL PRIMARY KEY,
                "offer_id" text NOT NULL,
                "metric_date" text NOT NULL,
                "redemptions_count" integer NOT NULL DEFAULT 0,
                "unique_customers_count" integer NOT NULL DEFAULT 0,
                "revenue_generated" integer NOT NULL DEFAULT 0,
                "discount_given" integer NOT NULL DEFAULT 0,
                "aov" integer NOT NULL DEFAULT 0,
                "branch_breakdown_json" text NULL,
                "city_breakdown_json" text NULL,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz NULL
            );
        `);
        this.addSql('CREATE INDEX IF NOT EXISTS "IDX_offer_daily_metric_offer_date" ON "offer_daily_metric" ("offer_id", "metric_date") WHERE deleted_at IS NULL;');
    }

    async down(): Promise<void> {
        this.addSql('DROP TABLE IF EXISTS "offer_daily_metric" CASCADE;');
        this.addSql('DROP TABLE IF EXISTS "offer_audit_log" CASCADE;');
    }
}
