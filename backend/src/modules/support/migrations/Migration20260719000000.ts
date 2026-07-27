import { Migration } from "@mikro-orm/migrations";

export class Migration20260719000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table if not exists "chat_session" ("id" text not null, "customer_id" text null, "status" text not null default \'active\', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "chat_session_pkey" primary key ("id"));'
    );

    this.addSql(
      'create table if not exists "chat_message" ("id" text not null, "session_id" text not null, "sender_type" text not null, "message" text not null, "sent_at" timestamptz not null default now(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "chat_message_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_chat_message_session_id" ON "chat_message" ("session_id") WHERE deleted_at IS NULL;'
    );

    this.addSql(
      'create table if not exists "support_ticket" ("id" text not null, "ticket_no" text not null, "customer_id" text not null, "subject" text not null, "description" text not null, "priority" text not null default \'medium\', "status" text not null default \'open\', "assigned_to" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "support_ticket_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_support_ticket_ticket_no" ON "support_ticket" ("ticket_no") WHERE deleted_at IS NULL;'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_support_ticket_customer_id" ON "support_ticket" ("customer_id") WHERE deleted_at IS NULL;'
    );

    this.addSql(
      'create table if not exists "ticket_message" ("id" text not null, "ticket_id" text not null, "sender_type" text not null, "message" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ticket_message_pkey" primary key ("id"));'
    );
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_ticket_message_ticket_id" ON "ticket_message" ("ticket_id") WHERE deleted_at IS NULL;'
    );

    this.addSql(
      'create table if not exists "contact_submission" ("id" text not null, "name" text not null, "email" text not null, "phone" text not null, "subject" text not null, "message" text not null, "is_resolved" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "contact_submission_pkey" primary key ("id"));'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "contact_submission" cascade;');
    this.addSql('drop table if exists "ticket_message" cascade;');
    this.addSql('drop table if exists "support_ticket" cascade;');
    this.addSql('drop table if exists "chat_message" cascade;');
    this.addSql('drop table if exists "chat_session" cascade;');
  }
}
