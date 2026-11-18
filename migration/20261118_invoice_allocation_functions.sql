-- Fix: commit_invoice_allocation / void_invoice_allocation were never created on this database (the V2
-- numbering migration was only partly applied). Delivery invoicing, bills receivable and the invoice queue
-- call commit_invoice_allocation inside their transaction; the "function does not exist" error aborted the
-- whole invoice transaction, so no delivered order could be invoiced.
BEGIN;

ALTER TABLE public.invoice_allocation_log ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.invoice_allocation_log ADD COLUMN IF NOT EXISTS voided_reason TEXT;

CREATE OR REPLACE FUNCTION public.commit_invoice_allocation(p_order_id TEXT, p_invoice_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.invoice_allocation_log
     SET status = 'COMMITTED', invoice_id = p_invoice_id
   WHERE order_id = p_order_id AND status = 'ALLOCATED';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_invoice_allocation(p_order_id TEXT, p_reason TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.invoice_allocation_log
     SET status = 'VOIDED', voided_reason = p_reason
   WHERE order_id = p_order_id AND status = 'ALLOCATED';
  RETURN FOUND;
END;
$$;

COMMIT;
