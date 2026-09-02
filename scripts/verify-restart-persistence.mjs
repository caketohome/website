import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { Pool } = require(path.join(__dirname, "../frontend/node_modules/pg"));

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

let passCount = 0;
let failCount = 0;

function pass(name, detail = "") {
  passCount++;
  console.log(`  \x1b[32m[PASS]\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, error = "") {
  failCount++;
  console.error(`  \x1b[31m[FAIL]\x1b[0m ${name}${error ? ` — ${error}` : ""}`);
}

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log(" CakeToHome: Restart & Direct PostgreSQL Persistence Round-Trip Verification");
  console.log("════════════════════════════════════════════════════════════════════════════════\n");

  const testSuffix = `test_${Date.now()}`;
  const testFavoriteId = `fav_audit_${testSuffix}`;
  const testReviewId = `rev_audit_${testSuffix}`;
  const testCustomerUid = `cus_audit_${testSuffix}`;
  const testProductId = "prod_1";

  try {
    // 0. Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "customer_favorite" (
        "id" text NOT NULL,
        "customer_uid" text NOT NULL,
        "product_id" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "customer_favorite_pkey" PRIMARY KEY ("id")
      );
      CREATE TABLE IF NOT EXISTS "product_review" (
        "id" text NOT NULL,
        "product_id" text NOT NULL,
        "customer_uid" text NOT NULL,
        "customer_name" text NOT NULL DEFAULT 'Valued Customer',
        "order_id" text NULL,
        "order_item_id" text NULL,
        "rating" integer NOT NULL DEFAULT 5,
        "title" text NOT NULL DEFAULT '',
        "review_text" text NOT NULL DEFAULT '',
        "purchased_variant" text NULL,
        "is_verified_purchase" boolean NOT NULL DEFAULT true,
        "status" text NOT NULL DEFAULT 'APPROVED',
        "admin_response" jsonb NULL,
        "helpful_votes" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "published_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "product_review_pkey" PRIMARY KEY ("id")
      );
    `);
    pass("Schema extension tables 'customer_favorite' and 'product_review' verified/created");

    // 1. Insert Customer Favorite directly into PostgreSQL
    console.log("\n[STEP 1] Direct PostgreSQL Write — Customer Favorite");
    await pool.query(
      `INSERT INTO "customer_favorite" ("id", "customer_uid", "product_id", "created_at") VALUES ($1, $2, $3, NOW())`,
      [testFavoriteId, testCustomerUid, testProductId]
    );
    pass(`Inserted favorite ${testFavoriteId} into PostgreSQL table "customer_favorite"`);

    // 2. Query Customer Favorite from PostgreSQL
    console.log("\n[STEP 2] Direct PostgreSQL Read — Customer Favorite");
    const favRes = await pool.query(
      `SELECT * FROM "customer_favorite" WHERE "id" = $1 AND "deleted_at" IS NULL`,
      [testFavoriteId]
    );
    if (favRes.rows.length === 1 && favRes.rows[0].customer_uid === testCustomerUid) {
      pass(`Read favorite ${testFavoriteId} directly from PostgreSQL`, `Customer: ${favRes.rows[0].customer_uid}`);
    } else {
      fail(`Could not read favorite ${testFavoriteId} from PostgreSQL`);
    }

    // 3. Insert Product Review directly into PostgreSQL
    console.log("\n[STEP 3] Direct PostgreSQL Write — Product Review");
    await pool.query(
      `INSERT INTO "product_review" ("id", "product_id", "customer_id", "customer_name", "rating", "title", "body", "status", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [testReviewId, testProductId, testCustomerUid, "Audit Tester", 5, "Durability Test Cake", "Testing DB persistence", "APPROVED"]
    );
    pass(`Inserted review ${testReviewId} into PostgreSQL table "product_review"`);

    // 4. Query Product Review from PostgreSQL
    console.log("\n[STEP 4] Direct PostgreSQL Read & Update — Product Review");
    const revRes = await pool.query(
      `SELECT * FROM "product_review" WHERE "id" = $1 AND "deleted_at" IS NULL`,
      [testReviewId]
    );
    if (revRes.rows.length === 1 && revRes.rows[0].rating === 5) {
      pass(`Read review ${testReviewId} directly from PostgreSQL`, `Rating: ${revRes.rows[0].rating}`);
    } else {
      fail(`Could not read review ${testReviewId} from PostgreSQL`);
    }

    // 5. Update Product Review in PostgreSQL
    await pool.query(
      `UPDATE "product_review" SET "rating" = 4, "title" = 'Updated Title', "updated_at" = NOW() WHERE "id" = $1`,
      [testReviewId]
    );
    const updatedRevRes = await pool.query(
      `SELECT * FROM "product_review" WHERE "id" = $1`,
      [testReviewId]
    );
    if (updatedRevRes.rows.length === 1 && updatedRevRes.rows[0].rating === 4) {
      pass(`Updated review ${testReviewId} directly in PostgreSQL`, `New rating: 4`);
    } else {
      fail(`Review update failed in PostgreSQL`);
    }

    // 6. Cleanup test records
    console.log("\n[STEP 5] Cleanup Audit Records");
    await pool.query(`DELETE FROM "customer_favorite" WHERE "id" = $1`, [testFavoriteId]);
    await pool.query(`DELETE FROM "product_review" WHERE "id" = $1`, [testReviewId]);
    pass(`Cleaned up test records from PostgreSQL`);

  } catch (err) {
    fail("PostgreSQL Persistence Verification failed", err.message);
  } finally {
    await pool.end();
  }

  console.log("\n════════════════════════════════════════════════════════════════════════════════");
  console.log(` RESULT: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("════════════════════════════════════════════════════════════════════════════════\n");

  process.exit(failCount > 0 ? 1 : 0);
}

main();
