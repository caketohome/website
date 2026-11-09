-- ==============================================================================
-- CAKETOHOME: Automatic Payment Verification, Synchronization & Order Confirmation
-- Migration: 20261103_payment_verification_and_sync.sql
-- Target: PostgreSQL 14+ (cth_rehearsal_phase5_7 / Production)
-- ==============================================================================

BEGIN;

-- 1. Enhance payment_transaction table with gateway identifiers, refund tracking and error logs
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'gateway_order_id') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN gateway_order_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'gateway_payment_id') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN gateway_payment_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'gateway_signature') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN gateway_signature text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'failure_reason') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN failure_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'error_code') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN error_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'refund_id') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN refund_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_transaction' AND column_name = 'metadata') THEN
    ALTER TABLE public.payment_transaction ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_txn_order_id ON public.payment_transaction (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_gateway_pay_id ON public.payment_transaction (provider, gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_provider_ref ON public.payment_transaction (provider, provider_ref);
CREATE INDEX IF NOT EXISTS idx_payment_txn_idempotency_key ON public.payment_transaction (idempotency_key);

-- 2. Create payment_webhook_event for strict webhook idempotency, replay protection & audit trail
CREATE TABLE IF NOT EXISTS public.payment_webhook_event (
  id text PRIMARY KEY,
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_payment_id text,
  provider_order_id text,
  order_id text,
  amount numeric,
  currency text DEFAULT 'INR',
  signature text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb,
  status text NOT NULL, -- 'received', 'processed', 'ignored_duplicate', 'failed', 'rejected_signature', 'rejected_mismatch', 'payment_exception'
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwe_event_id ON public.payment_webhook_event (event_id);
CREATE INDEX IF NOT EXISTS idx_pwe_order_id ON public.payment_webhook_event (order_id);
CREATE INDEX IF NOT EXISTS idx_pwe_provider_payment_id ON public.payment_webhook_event (provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_pwe_status ON public.payment_webhook_event (status);

-- 3. Create customer_notification_queue for automated customer notifications
CREATE TABLE IF NOT EXISTS public.customer_notification_queue (
  id text PRIMARY KEY,
  order_id text NOT NULL,
  customer_id text,
  channel text NOT NULL, -- 'sms', 'email', 'whatsapp'
  recipient text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued', -- 'queued', 'sent', 'failed'
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnq_order_id ON public.customer_notification_queue (order_id);
CREATE INDEX IF NOT EXISTS idx_cnq_status ON public.customer_notification_queue (status);

COMMIT;

