const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const connectionString = "[REDACTED_DATABASE_CREDENTIAL]";

async function fixDeliveryZoneSchema() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Aligning PostgreSQL 'delivery_zone' table columns with Medusa DeliveryZone model...");
  await client.query(`
    ALTER TABLE delivery_zone 
    ADD COLUMN IF NOT EXISTS manual_override_branch_id text,
    ADD COLUMN IF NOT EXISTS polygon_coordinates jsonb,
    ADD COLUMN IF NOT EXISTS radius_km numeric,
    ADD COLUMN IF NOT EXISTS center_latitude numeric,
    ADD COLUMN IF NOT EXISTS center_longitude numeric,
    ADD COLUMN IF NOT EXISTS priority integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS estimated_delivery_minutes integer DEFAULT 45;
  `);
  console.log("SUCCESS: PostgreSQL 'delivery_zone' table schema completely aligned!");

  await client.end();
}

fixDeliveryZoneSchema();
