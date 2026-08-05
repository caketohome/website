import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801160000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "delivery"
      ADD COLUMN IF NOT EXISTS "transaction_id" text NULL,
      ADD COLUMN IF NOT EXISTS "delivery_partner_id" text NULL,
      ADD COLUMN IF NOT EXISTS "delivery_status" text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "eta" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "delivery_date" text NULL,
      ADD COLUMN IF NOT EXISTS "delivery_slot_id" text NULL,
      ADD COLUMN IF NOT EXISTS "ordered_for_self" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "recipient_name" text NULL,
      ADD COLUMN IF NOT EXISTS "recipient_phone" text NULL,
      ADD COLUMN IF NOT EXISTS "recipient_alt_phone" text NULL,
      ADD COLUMN IF NOT EXISTS "recipient_address" text NULL,
      ADD COLUMN IF NOT EXISTS "recipient_pincode" text NULL,
      ADD COLUMN IF NOT EXISTS "recipient_landmark" text NULL,
      ADD COLUMN IF NOT EXISTS "delivery_instructions" text NULL,
      ADD COLUMN IF NOT EXISTS "gift_wrap" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "greeting_card" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "gift_message" text NULL,
      ADD COLUMN IF NOT EXISTS "anonymous_delivery" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "hide_invoice" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "occasion" text NULL,
      ADD COLUMN IF NOT EXISTS "is_surprise_delivery" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "scheduled_delivery_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "scheduled_slot" text NULL,
      ADD COLUMN IF NOT EXISTS "delivery_otp" text NULL;
    `);

    this.addSql(`
      create table if not exists "delivery_delivery_partner" (
        "id" text not null,
        "delivery_id" text null,
        "delivery_partner_id" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "delivery_delivery_partner_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_delivery_partner_deleted_at" ON "delivery_delivery_partner" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "delivery_delivery_partner" cascade;`);
  }

}
