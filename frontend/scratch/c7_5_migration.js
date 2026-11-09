const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
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
  throw new Error("DATABASE_URL not found");
}

async function runMigration() {
  console.log('==================================================================');
  console.log('  CAKETOHOME ERP — PHASE C7.5 DATABASE MIGRATION');
  console.log('==================================================================\n');

  const pool = new Pool({ connectionString: getConnectionString() });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Extend teller_movement constraints for SAFE_DROP and SAFE_TO_TILL
    console.log('[1/4] Updating teller_movement check constraints...');
    await client.query(`
      ALTER TABLE public.teller_movement DROP CONSTRAINT IF EXISTS chk_teller_movement_type;
      ALTER TABLE public.teller_movement ADD CONSTRAINT chk_teller_movement_type
        CHECK (movement_type IN ('CASH_SALE', 'COD_HANDOVER', 'CUSTOMER_REFUND', 'EXPENSE_PAYMENT', 'BANK_DEPOSIT', 'ADJUSTMENT', 'SAFE_DROP', 'SAFE_TO_TILL'));

      ALTER TABLE public.teller_movement DROP CONSTRAINT IF EXISTS chk_teller_movement_direction_type;
      ALTER TABLE public.teller_movement ADD CONSTRAINT chk_teller_movement_direction_type
        CHECK (
          (movement_type = 'CASH_SALE' AND direction = 'IN') OR
          (movement_type = 'COD_HANDOVER' AND direction = 'IN') OR
          (movement_type = 'CUSTOMER_REFUND' AND direction = 'OUT') OR
          (movement_type = 'EXPENSE_PAYMENT' AND direction = 'OUT') OR
          (movement_type = 'BANK_DEPOSIT' AND direction = 'OUT') OR
          (movement_type = 'ADJUSTMENT' AND direction IN ('IN', 'OUT')) OR
          (movement_type = 'SAFE_DROP' AND direction = 'OUT') OR
          (movement_type = 'SAFE_TO_TILL' AND direction = 'IN')
        );
    `);

    // 2. Create branch_vault_movement immutable custody table
    console.log('[2/4] Creating public.branch_vault_movement table and triggers...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.branch_vault_movement (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
        direction VARCHAR(10) NOT NULL,
        movement_type VARCHAR(50) NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        source_id TEXT NOT NULL,
        teller_session_id TEXT REFERENCES public.teller_session(id) ON DELETE RESTRICT,
        teller_movement_id TEXT REFERENCES public.teller_movement(id) ON DELETE RESTRICT,
        performed_by TEXT NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
        witnessed_by TEXT REFERENCES public."user"(id) ON DELETE RESTRICT,
        narration TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT chk_vault_movement_amount CHECK (amount > 0.00),
        CONSTRAINT chk_vault_movement_direction CHECK (direction IN ('IN', 'OUT')),
        CONSTRAINT chk_vault_movement_direction_type CHECK (
          (movement_type = 'SAFE_DROP' AND direction = 'IN') OR
          (movement_type = 'VAULT_INITIAL_FLOAT' AND direction = 'IN') OR
          (movement_type = 'SAFE_TO_TILL' AND direction = 'OUT') OR
          (movement_type = 'BANK_DEPOSIT' AND direction = 'OUT') OR
          (movement_type = 'MANUAL_ADJUSTMENT' AND direction IN ('IN', 'OUT'))
        ),
        CONSTRAINT uq_branch_vault_movement_source UNIQUE (source_type, source_id)
      );

      CREATE INDEX IF NOT EXISTS idx_branch_vault_movement_branch ON public.branch_vault_movement(branch_id);
      CREATE INDEX IF NOT EXISTS idx_branch_vault_movement_created ON public.branch_vault_movement(created_at);
      CREATE INDEX IF NOT EXISTS idx_branch_vault_movement_session ON public.branch_vault_movement(teller_session_id);
      CREATE INDEX IF NOT EXISTS idx_branch_vault_movement_source ON public.branch_vault_movement(source_type, source_id);

      CREATE OR REPLACE FUNCTION fn_branch_vault_movement_immutability()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'branch_vault_movement records are immutable and cannot be modified'
            USING ERRCODE = '55000';
        ELSIF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'branch_vault_movement records are immutable and cannot be deleted'
            USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_branch_vault_movement_immutability ON public.branch_vault_movement;
      CREATE TRIGGER trg_branch_vault_movement_immutability
      BEFORE UPDATE OR DELETE ON public.branch_vault_movement
      FOR EACH ROW EXECUTE FUNCTION fn_branch_vault_movement_immutability();
    `);

    // 3. Create petty_cash_request lifecycle table
    console.log('[3/4] Creating public.petty_cash_request table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.petty_cash_request (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        request_number TEXT NOT NULL UNIQUE,
        branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
        request_type VARCHAR(30) NOT NULL,
        amount NUMERIC(14,2) NOT NULL,
        purpose TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        expense_category_id TEXT,
        tax_rate NUMERIC(5,2) DEFAULT 0.00,
        gst_amount NUMERIC(14,2) DEFAULT 0.00,
        net_expense_amount NUMERIC(14,2) NOT NULL,
        input_gst_account_code VARCHAR(10),
        expense_account_code VARCHAR(10),
        voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        payment_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        
        maker_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
        made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        checker_id TEXT REFERENCES public."user"(id) ON DELETE RESTRICT,
        checked_at TIMESTAMPTZ,
        checker_notes TEXT,
        
        disburser_id TEXT REFERENCES public."user"(id) ON DELETE RESTRICT,
        disbursed_at TIMESTAMPTZ,
        disburser_notes TEXT,
        bank_account_id TEXT REFERENCES public.bank_account(id) ON DELETE RESTRICT,
        
        receipt_reference TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT chk_petty_cash_amount CHECK (amount > 0.00),
        CONSTRAINT chk_petty_cash_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED')),
        CONSTRAINT chk_petty_cash_type CHECK (request_type IN ('INITIAL_FUNDING', 'EXPENSE_CLAIM', 'REIMBURSEMENT')),
        CONSTRAINT chk_petty_cash_sod_maker_checker CHECK (checker_id IS NULL OR maker_id <> checker_id),
        CONSTRAINT chk_petty_cash_sod_maker_disburser CHECK (disburser_id IS NULL OR maker_id <> disburser_id),
        CONSTRAINT chk_petty_cash_sod_checker_disburser CHECK (disburser_id IS NULL OR checker_id IS NULL OR checker_id <> disburser_id)
      );

      CREATE INDEX IF NOT EXISTS idx_petty_cash_branch ON public.petty_cash_request(branch_id);
      CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON public.petty_cash_request(status);
      CREATE INDEX IF NOT EXISTS idx_petty_cash_created ON public.petty_cash_request(created_at);
      CREATE INDEX IF NOT EXISTS idx_petty_cash_maker ON public.petty_cash_request(maker_id);
      CREATE INDEX IF NOT EXISTS idx_petty_cash_type ON public.petty_cash_request(request_type);
    `);

    // 4. Seed baseline branch limit configuration into branch.metadata
    console.log('[4/4] Seeding controlled baseline drawer and petty cash limits on branches...');
    const seedRes = await client.query(`
      UPDATE public.branch
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'max_drawer_cash_limit', CASE 
          WHEN name ILIKE '%hub%' OR name ILIKE '%central%' OR name ILIKE '%flagship%' OR name ILIKE '%head office%' THEN 50000.00
          ELSE 25000.00
        END,
        'petty_cash_imprest_limit', CASE
          WHEN name ILIKE '%hub%' OR name ILIKE '%central%' OR name ILIKE '%flagship%' OR name ILIKE '%head office%' THEN 15000.00
          ELSE 5000.00
        END
      )
      RETURNING id, name, metadata->'max_drawer_cash_limit' AS max_drawer, metadata->'petty_cash_imprest_limit' AS petty_limit;
    `);

    console.log(`Updated ${seedRes.rowCount} branches with controlled baseline limit configurations.`);

    await client.query('COMMIT');
    console.log('\n✓ Phase C7.5 Migration successfully completed and committed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed and rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
