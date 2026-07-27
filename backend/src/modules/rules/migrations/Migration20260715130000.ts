import { Migration } from "@mikro-orm/migrations";

/**
 * Adds new columns to the offer and offer_redemption tables for the
 * comprehensive Rules/Promotion Engine (M2).
 *
 * New offer columns: is_public, branch_ids, customer_segments, metadata, total_redemptions
 * New redemption columns: discount_amount, cashback_amount, loyalty_points, metadata
 */
export class Migration20260715130000 extends Migration {
    async up(): Promise<void> {
        // ── Offer table additions ──────────────────────────────────────────
        this.addSql(
            'ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT true;'
        );
        this.addSql(
            'ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "branch_ids" text NULL;'
        );
        this.addSql(
            'ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "customer_segments" text NULL;'
        );
        this.addSql(
            'ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "metadata" text NULL;'
        );
        this.addSql(
            'ALTER TABLE "offer" ADD COLUMN IF NOT EXISTS "total_redemptions" integer NOT NULL DEFAULT 0;'
        );

        // Index on type for filtered queries
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_offer_type" ON "offer" ("type") WHERE deleted_at IS NULL;'
        );

        // Index on is_public for storefront listing
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_offer_is_public" ON "offer" ("is_public") WHERE deleted_at IS NULL;'
        );

        // ── Offer Redemption table additions ───────────────────────────────
        this.addSql(
            'ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "discount_amount" integer NOT NULL DEFAULT 0;'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "cashback_amount" integer NOT NULL DEFAULT 0;'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "loyalty_points" integer NOT NULL DEFAULT 0;'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" ADD COLUMN IF NOT EXISTS "metadata" text NULL;'
        );

        // Index for analytics: redemptions by offer over time
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_offer_redemption_created_at" ON "offer_redemption" ("created_at") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        // ── Reverse redemption additions ───────────────────────────────────
        this.addSql(
            'DROP INDEX IF EXISTS "IDX_offer_redemption_created_at";'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" DROP COLUMN IF EXISTS "metadata";'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" DROP COLUMN IF EXISTS "loyalty_points";'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" DROP COLUMN IF EXISTS "cashback_amount";'
        );
        this.addSql(
            'ALTER TABLE "offer_redemption" DROP COLUMN IF EXISTS "discount_amount";'
        );

        // ── Reverse offer additions ────────────────────────────────────────
        this.addSql(
            'DROP INDEX IF EXISTS "IDX_offer_is_public";'
        );
        this.addSql(
            'DROP INDEX IF EXISTS "IDX_offer_type";'
        );
        this.addSql(
            'ALTER TABLE "offer" DROP COLUMN IF EXISTS "total_redemptions";'
        );
        this.addSql(
            'ALTER TABLE "offer" DROP COLUMN IF EXISTS "metadata";'
        );
        this.addSql(
            'ALTER TABLE "offer" DROP COLUMN IF EXISTS "customer_segments";'
        );
        this.addSql(
            'ALTER TABLE "offer" DROP COLUMN IF EXISTS "branch_ids";'
        );
        this.addSql(
            'ALTER TABLE "offer" DROP COLUMN IF EXISTS "is_public";'
        );
    }
}
