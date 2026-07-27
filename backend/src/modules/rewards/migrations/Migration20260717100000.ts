import { Migration } from '@mikro-orm/migrations';

export class Migration20260717100000 extends Migration {

  async up(): Promise<void> {
    // 1. Create rewards_wallet table
    this.addSql('create table if not exists "rewards_wallet" ("id" text not null, "customer_id" text not null, "balance" integer not null default 0, "currency_code" text not null default \'INR\', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_wallet_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rewards_wallet_customer_id" ON "rewards_wallet" (customer_id) WHERE deleted_at IS NULL;');

    // 2. Create rewards_wallet_transaction table
    this.addSql('create table if not exists "rewards_wallet_transaction" ("id" text not null, "wallet_id" text not null, "amount" integer not null, "type" text not null, "status" text not null default \'completed\', "reference_type" text null, "reference_id" text null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_wallet_transaction_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_wallet_transaction_wallet_id" ON "rewards_wallet_transaction" (wallet_id) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "rewards_wallet_transaction" cascade;');
    this.addSql('drop table if exists "rewards_wallet" cascade;');
  }

}
