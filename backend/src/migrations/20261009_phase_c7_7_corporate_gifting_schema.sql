-- =============================================================================
-- CakeToHome ERP — Phase C7.7 Step 7A Database Migration
-- Corporate Gifting Batch & Recipient Schema Foundations
-- =============================================================================
-- 
-- ARCHITECTURAL INVARIANTS:
-- 1. One Master Corporate Invoice: The batch links to a single consolidated
--    corporate invoice (public.invoice). Individual recipients do NOT carry
--    independent invoice references, preventing duplicate billing.
-- 2. Audit & Duplicate Replay Defense: Customer + SHA-256 file hash unique index
--    prevents duplicate concurrent uploads of identical spreadsheets.
-- 3. Row-Level Identity & Traceability: Each recipient is bound to a deterministic
--    source row_number (UNIQUE within batch).
-- 4. Multi-Delivery Scheduling: Recipient records support individual delivery
--    dates, slots, addresses, and future linkage to public.order / public.delivery.
-- 5. Cost Centre Attribution: Optional linkage to public.cost_centre preserves
--    C7.6 multidimensional management accounting governance.
-- 6. Zero Historical Mutation: Migration is purely additive. CoA locked at 100 accounts.
-- =============================================================================

-- ─── 1. Table: public.corporate_gifting_batch ────────────────────────────────

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

-- ─── 2. Table: public.corporate_gifting_recipient ────────────────────────────

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

-- ─── 3. Indexes & Constraints ────────────────────────────────────────────────

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
