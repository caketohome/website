-- CakeToHome — Phase 8.3 Database Index Optimization Migration
-- Version: 3.2.0
-- Purpose: Add high-throughput, composite and partial indexes for high-frequency queries
--          identified via pg_stat_statements and EXPLAIN ANALYZE forensic audit.

-- 1. Order Pagination & Recent Orders Index (Optimizes admin & storefront order listings)
-- Query: SELECT * FROM "order" WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1
CREATE INDEX IF NOT EXISTS idx_order_created_at_desc
ON public."order" (created_at DESC)
WHERE (deleted_at IS NULL);

-- 2. Customer Order History Composite Index (Eliminates in-memory sorting on customer account page)
-- Query: SELECT * FROM "order" WHERE customer_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_order_customer_created_at
ON public."order" (customer_id, created_at DESC)
WHERE (deleted_at IS NULL);

-- 3. Order Status & Lifecycle Composite Index (Optimizes kitchen, store manager & telecalling filters)
-- Query: SELECT * FROM "order" WHERE status = $1 AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_order_status_created_at
ON public."order" (status, created_at DESC)
WHERE (deleted_at IS NULL);

-- 4. Guest Customer Order Lookup Index (Optimizes public order status tracking by email)
-- Query: SELECT * FROM "order" WHERE email = $1 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_order_email_lookup
ON public."order" (email, created_at DESC)
WHERE (deleted_at IS NULL AND email IS NOT NULL);

-- 5. Delivery Slot Capacity & Availability Composite Index (Eliminates table scans on checkout delivery check)
-- Query: SELECT * FROM delivery WHERE delivery_date = $1 AND delivery_slot_id = ANY($2) AND delivery_status != 'cancelled'
CREATE INDEX IF NOT EXISTS idx_delivery_date_slot_status
ON public.delivery (delivery_date, delivery_slot_id, delivery_status)
WHERE (deleted_at IS NULL);

-- 6. Driver Active Capacity & Dispatch Composite Index (Enforces 3-order cap without table scan)
-- Query: SELECT * FROM delivery WHERE delivery_partner_id = $1 AND delivery_status = ANY($2)
CREATE INDEX IF NOT EXISTS idx_delivery_partner_status
ON public.delivery (delivery_partner_id, delivery_status)
WHERE (deleted_at IS NULL);

-- 7. Delivery Zone Branch Scoping Index (Strictly optimizes branch isolation and serviceability checks)
-- Query: SELECT * FROM delivery_zone WHERE branch_id = $1 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_delivery_zone_branch_serviceable
ON public.delivery_zone (branch_id, is_serviceable, priority DESC)
WHERE (deleted_at IS NULL);

-- 8. CMS Pages Ordering Index (Resolves #1 highest DB time query: 15 minutes cumulative)
-- Query: SELECT * FROM cms_page WHERE deleted_at IS NULL ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_cms_page_created_at_asc
ON public.cms_page (created_at ASC)
WHERE (deleted_at IS NULL);

-- 9. CMS Homepage Sections Order Index (Resolves #2 highest DB time query: 4.5 minutes cumulative)
-- Query: SELECT * FROM cms_homepage_section WHERE deleted_at IS NULL ORDER BY sort_order ASC
CREATE INDEX IF NOT EXISTS idx_cms_homepage_section_sort_order
ON public.cms_homepage_section (sort_order ASC)
WHERE (deleted_at IS NULL);

-- 10. Customer Phone Search Index (Optimizes OTP authentication & rider phone lookups)
-- Query: SELECT * FROM customer WHERE phone = $1 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_customer_phone
ON public.customer (phone)
WHERE (deleted_at IS NULL AND phone IS NOT NULL);

-- 11. Payment Transaction Order Reconciliation & Idempotency Indexes (Secures payment replay protection)
-- Query: SELECT * FROM payment_transaction WHERE order_id = $1 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_payment_transaction_order_id
ON public.payment_transaction (order_id)
WHERE (deleted_at IS NULL);

-- Query: SELECT * FROM payment_transaction WHERE idempotency_key = $1 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_payment_transaction_idempotency
ON public.payment_transaction (idempotency_key)
WHERE (deleted_at IS NULL AND idempotency_key IS NOT NULL);

-- 12. Order Status History Timeline Batched Index (Delivers pre-sorted timeline streams in batch queries)
-- Query: SELECT * FROM order_status_history WHERE order_id = ANY($1) AND deleted_at IS NULL ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
ON public.order_status_history (order_id, created_at ASC)
WHERE (deleted_at IS NULL);
