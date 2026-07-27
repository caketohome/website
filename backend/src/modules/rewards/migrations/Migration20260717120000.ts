import { Migration } from '@mikro-orm/migrations';

export class Migration20260717120000 extends Migration {

  async up(): Promise<void> {
    // 1. Create rewards_loyalty_ledger table
    this.addSql('create table if not exists "rewards_loyalty_ledger" ("id" text not null, "customer_id" text not null, "points" integer not null default 0, "lifetime_points" integer not null default 0, "tier" text not null default \'bronze\', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_loyalty_ledger_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rewards_loyalty_ledger_customer_id" ON "rewards_loyalty_ledger" (customer_id) WHERE deleted_at IS NULL;');

    // 2. Create rewards_loyalty_transaction table
    this.addSql('create table if not exists "rewards_loyalty_transaction" ("id" text not null, "loyalty_ledger_id" text not null, "points" integer not null, "transaction_type" text not null, "description" text null, "reference_type" text null, "reference_id" text null, "created_by" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_loyalty_transaction_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_loyalty_transaction_ledger_id" ON "rewards_loyalty_transaction" (loyalty_ledger_id) WHERE deleted_at IS NULL;');

    // 3. Create rewards_loyalty_rule table
    this.addSql('create table if not exists "rewards_loyalty_rule" ("id" text not null, "name" text not null, "rule_type" text not null default \'ratio\', "value" double precision not null, "min_spend" integer not null default 0, "is_active" boolean not null default true, "conditions" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_loyalty_rule_pkey" primary key ("id"));');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "rewards_loyalty_rule" cascade;');
    this.addSql('drop table if exists "rewards_loyalty_transaction" cascade;');
    this.addSql('drop table if exists "rewards_loyalty_ledger" cascade;');
  }

}
