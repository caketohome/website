import { Migration } from "@mikro-orm/migrations";

export class Migration20260714202500 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "offer" ("id" text not null, "name" text not null, "code" text null, "type" text not null, "status" text not null default \'draft\', "priority" integer not null default 0, "starts_at" timestamptz null, "ends_at" timestamptz null, "usage_limit" integer null, "per_customer_limit" integer null, "is_stackable" boolean not null default false, "description" text null, "conditions" text null, "rewards" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "offer_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_offer_code" ON "offer" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_offer_status" ON "offer" ("status") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "offer_redemption" ("id" text not null, "offer_id" text not null, "customer_id" text null, "order_id" text null, "cart_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "offer_redemption_pkey" primary key ("id"));'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_offer_redemption_offer_id" ON "offer_redemption" ("offer_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_offer_redemption_customer_id" ON "offer_redemption" ("customer_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "offer_redemption" cascade;');
        this.addSql('drop table if exists "offer" cascade;');
    }
}
