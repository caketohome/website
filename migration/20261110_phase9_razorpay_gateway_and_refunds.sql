-- Phase 9 Migration: Razorpay Payment Gateway, Webhook Logs, Refund Management & Accounting Accounts
-- Date: 2026-11-10

-- 1. Payment Gateway Configuration Table (AES-256-GCM encrypted envelope storage)
CREATE TABLE IF NOT EXISTS public.payment_gateway_config (
  id TEXT PRIMARY KEY DEFAULT ('pgc_' || gen_random_uuid()),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  environment TEXT NOT NULL DEFAULT 'TEST', -- 'TEST' or 'LIVE'
  key_id TEXT NOT NULL,
  key_secret_enc TEXT NOT NULL, -- versioned envelope: v1$iv$authTag$cipher
  webhook_secret_enc TEXT, -- versioned envelope: v1$iv$authTag$cipher
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMPTZ,
  last_test_result JSONB,
  created_by TEXT DEFAULT 'admin_system',
  updated_by TEXT DEFAULT 'admin_system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_payment_gateway_provider_env UNIQUE (provider, environment)
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_provider ON public.payment_gateway_config(provider, is_active);

-- 2. Webhook Event Log Table (90-day retention, idempotency, statutory hold)
CREATE TABLE IF NOT EXISTS public.payment_webhook_log (
  id TEXT PRIMARY KEY DEFAULT ('whlog_' || gen_random_uuid()),
  event_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status TEXT NOT NULL, -- 'processed', 'ignored_duplicate', 'failed'
  processing_attempts INT NOT NULL DEFAULT 1,
  last_error_category TEXT,
  order_id TEXT,
  payment_id TEXT,
  payload_hash TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  is_statutory_hold BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_webhook_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_received_at ON public.payment_webhook_log(received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_order_id ON public.payment_webhook_log(order_id);

-- 3. Controlled Refund Management Table
CREATE TABLE IF NOT EXISTS public.payment_refund (
  id TEXT PRIMARY KEY DEFAULT ('ref_' || gen_random_uuid()),
  order_id TEXT NOT NULL REFERENCES public.order(id),
  payment_transaction_id TEXT NOT NULL REFERENCES public.payment_transaction(id),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_refund_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  reason_code TEXT NOT NULL,
  reason_explanation TEXT,
  requested_by TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated', 'processed', 'failed'
  accounting_voucher_id TEXT,
  gst_credit_note_id TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_refund_idempotency UNIQUE (payment_transaction_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_refund_order_id ON public.payment_refund(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_payment_transaction_id ON public.payment_refund(payment_transaction_id);

-- 4. Chart of Accounts: Subledger Accounts 1020 (Razorpay Clearing) & 5020 (Payment Gateway Charges)
INSERT INTO public.accounting_account (id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active, description, created_by, created_at, updated_at)
SELECT 
  gen_random_uuid()::text, 
  '1020', 
  'Razorpay Clearing Account', 
  'ASSET', 
  'GATEWAY_CLEARING', 
  (SELECT id FROM public.accounting_account WHERE code = '1110' LIMIT 1), 
  2, 
  false, 
  true, 
  true, 
  'Dedicated clearing account for Razorpay payment settlements', 
  'system_migration', 
  NOW(), 
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_account WHERE code = '1020');

INSERT INTO public.accounting_account (id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active, description, created_by, created_at, updated_at)
SELECT 
  gen_random_uuid()::text, 
  '5020', 
  'Payment Gateway Charges', 
  'EXPENSE', 
  'OPERATING_EXPENSE', 
  (SELECT id FROM public.accounting_account WHERE code = '5200' LIMIT 1), 
  2, 
  false, 
  true, 
  true, 
  'Merchant discount rate (MDR) and gateway processing fees', 
  'system_migration', 
  NOW(), 
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_account WHERE code = '5020');

