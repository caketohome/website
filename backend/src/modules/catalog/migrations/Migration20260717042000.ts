import { Migration } from "@mikro-orm/migrations";

export class Migration20260717042000 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "cake_option" ("id" text not null, "product_id" text not null, "option_type" text not null, "values" text not null, "price_delta" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cake_option_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_cake_option_product_id" ON "cake_option" ("product_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "cake_option" cascade;');
    }
}
