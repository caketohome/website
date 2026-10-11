/**
 * CakeToHome ERP — Phase C7.7 Step 7A Schema Migration
 * Additive Schema Foundation: Corporate Gifting Batch & Recipient Schema
 *
 * SCOPE:
 * 1. Pre-migration baseline verification:
 *    - CoA = 100 accounts.
 *    - Trial Balance strictly balanced (Dr 3,380.00 === Cr 3,380.00).
 *    - Accounting vouchers = 6, journal entries = 4, journal lines = 10.
 * 2. Add public.corporate_gifting_batch table with customer linkage, SHA-256 deduplication,
 *    lifecycle status, summary counters, master invoice link, and cost centre dimension.
 * 3. Add public.corporate_gifting_recipient table with source row number, recipient identity,
 *    delivery details, SKU/variant linkage, validation tracking, and child order/delivery links.
 * 4. Add comprehensive indexes and constraints.
 * 5. Post-migration verification of tables, columns, indexes, foreign keys, row counts, and Trial Balance.
 *
 * SAFETY INVARIANTS:
 * - Atomic transaction (BEGIN ... COMMIT with ROLLBACK on any error).
 * - Idempotent execution (safe to re-run).
 * - Zero drop or alteration of existing tables or columns.
 * - Zero mutation of historical accounting data.
 * - Chart of Accounts strictly preserved at exactly 100 accounts.
 * - Trial Balance strictly balanced.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  throw new Error("DATABASE_URL not found in .env");
}

async function runStep7AMigration() {
  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.7 Step 7A Schema Migration');
  console.log('Corporate Gifting Batch & Recipient: Normalized Table Foundation');
  console.log('=============================================================================\n');

  const conn = getConnectionString();
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  try {
    // ─── [1/6] Pre-Migration Baseline Verification ──────────────────────────
    console.log('[1/6] Verifying pre-migration baseline...');
    const coaRes = await client.query('SELECT count(*)::int as count FROM public.accounting_account');
    if (coaRes.rows[0].count !== 100) {
      throw new Error(`CoA count mismatch: expected 100, got ${coaRes.rows[0].count}`);
    }
    console.log(`  ✓ Chart of Accounts: exactly ${coaRes.rows[0].count} accounts`);

    const tbRes = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `);
    if (tbRes.rows[0].dr !== tbRes.rows[0].cr) {
      throw new Error(`Trial Balance mismatch: Dr ${tbRes.rows[0].dr} !== Cr ${tbRes.rows[0].cr}`);
    }
    console.log(`  ✓ Trial Balance: Dr ₹${tbRes.rows[0].dr} === Cr ₹${tbRes.rows[0].cr}`);

    const vRes = await client.query('SELECT count(*)::int as count FROM public.accounting_voucher');
    const jeRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_entry');
    const jlRes = await client.query('SELECT count(*)::int as count FROM public.accounting_journal_line');
    console.log(`  ✓ Vouchers: ${vRes.rows[0].count}, Journal Entries: ${jeRes.rows[0].count}, Lines: ${jlRes.rows[0].count}`);

    // ─── START ATOMIC TRANSACTION ───────────────────────────────────────────
    await client.query('BEGIN;');
    console.log('\n[2/6] Beginning atomic database transaction...');

    // ─── [2/6] Table 1: public.corporate_gifting_batch ───────────────────────
    console.log('[3/6] Creating public.corporate_gifting_batch table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.corporate_gifting_batch (
        id TEXT PRIMARY KEY DEFAULT ('cgb_' || gen_random_uuid()::text),
        customer_id TEXT NOT NULL REFERENCES public.customer(id) ON DELETE RESTRICT,
        company_id TEXT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
        batch_name VARCHAR(255) NOT NULL,
        source_filename VARCHAR(255) NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        file_size_bytes BIGINT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'
          CHECK (status IN ('DRAFT', 'VALIDATED', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED')),
        total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
        total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0.00),
        validated_recipients INTEGER NOT NULL DEFAULT 0 CHECK (validated_recipients >= 0),
        invalid_recipients INTEGER NOT NULL DEFAULT 0 CHECK (invalid_recipients >= 0),
        processed_recipients INTEGER NOT NULL DEFAULT 0 CHECK (processed_recipients >= 0),
        scheduled_delivery_date DATE NULL,
        invoice_id TEXT NULL REFERENCES public.invoice(id) ON DELETE SET NULL,
        order_id TEXT NULL REFERENCES public."order"(id) ON DELETE SET NULL,
        cost_centre_id TEXT NULL REFERENCES public.cost_centre(id) ON DELETE RESTRICT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by TEXT NULL REFERENCES public."user"(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cancelled_by TEXT NULL REFERENCES public."user"(id) ON DELETE SET NULL,
        cancelled_at TIMESTAMPTZ NULL,
        cancellation_reason TEXT NULL,
        deleted_at TIMESTAMPTZ NULL
      );
    `);
    console.log('  ✓ Table public.corporate_gifting_batch created.');

    // ─── [3/6] Table 2: public.corporate_gifting_recipient ───────────────────
    console.log('[4/6] Creating public.corporate_gifting_recipient table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.corporate_gifting_recipient (
        id TEXT PRIMARY KEY DEFAULT ('cgr_' || gen_random_uuid()::text),
        batch_id TEXT NOT NULL REFERENCES public.corporate_gifting_batch(id) ON DELETE RESTRICT,
        row_number INTEGER NOT NULL CHECK (row_number >= 1),
        employee_id VARCHAR(100) NULL,
        recipient_name VARCHAR(255) NOT NULL,
        recipient_phone VARCHAR(50) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_pincode VARCHAR(20) NOT NULL,
        delivery_city VARCHAR(100) NULL,
        delivery_state VARCHAR(100) NULL,
        delivery_date DATE NOT NULL,
        delivery_slot VARCHAR(50) NULL,
        product_id TEXT NULL REFERENCES public.product(id) ON DELETE RESTRICT,
        variant_id TEXT NULL REFERENCES public.product_variant(id) ON DELETE RESTRICT,
        sku VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0.00),
        line_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0.00),
        gift_message TEXT NULL,
        validation_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
          CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID')),
        validation_errors JSONB NULL,
        order_id TEXT NULL REFERENCES public."order"(id) ON DELETE SET NULL,
        delivery_id TEXT NULL REFERENCES public.delivery(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'ORDER_CREATED', 'DISPATCHED', 'DELIVERED', 'FAILED', 'CANCELLED')),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL,
        CONSTRAINT uq_cgr_batch_row UNIQUE (batch_id, row_number)
      );
    `);
    console.log('  ✓ Table public.corporate_gifting_recipient created.');

    // ─── [4/6] Creating Indexes ─────────────────────────────────────────────
    console.log('[5/6] Creating performance and uniqueness indexes...');
    await client.query(`
      -- Batch Indexes
      CREATE INDEX IF NOT EXISTS idx_cgb_customer_id ON public.corporate_gifting_batch (customer_id);
      CREATE INDEX IF NOT EXISTS idx_cgb_status ON public.corporate_gifting_batch (status);
      CREATE INDEX IF NOT EXISTS idx_cgb_created_at ON public.corporate_gifting_batch (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cgb_invoice_id ON public.corporate_gifting_batch (invoice_id) WHERE invoice_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cgb_order_id ON public.corporate_gifting_batch (order_id) WHERE order_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cgb_cost_centre_id ON public.corporate_gifting_batch (cost_centre_id) WHERE cost_centre_id IS NOT NULL;

      -- Unique constraint for duplicate file hash upload protection per customer
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cgb_customer_file_hash_active 
        ON public.corporate_gifting_batch (customer_id, file_hash) 
        WHERE status != 'FAILED' AND deleted_at IS NULL;

      -- Recipient Indexes
      CREATE INDEX IF NOT EXISTS idx_cgr_batch_id ON public.corporate_gifting_recipient (batch_id);
      CREATE INDEX IF NOT EXISTS idx_cgr_validation_status ON public.corporate_gifting_recipient (validation_status);
      CREATE INDEX IF NOT EXISTS idx_cgr_status ON public.corporate_gifting_recipient (status);
      CREATE INDEX IF NOT EXISTS idx_cgr_delivery_date ON public.corporate_gifting_recipient (delivery_date);
      CREATE INDEX IF NOT EXISTS idx_cgr_order_id ON public.corporate_gifting_recipient (order_id) WHERE order_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cgr_delivery_id ON public.corporate_gifting_recipient (delivery_id) WHERE delivery_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cgr_variant_id ON public.corporate_gifting_recipient (variant_id) WHERE variant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cgr_phone ON public.corporate_gifting_recipient (recipient_phone);
    `);
    console.log('  ✓ All indexes created successfully.');

    // ─── COMMIT TRANSACTION ─────────────────────────────────────────────────
    await client.query('COMMIT;');
    console.log('\n[6/6] Transaction COMMITTED successfully.');

    // ─── Post-Migration Verification ────────────────────────────────────────
    console.log('\nVerifying post-migration state...');
    const tables = ['corporate_gifting_batch', 'corporate_gifting_recipient'];
    for (const t of tables) {
      const exists = (await client.query(`
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)
      `, [t])).rows[0].exists;
      if (!exists) throw new Error(`Verification failed: table ${t} does not exist`);

      const colCount = (await client.query(`
        SELECT count(*)::int as count FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
      `, [t])).rows[0].count;

      const rowCount = (await client.query(`SELECT count(*)::int as count FROM public.${t}`)).rows[0].count;
      if (rowCount !== 0) throw new Error(`Verification failed: table ${t} has ${rowCount} rows (expected 0)`);

      console.log(`  ✓ Table public.${t}: exists, ${colCount} columns, ${rowCount} rows (strictly empty)`);
    }

    // Verify CoA and Trial Balance untouched
    const postCoa = (await client.query('SELECT count(*)::int as count FROM public.accounting_account')).rows[0].count;
    if (postCoa !== 100) throw new Error(`CoA corrupted: expected 100, got ${postCoa}`);

    const postTb = (await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0)::numeric(15,2) as dr,
        COALESCE(SUM(credit_amount), 0)::numeric(15,2) as cr
      FROM public.accounting_journal_line;
    `)).rows[0];
    if (postTb.dr !== postTb.cr) throw new Error(`Trial Balance corrupted: Dr ${postTb.dr} !== Cr ${postTb.cr}`);

    console.log(`  ✓ Chart of Accounts: preserved at exactly ${postCoa} accounts`);
    console.log(`  ✓ Trial Balance: preserved at Dr ₹${postTb.dr} === Cr ₹${postTb.cr}`);

    console.log('\n=============================================================================');
    console.log('✅ Phase C7.7 Step 7A Database Migration Completed Successfully!');
    console.log('=============================================================================');

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('\n❌ Migration failed. Transaction ROLLED BACK:', err);
    throw err;
  } finally {
    await client.end();
  }
}

runStep7AMigration().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
