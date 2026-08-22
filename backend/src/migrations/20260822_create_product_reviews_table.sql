-- CakeToHome PostgreSQL Migration: Canonical Product Reviews Table
-- Authoritative schema for verified product reviews and ratings linked to customer_uid, order_id, order_item_id, and product_id.

CREATE TABLE IF NOT EXISTS product_reviews (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64),
  customer_uid VARCHAR(128) NOT NULL,
  customer_name VARCHAR(255),
  order_id VARCHAR(64),
  order_item_id VARCHAR(64),
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  body TEXT,
  review_text TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'approved',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_variant VARCHAR(128),
  reply TEXT,
  replied_at TIMESTAMPTZ,
  admin_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraint ensuring ONE verified review per customer per purchased product per delivered order
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_reviews_customer_order_product 
ON product_reviews(customer_uid, order_id, product_id) 
WHERE deleted_at IS NULL;

-- High-performance query indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status 
ON product_reviews(product_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_uid 
ON product_reviews(customer_uid, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id 
ON product_reviews(order_id) 
WHERE deleted_at IS NULL;
