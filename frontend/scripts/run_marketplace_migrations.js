/**
 * Database Migration: Partner Marketplace, Shared Cake & Bouquet Inventory,
 * Feature Toggles, and Holiday Scheduling.
 * 
 * Idempotent, safe migration with strict constraint enforcement and index creation.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

async function runMigration() {
  console.log("==================================================================");
  console.log("RUNNING DATABASE MIGRATION: MARKETPLACE, SHARED INVENTORY, FEATURES & SCHEDULES");
  console.log("==================================================================");

  const client = new Client({ connectionString: getDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query("BEGIN;");

    // ── 1. Shared Cake & Bouquet Inventory ──
    console.log("1. Creating shared inventory tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "shared_inventory" (
        "id" text PRIMARY KEY,
        "product_id" text NOT NULL,
        "variant_id" text NOT NULL,
        "merchandise_type" text NOT NULL DEFAULT 'CAKE',
        "title" text NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "reserved" integer NOT NULL DEFAULT 0,
        "safety_threshold" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "chk_shared_inv_qty_non_neg" CHECK (quantity >= 0),
        CONSTRAINT "chk_shared_inv_res_non_neg" CHECK (reserved >= 0),
        CONSTRAINT "chk_shared_inv_avail_valid" CHECK (quantity >= reserved),
        CONSTRAINT "uq_shared_inv_prod_variant" UNIQUE (product_id, variant_id)
      );

      CREATE INDEX IF NOT EXISTS "idx_shared_inventory_prod" ON "shared_inventory"(product_id);
      CREATE INDEX IF NOT EXISTS "idx_shared_inventory_type" ON "shared_inventory"(merchandise_type);

      CREATE TABLE IF NOT EXISTS "inventory_allocation" (
        "id" text PRIMARY KEY,
        "shared_inventory_id" text NOT NULL REFERENCES "shared_inventory"(id) ON DELETE CASCADE,
        "entity_type" text NOT NULL CHECK (entity_type IN ('BRANCH', 'PARTNER')),
        "entity_id" text NOT NULL,
        "allocated_quantity" integer NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
        "consumed_quantity" integer NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_inv_allocation_entity" UNIQUE (shared_inventory_id, entity_type, entity_id)
      );

      CREATE TABLE IF NOT EXISTS "inventory_reservation" (
        "id" text PRIMARY KEY,
        "shared_inventory_id" text NOT NULL REFERENCES "shared_inventory"(id) ON DELETE CASCADE,
        "order_id" text NULL,
        "cart_id" text NULL,
        "entity_type" text NOT NULL CHECK (entity_type IN ('BRANCH', 'PARTNER')),
        "entity_id" text NOT NULL,
        "quantity" integer NOT NULL CHECK (quantity > 0),
        "status" text NOT NULL CHECK (status IN ('RESERVED', 'CONFIRMED', 'FULFILLED', 'RELEASED', 'CANCELLED', 'EXPIRED')) DEFAULT 'RESERVED',
        "expires_at" timestamptz NOT NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_inv_res_order" ON "inventory_reservation"(order_id);
      CREATE INDEX IF NOT EXISTS "idx_inv_res_cart" ON "inventory_reservation"(cart_id);
      CREATE INDEX IF NOT EXISTS "idx_inv_res_status_expires" ON "inventory_reservation"(status, expires_at);

      -- Extend existing inventory_movement table cleanly
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "shared_inventory_id" text REFERENCES "shared_inventory"(id) ON DELETE CASCADE;
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "partner_id" text;
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "actor_role" text;
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "previous_quantity" integer;
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "new_quantity" integer;
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "previous_reserved" integer;
      ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "new_reserved" integer;

      CREATE INDEX IF NOT EXISTS "idx_inv_mov_shared" ON "inventory_movement"(shared_inventory_id);
      CREATE INDEX IF NOT EXISTS "idx_inv_mov_ref" ON "inventory_movement"(order_id);
    `);

    // ── 2. Feature Flags & Hierarchical Overrides ──
    console.log("2. Creating feature flags & audit tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "feature_flag" (
        "id" text PRIMARY KEY,
        "key" text NOT NULL,
        "name" text NOT NULL,
        "description" text NULL,
        "category" text NOT NULL DEFAULT 'OPERATIONS',
        "scope" text NOT NULL CHECK (scope IN ('GLOBAL', 'BRANCH', 'PARTNER')),
        "entity_id" text NOT NULL DEFAULT 'global',
        "is_enabled" boolean NOT NULL DEFAULT false,
        "is_system_mandatory" boolean NOT NULL DEFAULT false,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_feature_flag_key_scope_entity" UNIQUE (key, scope, entity_id)
      );

      CREATE INDEX IF NOT EXISTS "idx_feature_flag_lookup" ON "feature_flag"(key, scope, entity_id);

      CREATE TABLE IF NOT EXISTS "feature_flag_audit" (
        "id" text PRIMARY KEY,
        "flag_id" text NOT NULL,
        "key" text NOT NULL,
        "scope" text NOT NULL,
        "entity_id" text NOT NULL,
        "previous_value" boolean NULL,
        "new_value" boolean NOT NULL,
        "actor_id" text NOT NULL,
        "actor_role" text NOT NULL,
        "reason" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_feature_flag_audit_key" ON "feature_flag_audit"(key, created_at DESC);
    `);

    // ── 3. Branch & Partner Holiday/Closure Scheduling ──
    console.log("3. Creating operational closure & impact tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "operational_closure" (
        "id" text PRIMARY KEY,
        "entity_type" text NOT NULL CHECK (entity_type IN ('BRANCH', 'PARTNER', 'ORGANIZATION')),
        "entity_id" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_full_day" boolean NOT NULL DEFAULT true,
        "opening_time" text NULL,
        "closing_time" text NULL,
        "closure_type" text NOT NULL CHECK (closure_type IN ('HOLIDAY', 'MAINTENANCE', 'PLANNED_CLOSURE', 'EMERGENCY')),
        "reason" text NOT NULL,
        "status" text NOT NULL CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')) DEFAULT 'SCHEDULED',
        "actor_id" text NOT NULL,
        "actor_role" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "chk_closure_date_order" CHECK (end_date >= start_date)
      );

      CREATE INDEX IF NOT EXISTS "idx_operational_closure_entity_dates" ON "operational_closure"(entity_type, entity_id, start_date, end_date);

      CREATE TABLE IF NOT EXISTS "operational_closure_impact" (
        "id" text PRIMARY KEY,
        "closure_id" text NOT NULL REFERENCES "operational_closure"(id) ON DELETE CASCADE,
        "order_id" text NOT NULL,
        "order_delivery_date" date NOT NULL,
        "impact_status" text NOT NULL CHECK (impact_status IN ('PENDING_REVIEW', 'REASSIGNED', 'RESCHEDULED', 'CANCELLED_WITH_REFUND', 'OVERRIDDEN_FOR_FULFILLMENT')) DEFAULT 'PENDING_REVIEW',
        "resolution_note" text NULL,
        "resolved_by" text NULL,
        "resolved_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_closure_impact_order" UNIQUE (closure_id, order_id)
      );

      CREATE INDEX IF NOT EXISTS "idx_closure_impact_status" ON "operational_closure_impact"(impact_status);
    `);

    // ── 4. Partner Marketplace Subsystem ──
    console.log("4. Creating marketplace partner, store, agreement, snapshot, invoice & complaint tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_partner" (
        "id" text PRIMARY KEY,
        "code" text NOT NULL UNIQUE,
        "legal_name" text NOT NULL,
        "trade_name" text NOT NULL,
        "gstin" text NULL,
        "pan" text NULL,
        "status" text NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'TERMINATED')) DEFAULT 'PENDING_APPROVAL',
        "contact_name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "phone" text NOT NULL,
        "address" jsonb NOT NULL,
        "city_id" text NULL,
        "state_code" text DEFAULT '29',
        "bank_details" jsonb NULL,
        "agreement_id" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz NULL
      );

      CREATE INDEX IF NOT EXISTS "idx_mkt_partner_status" ON "marketplace_partner"(status);

      CREATE TABLE IF NOT EXISTS "marketplace_store" (
        "id" text PRIMARY KEY,
        "partner_id" text NOT NULL REFERENCES "marketplace_partner"(id) ON DELETE CASCADE,
        "name" text NOT NULL,
        "code" text NOT NULL UNIQUE,
        "is_open" boolean NOT NULL DEFAULT true,
        "address" text NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "service_radius_km" double precision NOT NULL DEFAULT 10.0,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "deleted_at" timestamptz NULL
      );

      CREATE INDEX IF NOT EXISTS "idx_mkt_store_partner" ON "marketplace_store"(partner_id);

      CREATE TABLE IF NOT EXISTS "marketplace_agreement" (
        "id" text PRIMARY KEY,
        "partner_id" text NOT NULL REFERENCES "marketplace_partner"(id) ON DELETE CASCADE,
        "agreement_type" text NOT NULL CHECK (agreement_type IN ('COMMISSION_PERCENTAGE', 'FIXED_PER_ORDER', 'WHOLESALE_TRANSFER', 'HYBRID')),
        "commission_rate" numeric(5,2) DEFAULT 0.00,
        "fixed_fee_per_order" numeric(12,2) DEFAULT 0.00,
        "delivery_subsidy_rate" numeric(5,2) DEFAULT 0.00,
        "effective_from" date NOT NULL,
        "effective_to" date NULL,
        "status" text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'SUPERSEDED')) DEFAULT 'DRAFT',
        "terms_document_ref" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_mkt_agreement_partner" ON "marketplace_agreement"(partner_id, status);

      CREATE TABLE IF NOT EXISTS "marketplace_order_snapshot" (
        "id" text PRIMARY KEY,
        "order_id" text NOT NULL UNIQUE,
        "partner_id" text NOT NULL REFERENCES "marketplace_partner"(id),
        "store_id" text NOT NULL REFERENCES "marketplace_store"(id),
        "agreement_id" text NOT NULL REFERENCES "marketplace_agreement"(id),
        "agreement_type" text NOT NULL,
        "commission_rate" numeric(5,2) NOT NULL,
        "fixed_fee" numeric(12,2) NOT NULL,
        "gross_order_amount" numeric(12,2) NOT NULL,
        "tax_amount" numeric(12,2) NOT NULL,
        "commission_amount" numeric(12,2) NOT NULL,
        "partner_net_receivable" numeric(12,2) NOT NULL,
        "snapshot_data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_mkt_order_snap_partner" ON "marketplace_order_snapshot"(partner_id);

      CREATE TABLE IF NOT EXISTS "marketplace_partner_invoice" (
        "id" text PRIMARY KEY,
        "partner_id" text NOT NULL REFERENCES "marketplace_partner"(id),
        "partner_invoice_number" text NOT NULL,
        "partner_invoice_date" date NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "claimed_amount" numeric(12,2) NOT NULL,
        "calculated_amount" numeric(12,2) NOT NULL,
        "discrepancy_amount" numeric(12,2) NOT NULL DEFAULT 0.00,
        "document_reference" text NULL,
        "status" text NOT NULL CHECK (status IN ('RECEIVED', 'UNDER_REVIEW', 'DISCREPANCY_DETECTED', 'RECONCILED', 'APPROVED', 'REJECTED', 'POSTED_TO_BILLS_PAYABLE')) DEFAULT 'RECEIVED',
        "accounting_voucher_id" text NULL,
        "reconciliation_statement_json" jsonb NULL,
        "reconciled_by" text NULL,
        "reconciled_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "uq_partner_invoice_num" UNIQUE (partner_id, partner_invoice_number)
      );

      CREATE INDEX IF NOT EXISTS "idx_mkt_partner_inv_status" ON "marketplace_partner_invoice"(partner_id, status);

      CREATE TABLE IF NOT EXISTS "marketplace_complaint" (
        "id" text PRIMARY KEY,
        "order_id" text NOT NULL,
        "partner_id" text NOT NULL REFERENCES "marketplace_partner"(id),
        "customer_id" text NOT NULL,
        "category" text NOT NULL,
        "description" text NOT NULL,
        "status" text NOT NULL CHECK (status IN ('OPEN', 'INVESTIGATING', 'ESCALATED_TO_PARTNER', 'RESOLVED', 'CLOSED')) DEFAULT 'OPEN',
        "resolution" text NULL,
        "partner_response" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_mkt_complaint_partner" ON "marketplace_complaint"(partner_id, status);
    `);

    // ── 5. Seed Core System Feature Flags ──
    console.log("5. Seeding default system feature flags...");
    const coreFlags = [
      {
        key: "PARTNER_MARKETPLACE",
        name: "Partner Commercial Marketplace",
        desc: "Enables independent vendor onboarding, catalog management, and partner order fulfillment.",
        category: "MARKETPLACE",
        enabled: true,
        mandatory: false,
      },
      {
        key: "SHARED_INVENTORY_POOL",
        name: "Shared Cake & Bouquet Inventory Pool",
        desc: "Centralizes cake and bouquet availability and reservations across branches and partners.",
        category: "INVENTORY",
        enabled: true,
        mandatory: true, // System mandatory safety feature
      },
      {
        key: "OPERATIONAL_CLOSURE_ENFORCEMENT",
        name: "Holiday & Operational Closure Enforcement",
        desc: "Enforces branch and partner closure schedules, blocking checkout for closed dates.",
        category: "OPERATIONS",
        enabled: true,
        mandatory: true,
      },
      {
        key: "PARTNER_INVOICE_RECONCILIATION",
        name: "Partner Invoice Receipt & Reconciliation",
        desc: "Permits partner invoice recording, Excel reconciliation statements, and Bills Payable linking.",
        category: "ACCOUNTING",
        enabled: true,
        mandatory: false,
      },
    ];

    for (const f of coreFlags) {
      await client.query(`
        INSERT INTO "feature_flag" (id, key, name, description, category, scope, entity_id, is_enabled, is_system_mandatory, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'GLOBAL', 'global', $6, $7, NOW(), NOW())
        ON CONFLICT (key, scope, entity_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_system_mandatory = EXCLUDED.is_system_mandatory,
          updated_at = NOW();
      `, [`ff_${f.key.toLowerCase()}_global`, f.key, f.name, f.desc, f.category, f.enabled, f.mandatory]);
    }

    // ── 6. Seed Shared Inventory for Cakes and Bouquets ──
    console.log("6. Seeding shared inventory from existing cake & bouquet catalog...");
    const prods = await client.query(`
      SELECT p.id as product_id, p.title, p.merchandise_type, COALESCE(pv.id, 'var_' || p.id) as variant_id
      FROM "product" p
      LEFT JOIN "product_variant" pv ON pv.product_id = p.id
      WHERE (p.merchandise_type IN ('CAKE', 'BOUQUET') OR p.title ILIKE '%cake%' OR p.title ILIKE '%bouquet%')
        AND p.deleted_at IS NULL;
    `);

    let seededCount = 0;
    for (const row of prods.rows) {
      const invId = `sinv_${row.product_id}_${row.variant_id}`.slice(0, 80);
      const mType = row.merchandise_type || (row.title.toLowerCase().includes('bouquet') ? 'BOUQUET' : 'CAKE');
      const seedQty = 50; // Initial operational stock pool
      await client.query(`
        INSERT INTO "shared_inventory" (id, product_id, variant_id, merchandise_type, title, quantity, reserved, safety_threshold, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 0, 5, NOW(), NOW())
        ON CONFLICT (product_id, variant_id) DO UPDATE SET
          title = EXCLUDED.title,
          merchandise_type = EXCLUDED.merchandise_type,
          updated_at = NOW();
      `, [invId, row.product_id, row.variant_id, mType, row.title, seedQty]);
      seededCount++;
    }
    console.log(`  Seeded ${seededCount} shared inventory products.`);

    await client.query("COMMIT;");
    console.log("\n==================================================================");
    console.log("MIGRATION COMPLETED SUCCESSFULLY (TRANSACTION COMMITTED)");
    console.log("==================================================================");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
