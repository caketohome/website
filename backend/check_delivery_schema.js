const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

const connectionString = process.env.DATABASE_URL;

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "delivery_delivery_partner" (
      "id" text NOT NULL,
      "delivery_id" text NULL,
      "delivery_partner_id" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "delivery_delivery_partner_pkey" PRIMARY KEY ("id")
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_delivery_delivery_partner_deleted_at" ON "delivery_delivery_partner" ("deleted_at") WHERE deleted_at IS NULL;`);

  console.log("SUCCESS: delivery_delivery_partner table ensured!");
  await client.end();
}

main().catch(console.error);
