-- Buyer GSTIN on tax invoices: a business customer (corporate) needs its GSTIN and legal name on the invoice
-- to claim input tax credit — for our own cakes and for cakes sold by marketplace partners.
BEGIN;

ALTER TABLE public.invoice
  ADD COLUMN IF NOT EXISTS customer_gstin TEXT,
  ADD COLUMN IF NOT EXISTS customer_legal_name TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_customer_gstin') THEN
    ALTER TABLE public.invoice ADD CONSTRAINT chk_invoice_customer_gstin
      CHECK (customer_gstin IS NULL OR customer_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_invoice_customer_gstin ON public.invoice(customer_gstin) WHERE customer_gstin IS NOT NULL;

COMMIT;
