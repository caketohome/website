/**
 * CakeToHome — PostgreSQL Migration Script: Canonical Product Reviews Table
 * Creates the production product_reviews table, indices, and unique constraint.
 */

const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function main() {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL Database.");

    console.log("Creating product_reviews table...");
    await client.query(`
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
    `);

    console.log("Creating indices and unique constraint...");
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_reviews_customer_order_product 
      ON product_reviews(customer_uid, order_id, product_id) 
      WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status 
      ON product_reviews(product_id, status, created_at DESC) 
      WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_uid 
      ON product_reviews(customer_uid, created_at DESC) 
      WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id 
      ON product_reviews(order_id) 
      WHERE deleted_at IS NULL;
    `);

    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_reviews';
    `);

    console.log("product_reviews columns:", res.rows.map((r) => `${r.column_name} (${r.data_type})`));
    console.log("SUCCESS: Canonical PostgreSQL product_reviews table migrated!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

main();
