import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260719083140 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "payment_audit_trail" ("id" text not null, "transaction_id" text not null, "action" text not null, "ip_address" text null, "user_agent" text null, "payload" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_audit_trail_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_audit_trail_deleted_at" ON "payment_audit_trail" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "payment_transaction" ("id" text not null, "company_id" text null, "branch_id" text not null, "order_id" text not null, "customer_id" text not null, "amount" integer not null, "currency" text not null, "idempotency_key" text null, "status" text not null default 'pending', "settlement_status" text not null default 'unsettled', "provider" text not null default 'cod', "provider_ref" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_transaction_deleted_at" ON "payment_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_audit_trail" cascade;`);

    this.addSql(`drop table if exists "payment_transaction" cascade;`);
  }

}
