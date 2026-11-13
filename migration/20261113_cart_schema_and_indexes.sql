-- ============================================================================
-- CAKETOHOME — P0 COMMERCE INCIDENT: CART & CART_LINE_ITEM SCHEMA MIGRATION
-- File: migration/20261113_cart_schema_and_indexes.sql
-- Purpose: Ensure authoritative PostgreSQL persistence tables `public.cart`
--          and `public.cart_line_item` exist with full constraints, indexes,
--          and permissions across all active CakeToHome databases.
-- ============================================================================

BEGIN;

-- 1. Create `public.cart` table if not exists
CREATE TABLE IF NOT EXISTS public.cart (
    id TEXT PRIMARY KEY,
    region_id TEXT,
    customer_id TEXT,
    sales_channel_id TEXT,
    email TEXT,
    customer_email TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    currency_code TEXT NOT NULL DEFAULT 'INR',
    branch_id TEXT,
    coupon_code TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ensure all columns exist on `public.cart` in case of partial schema
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS region_id TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS sales_channel_id TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.cart ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes for `public.cart`
CREATE INDEX IF NOT EXISTS idx_cart_customer ON public.cart USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_customer_id ON public.cart USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_customer_status ON public.cart USING btree (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_cart_status ON public.cart USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cart_updated ON public.cart USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_updated_at ON public.cart USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_abandoned_lookup ON public.cart USING btree (status, updated_at DESC)
    WHERE (status = ANY (ARRAY['ACTIVE'::text, 'ABANDONED'::text]));

-- 2. Create `public.cart_line_item` table if not exists
CREATE TABLE IF NOT EXISTS public.cart_line_item (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL REFERENCES public.cart(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_title TEXT,
    variant_id TEXT,
    title TEXT NOT NULL,
    thumbnail TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    weight TEXT,
    flavour TEXT,
    shape TEXT,
    cake_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    selected_addons JSONB DEFAULT '[]'::jsonb,
    selected_addons_detail JSONB DEFAULT '[]'::jsonb,
    greeting_card_text TEXT,
    photo_cake BOOLEAN DEFAULT false,
    sugar_free BOOLEAN DEFAULT false,
    gluten_free BOOLEAN DEFAULT false,
    vegan BOOLEAN DEFAULT false,
    addons_unit_total NUMERIC(12,2) DEFAULT 0,
    raw_unit_price JSONB DEFAULT '{"value": "0", "precision": 20}'::jsonb,
    is_tax_inclusive BOOLEAN NOT NULL DEFAULT true,
    compare_at_unit_price NUMERIC,
    raw_compare_at_unit_price JSONB,
    is_custom_price BOOLEAN NOT NULL DEFAULT false,
    requires_shipping BOOLEAN NOT NULL DEFAULT true,
    is_discountable BOOLEAN NOT NULL DEFAULT true,
    is_giftcard BOOLEAN NOT NULL DEFAULT false
);

-- Ensure all columns exist on `public.cart_line_item` in case of partial schema
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS product_title TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS variant_id TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS flavour TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS shape TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS cake_message TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS selected_addons_detail JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS greeting_card_text TEXT;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS photo_cake BOOLEAN DEFAULT false;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS sugar_free BOOLEAN DEFAULT false;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS gluten_free BOOLEAN DEFAULT false;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS vegan BOOLEAN DEFAULT false;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS addons_unit_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS raw_unit_price JSONB DEFAULT '{"value": "0", "precision": 20}'::jsonb;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS compare_at_unit_price NUMERIC;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS raw_compare_at_unit_price JSONB;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS is_custom_price BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS is_discountable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.cart_line_item ADD COLUMN IF NOT EXISTS is_giftcard BOOLEAN NOT NULL DEFAULT false;

-- Indexes for `public.cart_line_item`
CREATE INDEX IF NOT EXISTS idx_cart_item_cart ON public.cart_line_item USING btree (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_line_item_cart_id ON public.cart_line_item USING btree (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_line_item_product ON public.cart_line_item USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_cart_line_item_product_id ON public.cart_line_item USING btree (product_id);

-- 3. Grant privileges to application database roles
GRANT ALL PRIVILEGES ON TABLE public.cart TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE public.cart_line_item TO PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cth_test_user') THEN
        EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.cart TO cth_test_user';
        EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.cart_line_item TO cth_test_user';
    END IF;
END
$$;

COMMIT;
