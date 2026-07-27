import { Migration } from '@mikro-orm/migrations';

export class Migration20260717110000 extends Migration {

  async up(): Promise<void> {
    // 1. Create rewards_gift_card table
    this.addSql('create table if not exists "rewards_gift_card" ("id" text not null, "code" text not null, "initial_balance" integer not null, "current_balance" integer not null, "currency_code" text not null default \'INR\', "is_active" boolean not null default true, "status" text not null default \'active\', "expires_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_gift_card_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rewards_gift_card_code" ON "rewards_gift_card" (code) WHERE deleted_at IS NULL;');

    // 2. Create rewards_gift_card_transaction table
    this.addSql('create table if not exists "rewards_gift_card_transaction" ("id" text not null, "gift_card_id" text not null, "amount" integer not null, "transaction_type" text not null, "reference_type" text null, "reference_id" text null, "idempotency_key" text null, "created_by" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_gift_card_transaction_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_gift_card_transaction_gift_card_id" ON "rewards_gift_card_transaction" (gift_card_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_gift_card_transaction_idempotency_key" ON "rewards_gift_card_transaction" (idempotency_key) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "rewards_gift_card_transaction" cascade;');
    this.addSql('drop table if exists "rewards_gift_card" cascade;');
  }

}
