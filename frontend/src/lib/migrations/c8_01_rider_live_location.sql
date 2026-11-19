-- Rider live location: one row per rider with their latest position while on duty.
CREATE TABLE IF NOT EXISTS public.delivery_partner_location (
  partner_id   text PRIMARY KEY REFERENCES public.delivery_partner(id) ON DELETE CASCADE,
  latitude     double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude    double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m   integer,
  heading      real,
  speed_mps    real,
  order_id     text,
  on_duty      boolean NOT NULL DEFAULT true,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_partner_location_recent_idx
  ON public.delivery_partner_location (on_duty, recorded_at DESC);
ALTER TABLE public.delivery_partner_location ENABLE ROW LEVEL SECURITY;
