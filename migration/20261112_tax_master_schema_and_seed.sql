-- ============================================================================
-- CAKETOHOME ERP — AUTHORITATIVE TAX MASTER SCHEMA & SEED MIGRATION
-- Date: 2026-11-12
-- Target Database: PostgreSQL public schema (cth_rehearsal_phase5 / cth_test)
-- Architecture: Canonical @medusajs/tax relational tables + CakeToHome GST Master
-- ============================================================================

BEGIN;

-- 1. Canonical Tax Provider Table (@medusajs/tax Migration20240227090331)
CREATE TABLE IF NOT EXISTS public."tax_provider" (
  "id" text NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz NULL,
  CONSTRAINT "tax_provider_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IDX_tax_provider_deleted_at"
  ON public."tax_provider" ("deleted_at")
  WHERE deleted_at IS NULL;

-- 2. Canonical Tax Region Table (@medusajs/tax Migration20240227090331 + Migration20240710135844)
CREATE TABLE IF NOT EXISTS public."tax_region" (
  "id" text NOT NULL,
  "provider_id" text NULL,
  "country_code" text NOT NULL,
  "province_code" text NULL,
  "parent_id" text NULL,
  "metadata" jsonb NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text NULL,
  "deleted_at" timestamptz NULL,
  CONSTRAINT "tax_region_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CK_tax_region_country_top_level" CHECK (parent_id IS NULL OR province_code IS NOT NULL),
  CONSTRAINT "FK_tax_region_parent_id" FOREIGN KEY ("parent_id")
    REFERENCES public."tax_region" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "FK_tax_region_provider_id" FOREIGN KEY ("provider_id")
    REFERENCES public."tax_provider" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_tax_region_deleted_at"
  ON public."tax_region" ("deleted_at")
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_tax_region_parent_id"
  ON public."tax_region" ("parent_id");

CREATE INDEX IF NOT EXISTS "IDX_tax_region_provider_id"
  ON public."tax_region" ("provider_id")
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tax_region_unique_country_nullable_province"
  ON public."tax_region" ("country_code")
  WHERE province_code IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tax_region_unique_country_province"
  ON public."tax_region" ("country_code", "province_code")
  WHERE deleted_at IS NULL;

-- 3. Canonical Tax Rate Table (@medusajs/tax Migration20240227090331 + Migration20240924114005)
CREATE TABLE IF NOT EXISTS public."tax_rate" (
  "id" text NOT NULL,
  "rate" real NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "is_combinable" boolean NOT NULL DEFAULT false,
  "tax_region_id" text NOT NULL,
  "metadata" jsonb NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text NULL,
  "deleted_at" timestamptz NULL,
  CONSTRAINT "tax_rate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FK_tax_rate_tax_region_id" FOREIGN KEY ("tax_region_id")
    REFERENCES public."tax_region" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_tax_rate_tax_region_id"
  ON public."tax_rate" ("tax_region_id")
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_single_default_region"
  ON public."tax_rate" ("tax_region_id")
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_tax_rate_deleted_at"
  ON public."tax_rate" ("deleted_at")
  WHERE deleted_at IS NULL;

-- Enterprise Tax Master Code Uniqueness Constraint (Active non-deleted configurations)
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tax_rate_unique_code"
  ON public."tax_rate" (UPPER("code"))
  WHERE deleted_at IS NULL;

-- 4. Canonical Tax Rate Rule Table (@medusajs/tax Migration20240227090331 + Migration20241212052837)
CREATE TABLE IF NOT EXISTS public."tax_rate_rule" (
  "id" text NOT NULL,
  "tax_rate_id" text NOT NULL,
  "reference_id" text NOT NULL,
  "reference" text NOT NULL,
  "metadata" jsonb NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text NULL,
  "deleted_at" timestamptz NULL,
  CONSTRAINT "tax_rate_rule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FK_tax_rate_rule_tax_rate_id" FOREIGN KEY ("tax_rate_id")
    REFERENCES public."tax_rate" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_tax_rate_rule_tax_rate_id"
  ON public."tax_rate_rule" ("tax_rate_id")
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_tax_rate_rule_reference_id"
  ON public."tax_rate_rule" ("reference_id")
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tax_rate_rule_unique_rate_reference"
  ON public."tax_rate_rule" ("tax_rate_id", "reference_id")
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_tax_rate_rule_deleted_at"
  ON public."tax_rate_rule" ("deleted_at")
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. SEED AUTHORITATIVE SYSTEM TAX PROVIDER & INDIAN GST REGIONS
-- ============================================================================

INSERT INTO public."tax_provider" ("id", "is_enabled", "created_at", "updated_at")
VALUES ('tp_system', true, now(), now())
ON CONFLICT ("id") DO UPDATE SET
  "is_enabled" = true,
  "deleted_at" = NULL,
  "updated_at" = now();

-- Top-level India Tax Region (country_code = 'in', province_code = NULL)
INSERT INTO public."tax_region" (
  "id", "provider_id", "country_code", "province_code", "parent_id", "metadata", "created_at", "updated_at"
)
VALUES (
  'txreg_in',
  'tp_system',
  'in',
  NULL,
  NULL,
  '{"name": "India (All-India GST Jurisdiction)", "jurisdiction": "CBIC / GST Council India", "currency_code": "INR"}'::jsonb,
  now(),
  now()
)
ON CONFLICT ("id") DO UPDATE SET
  "provider_id" = EXCLUDED."provider_id",
  "country_code" = EXCLUDED."country_code",
  "metadata" = EXCLUDED."metadata",
  "deleted_at" = NULL,
  "updated_at" = now();

-- Kerala State Tax Region (State Code 32 — matches gst_kerala_primary in public.gst_registration)
INSERT INTO public."tax_region" (
  "id", "provider_id", "country_code", "province_code", "parent_id", "metadata", "created_at", "updated_at"
)
VALUES (
  'txreg_in_kl',
  'tp_system',
  'in',
  '32',
  'txreg_in',
  '{"name": "Kerala (State Code 32)", "state_name": "Kerala", "state_code": "32"}'::jsonb,
  now(),
  now()
)
ON CONFLICT ("id") DO UPDATE SET
  "provider_id" = EXCLUDED."provider_id",
  "parent_id" = EXCLUDED."parent_id",
  "metadata" = EXCLUDED."metadata",
  "deleted_at" = NULL,
  "updated_at" = now();

-- Karnataka State Tax Region (State Code 29 — matches gst_7bfaea77-ebc2-467f-ae0b-2290a1d47c80 in public.gst_registration)
INSERT INTO public."tax_region" (
  "id", "provider_id", "country_code", "province_code", "parent_id", "metadata", "created_at", "updated_at"
)
VALUES (
  'txreg_in_ka',
  'tp_system',
  'in',
  '29',
  'txreg_in',
  '{"name": "Karnataka (State Code 29)", "state_name": "Karnataka", "state_code": "29"}'::jsonb,
  now(),
  now()
)
ON CONFLICT ("id") DO UPDATE SET
  "provider_id" = EXCLUDED."provider_id",
  "parent_id" = EXCLUDED."parent_id",
  "metadata" = EXCLUDED."metadata",
  "deleted_at" = NULL,
  "updated_at" = now();

-- ============================================================================
-- 6. SEED AUTHORITATIVE CAKETOHOME REUSABLE TAX MASTER CONFIGURATIONS
-- ============================================================================

INSERT INTO public."tax_rate" (
  "id", "rate", "code", "name", "is_default", "is_combinable", "tax_region_id", "metadata", "created_at", "updated_at"
)
VALUES
  (
    'txcfg_food_5',
    5,
    'GST_FOOD_5',
    'GST 5% - Restaurant & Bakery Food',
    true,
    false,
    'txreg_in',
    '{"description": "Standard 5% GST for bakery and restaurant food items (HSN 1905)", "taxability": "Taxable", "cgst_rate": 2.5, "sgst_rate": 2.5, "igst_rate": 5, "cess_rate": 0, "tax_inclusive": true, "supply_type": "BOTH", "customer_type": "BOTH", "effective_from": "2026-04-01", "is_active": true}'::jsonb,
    now(),
    now()
  ),
  (
    'txcfg_food_12',
    12,
    'GST_FOOD_12',
    'GST 12% - Packaged Confectionery & Savories',
    false,
    false,
    'txreg_in',
    '{"description": "12% GST for specified packaged foods, savories, and gift packs", "taxability": "Taxable", "cgst_rate": 6, "sgst_rate": 6, "igst_rate": 12, "cess_rate": 0, "tax_inclusive": true, "supply_type": "BOTH", "customer_type": "BOTH", "effective_from": "2026-04-01", "is_active": true}'::jsonb,
    now(),
    now()
  ),
  (
    'txcfg_food_18',
    18,
    'GST_FOOD_18',
    'GST 18% - Premium Cakes, Pastries & Chocolates',
    false,
    false,
    'txreg_in',
    '{"description": "18% GST for pastries, cakes, chocolates, and catering services", "taxability": "Taxable", "cgst_rate": 9, "sgst_rate": 9, "igst_rate": 18, "cess_rate": 0, "tax_inclusive": true, "supply_type": "BOTH", "customer_type": "BOTH", "effective_from": "2026-04-01", "is_active": true}'::jsonb,
    now(),
    now()
  ),
  (
    'txcfg_exempt',
    0,
    'GST_EXEMPT',
    'GST Exempt (0%) - Unbranded / Essential Items',
    false,
    false,
    'txreg_in',
    '{"description": "Statutory GST exempt food items (0% CGST / SGST / IGST)", "taxability": "Exempt", "cgst_rate": 0, "sgst_rate": 0, "igst_rate": 0, "cess_rate": 0, "tax_inclusive": true, "supply_type": "BOTH", "customer_type": "BOTH", "effective_from": "2026-04-01", "is_active": true}'::jsonb,
    now(),
    now()
  ),
  (
    'txcfg_nil',
    0,
    'GST_NIL',
    'Nil Rated (0%) - Zero-Rated / Nil Supplies',
    false,
    false,
    'txreg_in',
    '{"description": "Nil-rated supplies carrying 0% GST tariff schedule rate", "taxability": "Nil Rated", "cgst_rate": 0, "sgst_rate": 0, "igst_rate": 0, "cess_rate": 0, "tax_inclusive": true, "supply_type": "BOTH", "customer_type": "BOTH", "effective_from": "2026-04-01", "is_active": true}'::jsonb,
    now(),
    now()
  ),
  (
    'txcfg_nongst',
    0,
    'NON_GST',
    'Non-GST Supply (0%) - Outside GST Scope',
    false,
    false,
    'txreg_in',
    '{"description": "Supplies outside the scope of Goods and Services Tax", "taxability": "Non-GST", "cgst_rate": 0, "sgst_rate": 0, "igst_rate": 0, "cess_rate": 0, "tax_inclusive": true, "supply_type": "BOTH", "customer_type": "BOTH", "effective_from": "2026-04-01", "is_active": true}'::jsonb,
    now(),
    now()
  )
ON CONFLICT ("id") DO UPDATE SET
  "rate" = EXCLUDED."rate",
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "tax_region_id" = EXCLUDED."tax_region_id",
  "metadata" = EXCLUDED."metadata",
  "deleted_at" = NULL,
  "updated_at" = now();

-- ============================================================================
-- 7. LINK ACTIVE PRODUCTS TO CANONICAL TAX_RATE_RULE RECORDS
-- ============================================================================

INSERT INTO public."tax_rate_rule" (
  "id", "tax_rate_id", "reference_id", "reference", "metadata", "created_at", "updated_at"
)
SELECT
  'txrule_' || p.id,
  CASE
    WHEN COALESCE(p.metadata->>'tax_configuration_id', '') IN ('txcfg_food_5', 'txcfg_food_12', 'txcfg_food_18', 'txcfg_exempt', 'txcfg_nil', 'txcfg_nongst')
      THEN p.metadata->>'tax_configuration_id'
    WHEN COALESCE(p.metadata->>'gst_rate', '') = '18' THEN 'txcfg_food_18'
    WHEN COALESCE(p.metadata->>'gst_rate', '') = '12' THEN 'txcfg_food_12'
    WHEN COALESCE(p.metadata->>'gst_rate', '') = '0'  THEN 'txcfg_exempt'
    ELSE 'txcfg_food_5'
  END,
  p.id,
  'product',
  jsonb_build_object('assigned_by', 'migration_20261112', 'hsn_code', COALESCE(p.hsn_code, p.metadata->>'hsn_code', '19059010')),
  now(),
  now()
FROM public."product" p
WHERE p.deleted_at IS NULL
ON CONFLICT ("tax_rate_id", "reference_id") WHERE deleted_at IS NULL
DO NOTHING;

COMMIT;
