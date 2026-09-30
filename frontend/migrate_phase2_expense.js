/**
 * CakeToHome ERP — Phase 2: Expense Module DB Migration
 *
 * WHY NOT analytics_expense:
 *  - amount is INTEGER (no decimal paise support)
 *  - category is free-text (no master table)
 *  - no status lifecycle, no GST columns, no supplier_id, no approval
 *  - 0 rows, 0 code consumers — safe to leave untouched
 *
 * This creates two new tables:
 *  - expense_category: configurable category master
 *  - expense: canonical operational expense record
 *
 * analytics_expense is NOT dropped or modified.
 */

const { Client } = require('./node_modules/pg');

const c = new Client({ connectionString: process.env.PG_URL, ssl: { rejectUnauthorized: false } });

const migration = `
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: Expense Module
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Expense Category Master (configurable)
CREATE TABLE IF NOT EXISTS public.expense_category (
  id            TEXT        NOT NULL PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT expense_category_name_check CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_expense_category_active
  ON public.expense_category (is_active)
  WHERE deleted_at IS NULL;

-- 2. Canonical Expense Record
CREATE TABLE IF NOT EXISTS public.expense (
  id                TEXT           NOT NULL PRIMARY KEY,
  branch_id         TEXT           NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  category_id       TEXT           REFERENCES public.expense_category(id) ON DELETE SET NULL,
  supplier_id       TEXT           REFERENCES public.supplier(id) ON DELETE SET NULL,
  expense_date      DATE           NOT NULL,
  reference_no      TEXT,
  description       TEXT           NOT NULL,
  subtotal          NUMERIC(14,2)  NOT NULL DEFAULT 0,
  discount          NUMERIC(14,2)  NOT NULL DEFAULT 0,
  taxable_value     NUMERIC(14,2)  NOT NULL DEFAULT 0,
  cgst              NUMERIC(14,2)  NOT NULL DEFAULT 0,
  sgst              NUMERIC(14,2)  NOT NULL DEFAULT 0,
  igst              NUMERIC(14,2)  NOT NULL DEFAULT 0,
  total             NUMERIC(14,2)  NOT NULL DEFAULT 0,
  payment_method    TEXT,
  notes             TEXT,
  status            TEXT           NOT NULL DEFAULT 'DRAFT',
  created_by        TEXT,
  approved_by       TEXT,
  posted_at         TIMESTAMPTZ,
  metadata          JSONB,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT expense_status_check CHECK (
    status = ANY(ARRAY['DRAFT','SUBMITTED','APPROVED','POSTED'])
  ),
  CONSTRAINT expense_payment_method_check CHECK (
    payment_method IS NULL OR payment_method = ANY(
      ARRAY['CASH','UPI','BANK_TRANSFER','CHEQUE','CARD','OTHER']
    )
  ),
  CONSTRAINT expense_total_positive CHECK (total >= 0),
  CONSTRAINT expense_taxable_positive CHECK (taxable_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_expense_branch_id
  ON public.expense (branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_date
  ON public.expense (expense_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_category_id
  ON public.expense (category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_status
  ON public.expense (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_supplier_id
  ON public.expense (supplier_id)
  WHERE supplier_id IS NOT NULL AND deleted_at IS NULL;

-- Seed default expense categories (idempotent — INSERT IF NOT EXISTS)
INSERT INTO public.expense_category (id, name, description, is_active, created_by, created_at, updated_at)
VALUES
  ('excat_rent',        'Rent',              'Shop/kitchen/office rental payments',               TRUE, 'system', NOW(), NOW()),
  ('excat_electricity', 'Electricity',       'Electricity and power bills',                        TRUE, 'system', NOW(), NOW()),
  ('excat_internet',    'Internet & Phone',  'Internet, broadband, and phone bills',               TRUE, 'system', NOW(), NOW()),
  ('excat_salaries',    'Salaries & Wages',  'Staff salaries, wages, and contractor payments',     TRUE, 'system', NOW(), NOW()),
  ('excat_marketing',   'Marketing',         'Advertising, promotions, and marketing expenses',    TRUE, 'system', NOW(), NOW()),
  ('excat_packaging',   'Packaging',         'Box, ribbon, wrapping, and packaging material',      TRUE, 'system', NOW(), NOW()),
  ('excat_maintenance', 'Maintenance',       'Equipment repair and maintenance',                   TRUE, 'system', NOW(), NOW()),
  ('excat_office',      'Office Supplies',   'Stationery, printing, and office consumables',       TRUE, 'system', NOW(), NOW()),
  ('excat_fuel',        'Fuel & Transport',  'Delivery fuel costs and local transport',            TRUE, 'system', NOW(), NOW()),
  ('excat_cleaning',    'Cleaning',          'Cleaning supplies and housekeeping',                 TRUE, 'system', NOW(), NOW()),
  ('excat_other',       'Other',             'Miscellaneous operating expenses',                   TRUE, 'system', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
`;

c.connect().then(async () => {
  try {
    console.log('Running Phase 2 expense migration...');
    await c.query(migration);
    console.log('Migration complete.');

    // Verify
    const tables = await c.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('expense','expense_category')
      ORDER BY table_name
    `);
    console.log('Tables created:', tables.rows.map(r => r.table_name).join(', '));

    const cats = await c.query('SELECT id, name FROM public.expense_category ORDER BY name');
    console.log(`Categories seeded: ${cats.rows.length}`);
    cats.rows.forEach(r => console.log(`  ${r.id}: ${r.name}`));

    const idx = await c.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename IN ('expense','expense_category')
      ORDER BY indexname
    `);
    console.log(`Indexes: ${idx.rows.length}`);
    idx.rows.forEach(r => console.log(`  ${r.indexname}`));

    await c.end();
    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e.message);
    await c.end();
    process.exit(1);
  }
}).catch(e => { console.error('Connect error:', e.message); process.exit(1); });
