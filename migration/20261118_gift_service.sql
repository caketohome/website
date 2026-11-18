-- Surprise / gift services (e.g. greeting card, surprise video shoot) created by the team in the dashboard.
-- Customers pick them at checkout when sending a gift; paid ones are charged as order lines (with GST),
-- free ones are added at ₹0. Nothing is shown to customers until the team creates and activates one.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gift_service (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  price          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  gst_rate       NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_rate IN (0, 5, 12, 18, 28)),
  hsn_sac        TEXT NOT NULL DEFAULT '',
  needs_note     BOOLEAN NOT NULL DEFAULT false,
  note_label     TEXT NOT NULL DEFAULT '',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gift_service_active ON public.gift_service (display_order) WHERE deleted_at IS NULL AND is_active;
COMMIT;
