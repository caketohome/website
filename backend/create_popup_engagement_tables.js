/**
 * CakeToHome - PostgreSQL Migration: Popup & Engagement Manager Tables
 * Defines normalized relational schemas and composite indexes for campaign configurations,
 * version history, rule groups, and high-throughput telemetry impressions/conversions.
 */

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/cakes2home",
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Creating popup_campaigns table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS popup_campaigns (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        popup_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        priority INTEGER NOT NULL DEFAULT 10,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
        created_by VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_popup_campaigns_status ON popup_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_popup_campaigns_type ON popup_campaigns(popup_type);
      CREATE INDEX IF NOT EXISTS idx_popup_campaigns_priority ON popup_campaigns(priority DESC);
    `);

    console.log("Creating popup_versions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS popup_versions (
        id VARCHAR(64) PRIMARY KEY,
        popup_campaign_id VARCHAR(64) NOT NULL REFERENCES popup_campaigns(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        design_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        trigger_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        audience_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        frequency_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        schedule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        offer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        media_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_popup_versions_campaign ON popup_versions(popup_campaign_id);
    `);

    console.log("Creating popup_impressions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS popup_impressions (
        id VARCHAR(64) PRIMARY KEY,
        popup_campaign_id VARCHAR(64) NOT NULL REFERENCES popup_campaigns(id) ON DELETE CASCADE,
        popup_version_id VARCHAR(64),
        session_id VARCHAR(128) NOT NULL,
        visitor_id VARCHAR(128),
        customer_id VARCHAR(64),
        page_url TEXT,
        device_type VARCHAR(32) NOT NULL DEFAULT 'desktop',
        event_type VARCHAR(64) NOT NULL DEFAULT 'viewed',
        cart_value NUMERIC(10, 2) DEFAULT 0,
        city_id VARCHAR(64),
        branch_id VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_popup_impressions_campaign ON popup_impressions(popup_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_popup_impressions_created_at ON popup_impressions(created_at);
      CREATE INDEX IF NOT EXISTS idx_popup_impressions_session ON popup_impressions(session_id);
    `);

    console.log("Creating popup_conversions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS popup_conversions (
        id VARCHAR(64) PRIMARY KEY,
        popup_campaign_id VARCHAR(64) NOT NULL REFERENCES popup_campaigns(id) ON DELETE CASCADE,
        popup_impression_id VARCHAR(64),
        session_id VARCHAR(128) NOT NULL,
        visitor_id VARCHAR(128),
        customer_id VARCHAR(64),
        conversion_type VARCHAR(64) NOT NULL,
        order_id VARCHAR(64),
        coupon_code VARCHAR(64),
        revenue NUMERIC(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_popup_conversions_campaign ON popup_conversions(popup_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_popup_conversions_created_at ON popup_conversions(created_at);
      CREATE INDEX IF NOT EXISTS idx_popup_conversions_order ON popup_conversions(order_id);
    `);

    await client.query("COMMIT");
    console.log("✅ Popup & Engagement Manager database migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrate };
