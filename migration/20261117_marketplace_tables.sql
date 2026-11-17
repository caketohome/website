-- Partner Marketplace tables (fixes: relation "marketplace_partner" does not exist)
-- Columns mirror marketplace-partner.repository.ts / marketplace-invoice.repository.ts.

CREATE TABLE IF NOT EXISTS public.marketplace_partner (
  id            text PRIMARY KEY,
  code          text NOT NULL,
  legal_name    text NOT NULL,
  trade_name    text NOT NULL,
  gstin         text,
  pan           text,
  status        text NOT NULL DEFAULT 'PENDING_APPROVAL'
                CHECK (status IN ('PENDING_APPROVAL','APPROVED','ACTIVE','SUSPENDED','TERMINATED')),
  contact_name  text,
  email         text NOT NULL,
  phone         text NOT NULL,
  address       jsonb,
  city_id       text,
  state_code    text,
  bank_details  jsonb,
  agreement_id  text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_partner_code_live_uniq ON public.marketplace_partner (code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.marketplace_store (
  id                 text PRIMARY KEY,
  partner_id         text NOT NULL REFERENCES public.marketplace_partner(id),
  name               text NOT NULL,
  code               text NOT NULL,
  is_open            boolean NOT NULL DEFAULT true,
  address            text,
  latitude           numeric(10,7),
  longitude          numeric(10,7),
  service_radius_km  numeric(6,2) NOT NULL DEFAULT 10,
  metadata           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS marketplace_store_partner_idx ON public.marketplace_store (partner_id);

CREATE TABLE IF NOT EXISTS public.marketplace_agreement (
  id                     text PRIMARY KEY,
  partner_id             text NOT NULL REFERENCES public.marketplace_partner(id),
  agreement_type         text NOT NULL CHECK (agreement_type IN ('COMMISSION_PERCENTAGE','FIXED_PER_ORDER','WHOLESALE_TRANSFER','HYBRID')),
  commission_rate        numeric(7,4) NOT NULL DEFAULT 0,
  fixed_fee_per_order    numeric(12,2) NOT NULL DEFAULT 0,
  delivery_subsidy_rate  numeric(7,4) NOT NULL DEFAULT 0,
  effective_from         date NOT NULL,
  effective_to           date,
  status                 text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','EXPIRED','SUPERSEDED')),
  terms_document_ref     text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_agreement_partner_idx ON public.marketplace_agreement (partner_id, status);

CREATE TABLE IF NOT EXISTS public.marketplace_order_snapshot (
  id                      text PRIMARY KEY,
  order_id                text NOT NULL UNIQUE,
  partner_id              text NOT NULL REFERENCES public.marketplace_partner(id),
  store_id                text,
  agreement_id            text,
  agreement_type          text,
  commission_rate         numeric(7,4) NOT NULL DEFAULT 0,
  fixed_fee               numeric(12,2) NOT NULL DEFAULT 0,
  gross_order_amount      numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount              numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount       numeric(12,2) NOT NULL DEFAULT 0,
  partner_net_receivable  numeric(12,2) NOT NULL DEFAULT 0,
  snapshot_data           jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_order_snapshot_partner_idx ON public.marketplace_order_snapshot (partner_id);

CREATE TABLE IF NOT EXISTS public.marketplace_complaint (
  id                text PRIMARY KEY,
  order_id          text NOT NULL,
  partner_id        text NOT NULL REFERENCES public.marketplace_partner(id),
  customer_id       text,
  category          text NOT NULL,
  description       text NOT NULL,
  status            text NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','INVESTIGATING','ESCALATED_TO_PARTNER','RESOLVED','CLOSED')),
  resolution        text,
  partner_response  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_complaint_partner_idx ON public.marketplace_complaint (partner_id);

CREATE TABLE IF NOT EXISTS public.marketplace_partner_invoice (
  id                             text PRIMARY KEY,
  partner_id                     text NOT NULL REFERENCES public.marketplace_partner(id),
  partner_invoice_number         text NOT NULL,
  partner_invoice_date           date NOT NULL,
  period_start                   date NOT NULL,
  period_end                     date NOT NULL,
  claimed_amount                 numeric(14,2) NOT NULL DEFAULT 0,
  calculated_amount              numeric(14,2) NOT NULL DEFAULT 0,
  discrepancy_amount             numeric(14,2) NOT NULL DEFAULT 0,
  document_reference             text,
  status                         text NOT NULL DEFAULT 'RECEIVED'
                                 CHECK (status IN ('RECEIVED','UNDER_REVIEW','DISCREPANCY_DETECTED','RECONCILED','APPROVED','REJECTED','POSTED_TO_BILLS_PAYABLE','SETTLED')),
  accounting_voucher_id          text,
  reconciliation_statement_json  jsonb,
  reconciled_by                  text,
  reconciled_at                  timestamptz,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_partner_invoice_number_uniq
  ON public.marketplace_partner_invoice (partner_id, upper(partner_invoice_number));

ALTER TABLE public.marketplace_partner         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_store           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_agreement       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_snapshot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_complaint       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_partner_invoice ENABLE ROW LEVEL SECURITY;
