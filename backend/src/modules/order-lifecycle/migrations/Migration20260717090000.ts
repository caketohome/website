import { Migration } from "@mikro-orm/migrations";

/**
 * Phase 5 — Order Lifecycle module migration.
 *
 * Creates the order lifecycle extension tables:
 *   - order_status_history   (append-only status transition audit trail)
 *   - order_event             (timeline events)
 *   - order_note              (internal + customer notes)
 *   - delivery_proof          (photo + signature proof of delivery)
 *   - refund                  (refund records, partial + full)
 *   - reschedule_request      (delivery slot/date change requests)
 *   - order_staff_assignment  (staff accountability per order)
 *
 * All tables soft-link to the Medusa core order by id (order_...); the core
 * order entity is never modified — only extended. Backward compatible: every
 * table uses `if not exists` and the down() drops them with `if exists`.
 */
export class Migration20260717090000 extends Migration {
    async up(): Promise<void> {
        this.addSql(
            'create table if not exists "order_status_history" ("id" text not null, "order_id" text not null, "to_status" text not null, "from_status" text null, "actor_type" text null, "actor_id" text null, "reason" text null, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_status_history_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_status_history_order_id" ON "order_status_history" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_status_history_to_status" ON "order_status_history" ("to_status") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "order_event" ("id" text not null, "order_id" text not null, "event_type" text not null, "message" text null, "actor_type" text null, "actor_id" text null, "is_customer_visible" boolean not null default true, "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_event_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_event_order_id" ON "order_event" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_event_event_type" ON "order_event" ("event_type") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "order_note" ("id" text not null, "order_id" text not null, "note_type" text not null default \'internal\', "author_type" text null, "author_id" text null, "body" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_note_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_note_order_id" ON "order_note" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_note_note_type" ON "order_note" ("note_type") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "delivery_proof" ("id" text not null, "order_id" text not null, "delivery_id" text null, "delivery_partner_id" text null, "photo_url" text null, "signature_url" text null, "note" text null, "latitude" numeric null, "longitude" numeric null, "captured_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_proof_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_delivery_proof_order_id" ON "delivery_proof" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_delivery_proof_delivery_id" ON "delivery_proof" ("delivery_id") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "order_lifecycle_refund" ("id" text not null, "order_id" text not null, "amount" integer not null, "refund_channel" text not null default \'payment_provider\', "reason_code" text null, "reason" text null, "actor_type" text null, "actor_id" text null, "provider_refund_id" text null, "status" text not null default \'processed\', "metadata" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_lifecycle_refund_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_lifecycle_refund_order_id" ON "order_lifecycle_refund" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_lifecycle_refund_status" ON "order_lifecycle_refund" ("status") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "reschedule_request" ("id" text not null, "order_id" text not null, "requested_by_type" text null, "requested_by_id" text null, "requested_date" text null, "requested_slot_id" text null, "reason" text null, "status" text not null default \'requested\', "resolved_by_type" text null, "resolved_by_id" text null, "resolved_at" timestamptz null, "resolution_note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "reschedule_request_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_reschedule_request_order_id" ON "reschedule_request" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_reschedule_request_status" ON "reschedule_request" ("status") WHERE deleted_at IS NULL;'
        );

        this.addSql(
            'create table if not exists "order_staff_assignment" ("id" text not null, "order_id" text not null, "role" text not null, "staff_id" text not null, "staff_name" text null, "assigned_by_type" text null, "assigned_by_id" text null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_staff_assignment_pkey" primary key ("id"));'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_staff_assignment_order_id" ON "order_staff_assignment" ("order_id") WHERE deleted_at IS NULL;'
        );
        this.addSql(
            'CREATE INDEX IF NOT EXISTS "IDX_order_staff_assignment_staff_id" ON "order_staff_assignment" ("staff_id") WHERE deleted_at IS NULL;'
        );
    }

    async down(): Promise<void> {
        this.addSql('drop table if exists "order_staff_assignment" cascade;');
        this.addSql('drop table if exists "reschedule_request" cascade;');
        this.addSql('drop table if exists "order_lifecycle_refund" cascade;');
        this.addSql('drop table if exists "delivery_proof" cascade;');
        this.addSql('drop table if exists "order_note" cascade;');
        this.addSql('drop table if exists "order_event" cascade;');
        this.addSql('drop table if exists "order_status_history" cascade;');
    }
}
