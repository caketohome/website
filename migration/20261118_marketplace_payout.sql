-- Marketplace partner payouts (commission model). One row per partner payout statement.
-- Figures are taken from posted journal lines (2112 / 4150 / commission GST / 2131 / 2130-194O),
-- so a payout always equals what the books say the partner is owed for those orders.
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_payout (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES public.marketplace_partner(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_count INTEGER NOT NULL DEFAULT 0,
  partner_sales_gross NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_gst NUMERIC(15,2) NOT NULL DEFAULT 0,
  tcs_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tds_194o_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PAID', 'CANCELLED')),
  payment_voucher_id TEXT REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  payment_method TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  created_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payout_period CHECK (period_end >= period_start),
  CONSTRAINT chk_payout_net_nonneg CHECK (net_payable >= 0)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_payout_partner ON public.marketplace_payout(partner_id, period_start);
CREATE INDEX IF NOT EXISTS idx_marketplace_payout_status ON public.marketplace_payout(status);

COMMIT;
