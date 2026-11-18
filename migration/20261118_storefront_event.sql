-- Storefront behaviour events (page views, cake views, add-to-cart) so the team can see who browsed
-- or looked at a cake and left without buying ("browse abandonment"). Anonymous visitors are keyed by
-- a first-party visitor cookie; logged-in visitors also carry customer_id and phone.
BEGIN;
CREATE TABLE IF NOT EXISTS public.storefront_event (
  id           BIGSERIAL PRIMARY KEY,
  visitor_id   TEXT NOT NULL,
  customer_id  TEXT,
  phone        TEXT,
  event_type   TEXT NOT NULL CHECK (event_type IN ('page_view', 'product_view', 'add_to_cart', 'search')),
  product_id   TEXT,
  path         TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_storefront_event_created ON public.storefront_event (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefront_event_visitor ON public.storefront_event (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefront_event_customer ON public.storefront_event (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storefront_event_product ON public.storefront_event (product_id) WHERE product_id IS NOT NULL;
COMMIT;
