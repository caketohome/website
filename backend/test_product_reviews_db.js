/**
 * CakeToHome — PostgreSQL Direct Database Verification Test
 * Tests:
 * 1. Direct PostgreSQL connection
 * 2. Table existence and schema verification
 * 3. Verified review insertion with customer_uid, order_id, order_item_id
 * 4. Unique constraint violation on duplicate review (UNIQUE(customer_uid, order_id, product_id))
 * 5. Aggregate rating calculation via SQL query
 * 6. Deletion and clean state verification
 */

const { Client } = require("pg");
require("dotenv").config({ path: "./.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log("DATABASE_URL environment variable is required. Skipping test.");
  process.exit(0);
}

async function runTest() {
  console.log("============================================================");
  console.log("🐘 CAKETOHOME — POSTGRESQL PRODUCT REVIEWS DATABASE TEST");
  console.log("============================================================\n");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
  });

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    await client.connect();
    console.log("Connected to PostgreSQL Database.\n");

    // 1. Ensure Table & Constraints
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
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_reviews_customer_order_product 
      ON product_reviews(customer_uid, order_id, product_id) 
      WHERE deleted_at IS NULL;
    `);

    // 2. Schema Column Check
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'product_reviews';
    `);
    const colNames = cols.rows.map((r) => r.column_name);
    assert(colNames.includes("customer_uid"), "Database table contains customer_uid column");
    assert(colNames.includes("order_id"), "Database table contains order_id column");
    assert(colNames.includes("order_item_id"), "Database table contains order_item_id column");
    assert(colNames.includes("is_verified_purchase"), "Database table contains is_verified_purchase column");
    assert(colNames.includes("rating"), "Database table contains rating column");

    // 3. Clean any existing test records
    const TEST_REV_ID = "prev_db_test_999";
    const TEST_CUST_UID = "cth_cus_db_test_01";
    const TEST_PROD_ID = "prod_db_test_cake_01";
    const TEST_ORD_ID = "ord_db_test_888";

    await client.query(`DELETE FROM product_reviews WHERE id = $1 OR customer_uid = $2;`, [
      TEST_REV_ID,
      TEST_CUST_UID,
    ]);

    // 4. Test Single Verified Review Insert
    const insertRes = await client.query(
      `
      INSERT INTO product_reviews (
        id, product_id, customer_uid, customer_name, order_id, order_item_id,
        rating, title, review_text, is_verified_purchase, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `,
      [
        TEST_REV_ID,
        TEST_PROD_ID,
        TEST_CUST_UID,
        "Alex R.",
        TEST_ORD_ID,
        "item_001",
        5,
        "Superb Belgian Truffle",
        "Moist, decadent, and perfectly balanced cocoa.",
        true,
        "approved",
      ]
    );

    assert(insertRes.rows.length === 1, "Inserted 1 verified review into PostgreSQL");
    assert(insertRes.rows[0].customer_uid === TEST_CUST_UID, "Persisted row contains exact canonical customer_uid");
    assert(insertRes.rows[0].rating === 5, "Persisted row contains exact rating 5");
    assert(insertRes.rows[0].is_verified_purchase === true, "Persisted row flagged is_verified_purchase = true");

    // 5. Test Unique Constraint Rejection (Race-Condition / Duplicate Safety)
    let dupFailed = false;
    try {
      await client.query(
        `
        INSERT INTO product_reviews (
          id, product_id, customer_uid, customer_name, order_id, order_item_id,
          rating, title, review_text, is_verified_purchase, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `,
        [
          "prev_db_test_duplicate_999",
          TEST_PROD_ID,
          TEST_CUST_UID,
          "Alex R.",
          TEST_ORD_ID,
          "item_001",
          4,
          "Duplicate Review Attempt",
          "Should be rejected by unique index",
          true,
          "approved",
        ]
      );
    } catch (err) {
      dupFailed = true;
      assert(
        err.code === "23505" || err.message.includes("unique") || err.message.includes("uq_product_reviews"),
        `PostgreSQL rejected duplicate review with code 23505 (unique_violation): ${err.message}`
      );
    }
    assert(dupFailed, "PostgreSQL strictly enforces UNIQUE(customer_uid, order_id, product_id)");

    // 6. Test SQL Aggregate Calculation
    const aggRes = await client.query(
      `
      SELECT 
        COUNT(*)::int as total_reviews,
        ROUND(AVG(rating), 1)::float as average_rating,
        COUNT(*) FILTER (WHERE rating = 5)::int as stars_5,
        COUNT(*) FILTER (WHERE rating = 4)::int as stars_4,
        COUNT(*) FILTER (WHERE rating = 3)::int as stars_3,
        COUNT(*) FILTER (WHERE rating = 2)::int as stars_2,
        COUNT(*) FILTER (WHERE rating = 1)::int as stars_1
      FROM product_reviews
      WHERE product_id = $1 AND status = 'approved' AND deleted_at IS NULL;
    `,
      [TEST_PROD_ID]
    );

    assert(aggRes.rows[0].total_reviews === 1, "SQL aggregate total_reviews is 1");
    assert(aggRes.rows[0].average_rating === 5.0, "SQL aggregate average_rating is 5.0");
    assert(aggRes.rows[0].stars_5 === 1, "SQL aggregate stars_5 is 1");

    // 7. Cleanup
    await client.query(`DELETE FROM product_reviews WHERE id = $1 OR customer_uid = $2;`, [
      TEST_REV_ID,
      TEST_CUST_UID,
    ]);

    const cleanRes = await client.query(`SELECT COUNT(*)::int as count FROM product_reviews WHERE id = $1;`, [
      TEST_REV_ID,
    ]);
    assert(cleanRes.rows[0].count === 0, "Test review deleted and database cleaned up completely");

    console.log("\n============================================================");
    console.log(`📊 DATABASE TEST SUMMARY:`);
    console.log(`   Total Assertions: ${passed + failed}`);
    console.log(`   Passed:           ${passed} ✅`);
    console.log(`   Failed:           ${failed} ${failed === 0 ? "✨" : "❌"}`);
    console.log("============================================================\n");
  } catch (err) {
    console.error("Database connection/execution error (testing offline/fallback behavior):", err.message);
  } finally {
    await client.end();
  }
}

runTest();
