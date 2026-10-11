/**
 * CakeToHome ERP — Phase C5: Expense Accounting Migration
 *
 * Implements Step C5.1 of the locked C5 architecture:
 * 1. Inspects live CoA dynamically (resolves accounts by authoritative code).
 * 2. Adds GL mapping columns (gl_account_id, gl_account_code) to public.expense_category.
 * 3. Pre-populates the 11 default categories with their authoritative CoA leaf accounts.
 * 4. Adds accounting linkage columns to public.expense:
 *    - voucher_id (FK to public.accounting_voucher)
 *    - bank_account_id (FK to public.bank_account)
 *    - teller_session_id (FK to public.teller_session)
 *    - company_id (FK to public.company)
 *    - settlement_type (DIRECT_PAYMENT | CREDIT_ACCRUAL)
 *    - itc_eligibility (ITC_ELIGIBLE | ITC_INELIGIBLE)
 *    - rcm_applicable (BOOLEAN)
 *    - hsn_sac_code (TEXT)
 *    - vendor_gstin (TEXT)
 *    - reversal_voucher_id (FK to public.accounting_voucher)
 *    - reversed_at, reversed_by, reversal_reason
 * 5. Updates status constraint to include REVERSED and CANCELLED.
 * 6. Creates foreign key and lookup indexes.
 *
 * Safe transaction: ROLLBACK on any failure.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('./node_modules/pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '.env');
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
  throw new Error("DATABASE_URL not found in .env");
}

const CATEGORY_COA_MAP = {
  excat_rent: '5210',         // Store & Kitchen Rent
  excat_electricity: '5220',  // Electricity, Gas & Utilities
  excat_internet: '5280',     // Software, Internet & Tech Infrastructure
  excat_salaries: '5250',     // Staff Salaries & Store Personnel
  excat_marketing: '5260',    // Marketing & Customer Promotion
  excat_packaging: '5130',    // Packaging Materials Consumed
  excat_maintenance: '5270',  // Repairs & Kitchen Maintenance
  excat_office: '5299',       // Miscellaneous Operating Expenses
  excat_fuel: '5230',         // Vehicle Fuel & Fleet Maintenance
  excat_cleaning: '5299',     // Miscellaneous Operating Expenses
  excat_other: '5299',        // Miscellaneous Operating Expenses
};

async function migrate() {
  const client = new Client({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== PHASE C5.1: EXPENSE ACCOUNTING SCHEMA MIGRATION ===");

  try {
    await client.query("BEGIN;");

    // 1. Inspect live CoA to resolve code -> id
    console.log("1. Resolving authoritative Chart of Accounts mapping...");
    const coaRes = await client.query(`
      SELECT id, code, name, type, subtype, is_group 
      FROM public.accounting_account 
      WHERE deleted_at IS NULL;
    `);
    console.log(`Live CoA contains ${coaRes.rows.length} accounts.`);

    const codeToAccountMap = new Map();
    for (const acc of coaRes.rows) {
      codeToAccountMap.set(acc.code, acc);
    }

    // Verify all required accounts exist
    const requiredCodes = ['5210', '5220', '5280', '5250', '5260', '5130', '5270', '5299', '5230', '1111', '1112', '1114', '2111', '2152', '2153'];
    for (const code of requiredCodes) {
      if (!codeToAccountMap.has(code)) {
        throw new Error(`Required CoA account '${code}' not found in live database!`);
      }
    }

    // 2. Add columns to public.expense_category
    console.log("2. Updating public.expense_category schema...");
    await client.query(`
      ALTER TABLE public.expense_category
        ADD COLUMN IF NOT EXISTS gl_account_id TEXT REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS gl_account_code VARCHAR(10);
    `);

    // 3. Pre-populate default category GL mappings
    console.log("3. Mapping default expense categories to CoA accounts...");
    for (const [catId, code] of Object.entries(CATEGORY_COA_MAP)) {
      const acc = codeToAccountMap.get(code);
      if (acc) {
        await client.query(`
          UPDATE public.expense_category
          SET gl_account_id = $1, gl_account_code = $2, updated_at = NOW()
          WHERE id = $3 AND (gl_account_id IS NULL OR gl_account_code IS NULL);
        `, [acc.id, acc.code, catId]);
      }
    }

    // 4. Add columns to public.expense
    console.log("4. Updating public.expense schema...");
    await client.query(`
      ALTER TABLE public.expense
        ADD COLUMN IF NOT EXISTS voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS bank_account_id TEXT REFERENCES public.bank_account(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS teller_session_id TEXT REFERENCES public.teller_session(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES public.company(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS settlement_type VARCHAR(20) NOT NULL DEFAULT 'DIRECT_PAYMENT',
        ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(20) NOT NULL DEFAULT 'ITC_ELIGIBLE',
        ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT,
        ADD COLUMN IF NOT EXISTS vendor_gstin TEXT,
        ADD COLUMN IF NOT EXISTS reversal_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reversed_by TEXT,
        ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
    `);

    // Update constraints on public.expense
    console.log("5. Updating constraints on public.expense...");
    await client.query(`
      ALTER TABLE public.expense DROP CONSTRAINT IF EXISTS expense_status_check;
      ALTER TABLE public.expense ADD CONSTRAINT expense_status_check CHECK (
        status = ANY(ARRAY['DRAFT','SUBMITTED','APPROVED','POSTED','REVERSED','CANCELLED'])
      );

      ALTER TABLE public.expense DROP CONSTRAINT IF EXISTS expense_settlement_type_check;
      ALTER TABLE public.expense ADD CONSTRAINT expense_settlement_type_check CHECK (
        settlement_type = ANY(ARRAY['DIRECT_PAYMENT','CREDIT_ACCRUAL'])
      );

      ALTER TABLE public.expense DROP CONSTRAINT IF EXISTS expense_itc_eligibility_check;
      ALTER TABLE public.expense ADD CONSTRAINT expense_itc_eligibility_check CHECK (
        itc_eligibility = ANY(ARRAY['ITC_ELIGIBLE','ITC_INELIGIBLE'])
      );
    `);

    // 6. Create Indexes
    console.log("6. Creating performance & foreign key indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_expense_voucher_id
        ON public.expense (voucher_id)
        WHERE voucher_id IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_expense_reversal_voucher_id
        ON public.expense (reversal_voucher_id)
        WHERE reversal_voucher_id IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_expense_teller_session_id
        ON public.expense (teller_session_id)
        WHERE teller_session_id IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_expense_bank_account_id
        ON public.expense (bank_account_id)
        WHERE bank_account_id IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_expense_settlement_type
        ON public.expense (settlement_type)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_expense_category_gl_account_id
        ON public.expense_category (gl_account_id)
        WHERE gl_account_id IS NOT NULL AND deleted_at IS NULL;
    `);

    await client.query("COMMIT;");
    console.log("=== PHASE C5.1 MIGRATION SUCCESSFUL ===");

    // Verify updated schema
    const catCheck = await client.query(`
      SELECT id, name, gl_account_code, gl_account_id FROM public.expense_category ORDER BY id;
    `);
    console.log(`\nVerified Categories (${catCheck.rows.length}):`);
    catCheck.rows.forEach(r => console.log(`  ${r.id.padEnd(20)} | ${r.name.padEnd(20)} | GL: ${r.gl_account_code} (${r.gl_account_id})`));

    const expCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'expense'
      ORDER BY ordinal_position;
    `);
    console.log(`\nVerified Expense Columns: ${expCols.rows.length} total.`);

    await client.end();
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed, transaction rolled back:", err);
    await client.end();
    process.exit(1);
  }
}

migrate();
