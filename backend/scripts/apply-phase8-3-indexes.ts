import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function applyMigration() {
  console.log("================================================================================");
  console.log("  CAKETOHOME — APPLYING PHASE 8.3 DATABASE INDEX MIGRATION");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log("✅ Connected to PostgreSQL Database.");

  const migrationPath = path.resolve(__dirname, "../src/migrations/20260907_phase8_3_database_indexes.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Executing migration file: ${path.basename(migrationPath)}...`);
  const startTime = Date.now();

  try {
    await client.query(sql);
    const duration = Date.now() - startTime;
    console.log(`✅ Migration applied successfully in ${duration}ms.\n`);

    // Verify index creation in pg_indexes
    console.log("Verifying created indexes in pg_indexes:");
    const expectedIndexes = [
      "idx_order_created_at_desc",
      "idx_order_customer_created_at",
      "idx_order_status_created_at",
      "idx_order_email_lookup",
      "idx_delivery_date_slot_status",
      "idx_delivery_partner_status",
      "idx_delivery_zone_branch_serviceable",
      "idx_cms_page_created_at_asc",
      "idx_cms_homepage_section_sort_order",
      "idx_customer_phone",
      "idx_payment_transaction_order_id",
      "idx_payment_transaction_idempotency",
      "idx_order_status_history_order_created",
    ];

    for (const indexName of expectedIndexes) {
      const res = await client.query(`
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = $1;
      `, [indexName]);

      if (res.rows.length > 0) {
        console.log(`  ✅ [FOUND] [${res.rows[0].tablename}] ${indexName}`);
      } else {
        console.error(`  ❌ [MISSING] ${indexName}`);
      }
    }
  } catch (err: any) {
    console.error("❌ Migration execution failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

applyMigration();
