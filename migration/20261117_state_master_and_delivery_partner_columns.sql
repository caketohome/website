-- 2026-11-17: State master table + delivery_partner profile columns
-- Fixes: `relation "state" does not exist` (StateRepository) and delivery partner
-- persistence failing on missing email/avatar_url/is_active/updated_at columns.
-- Additive + idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public."state" (
  id              text PRIMARY KEY,
  code            text NOT NULL,
  name            text NOT NULL,
  gst_state_code  text,
  country_id      text NOT NULL DEFAULT 'country_in',
  country_code    text NOT NULL DEFAULT 'IN',
  timezone        text NOT NULL DEFAULT 'Asia/Kolkata',
  currency        text NOT NULL DEFAULT 'INR',
  currency_symbol text NOT NULL DEFAULT '₹',
  is_active       boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  display_order   integer NOT NULL DEFAULT 10,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS state_code_live_uniq
  ON public."state" (code) WHERE deleted_at IS NULL;

ALTER TABLE public."state" ENABLE ROW LEVEL SECURITY;

-- Official GST state codes (CBIC). Ids follow StateRepository convention: state_<code>.
INSERT INTO public."state" (id, code, name, gst_state_code, display_order) VALUES
  ('state_jk', 'JK', 'Jammu and Kashmir', '01', 1),
  ('state_hp', 'HP', 'Himachal Pradesh', '02', 2),
  ('state_pb', 'PB', 'Punjab', '03', 3),
  ('state_ch', 'CH', 'Chandigarh', '04', 4),
  ('state_uk', 'UK', 'Uttarakhand', '05', 5),
  ('state_hr', 'HR', 'Haryana', '06', 6),
  ('state_dl', 'DL', 'Delhi', '07', 7),
  ('state_rj', 'RJ', 'Rajasthan', '08', 8),
  ('state_up', 'UP', 'Uttar Pradesh', '09', 9),
  ('state_br', 'BR', 'Bihar', '10', 10),
  ('state_sk', 'SK', 'Sikkim', '11', 11),
  ('state_ar', 'AR', 'Arunachal Pradesh', '12', 12),
  ('state_nl', 'NL', 'Nagaland', '13', 13),
  ('state_mn', 'MN', 'Manipur', '14', 14),
  ('state_mz', 'MZ', 'Mizoram', '15', 15),
  ('state_tr', 'TR', 'Tripura', '16', 16),
  ('state_ml', 'ML', 'Meghalaya', '17', 17),
  ('state_as', 'AS', 'Assam', '18', 18),
  ('state_wb', 'WB', 'West Bengal', '19', 19),
  ('state_jh', 'JH', 'Jharkhand', '20', 20),
  ('state_od', 'OD', 'Odisha', '21', 21),
  ('state_cg', 'CG', 'Chhattisgarh', '22', 22),
  ('state_mp', 'MP', 'Madhya Pradesh', '23', 23),
  ('state_gj', 'GJ', 'Gujarat', '24', 24),
  ('state_dn', 'DN', 'Dadra and Nagar Haveli and Daman and Diu', '26', 26),
  ('state_mh', 'MH', 'Maharashtra', '27', 27),
  ('state_ka', 'KA', 'Karnataka', '29', 29),
  ('state_ga', 'GA', 'Goa', '30', 30),
  ('state_ld', 'LD', 'Lakshadweep', '31', 31),
  ('state_kl', 'KL', 'Kerala', '32', 32),
  ('state_tn', 'TN', 'Tamil Nadu', '33', 33),
  ('state_py', 'PY', 'Puducherry', '34', 34),
  ('state_an', 'AN', 'Andaman and Nicobar Islands', '35', 35),
  ('state_ts', 'TS', 'Telangana', '36', 36),
  ('state_ap', 'AP', 'Andhra Pradesh', '37', 37),
  ('state_la', 'LA', 'Ladakh', '38', 38)
ON CONFLICT (id) DO NOTHING;

-- delivery_partner: columns persistDeliveryPartnerToDb already writes, plus full profile JSON
ALTER TABLE public.delivery_partner ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.delivery_partner ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.delivery_partner ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.delivery_partner ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.delivery_partner ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
