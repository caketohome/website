const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("FATAL: DATABASE_URL environment variable is required.");
}

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL Supabase DB.");

  await client.query(`
    CREATE TABLE IF NOT EXISTS "payment_audit_trail" (
      "id" text NOT NULL,
      "transaction_id" text NOT NULL,
      "action" text NOT NULL,
      "ip_address" text NULL,
      "user_agent" text NULL,
      "payload" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "payment_audit_trail_pkey" PRIMARY KEY ("id")
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_audit_trail_deleted_at" ON "payment_audit_trail" ("deleted_at") WHERE deleted_at IS NULL;`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "payment_transaction" (
      "id" text NOT NULL,
      "company_id" text NULL,
      "branch_id" text NOT NULL,
      "order_id" text NOT NULL,
      "customer_id" text NOT NULL,
      "amount" integer NOT NULL,
      "currency" text NOT NULL,
      "idempotency_key" text NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "settlement_status" text NOT NULL DEFAULT 'unsettled',
      "provider" text NOT NULL DEFAULT 'cod',
      "provider_ref" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz NULL,
      CONSTRAINT "payment_transaction_pkey" PRIMARY KEY ("id")
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_transaction_deleted_at" ON "payment_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%payment%';");
  console.log("Payment Tables in PostgreSQL:", tables.rows.map(r => r.table_name));

  console.log("SUCCESS: payment_transaction and payment_audit_trail created!");
  await client.end();
}

main().catch(console.error);
