import { Migration } from '@mikro-orm/migrations';

export class Migration20260717130000 extends Migration {

  async up(): Promise<void> {
    // 1. Create rewards_referral_program table
    this.addSql('create table if not exists "rewards_referral_program" ("id" text not null, "name" text not null, "description" text null, "status" text not null default \'active\', "reward_type" text not null, "reward_value" integer not null, "qualification_rules" jsonb null, "start_date" timestamptz null, "end_date" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_referral_program_pkey" primary key ("id"));');

    // 2. Create rewards_referral_code table
    this.addSql('create table if not exists "rewards_referral_code" ("id" text not null, "customer_id" text not null, "code" text not null, "status" text not null default \'active\', "usage_limit" integer null, "usage_count" integer not null default 0, "expires_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_referral_code_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rewards_referral_code_customer_id" ON "rewards_referral_code" (customer_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rewards_referral_code_code" ON "rewards_referral_code" (code) WHERE deleted_at IS NULL;');

    // 3. Create rewards_referral_event table
    this.addSql('create table if not exists "rewards_referral_event" ("id" text not null, "referral_code_id" text not null, "referrer_id" text not null, "referee_id" text not null, "event_type" text not null, "status" text not null default \'pending\', "order_id" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_referral_event_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_referral_event_code_id" ON "rewards_referral_event" (referral_code_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_referral_event_referrer_id" ON "rewards_referral_event" (referrer_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_referral_event_referee_id" ON "rewards_referral_event" (referee_id) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_referral_event_order_id" ON "rewards_referral_event" (order_id) WHERE deleted_at IS NULL;');

    // 4. Create rewards_referral_qualification table
    this.addSql('create table if not exists "rewards_referral_qualification" ("id" text not null, "referral_event_id" text not null, "qualified" boolean not null default false, "qualification_reason" text null, "reviewed_at" timestamptz null, "reviewed_by" text null, "fraud_score" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_referral_qualification_pkey" primary key ("id"));');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rewards_referral_qualification_event_id" ON "rewards_referral_qualification" (referral_event_id) WHERE deleted_at IS NULL;');

    // 5. Create rewards_fraud_review table
    this.addSql('create table if not exists "rewards_fraud_review" ("id" text not null, "referral_event_id" text not null, "status" text not null default \'pending\', "reason" text null, "reviewer" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rewards_fraud_review_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_rewards_fraud_review_event_id" ON "rewards_fraud_review" (referral_event_id) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "rewards_fraud_review" cascade;');
    this.addSql('drop table if exists "rewards_referral_qualification" cascade;');
    this.addSql('drop table if exists "rewards_referral_event" cascade;');
    this.addSql('drop table if exists "rewards_referral_code" cascade;');
    this.addSql('drop table if exists "rewards_referral_program" cascade;');
  }

}
