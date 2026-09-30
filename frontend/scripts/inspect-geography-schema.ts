import { Client } from "pg";
import { closeDbPool } from "../src/lib/db";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const safetyTimeout = setTimeout(() => {
  console.error("[SAFETY_TIMEOUT] inspect-geography-schema timed out");
  process.exit(1);
}, 20000);
safetyTimeout.unref();

async function run() {
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();

    console.log("================================================================================");
    console.log("1. TABLES IN DATABASE MATCHING GEOGRAPHY TERMS");
    console.log("================================================================================");

    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (
          table_name ILIKE '%city%'
          OR table_name ILIKE '%state%'
          OR table_name ILIKE '%pincode%'
          OR table_name ILIKE '%postal%'
          OR table_name ILIKE '%zone%'
          OR table_name ILIKE '%branch%'
          OR table_name ILIKE '%hub%'
          OR table_name ILIKE '%setting%'
        )
      ORDER BY table_name;
    `);
    console.table(tablesRes.rows);

    // 2. Inspect 'city' table columns and sample rows
    console.log("\n================================================================================");
    console.log("2. COLUMNS OF 'city' TABLE");
    console.log("================================================================================");
    const cityCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'city'
      ORDER BY ordinal_position;
    `);
    console.table(cityCols.rows);

    const cityRows = await client.query(`SELECT * FROM "city" LIMIT 50;`);
    console.log(`Total rows in 'city': ${cityRows.rows.length}`);
    console.table(cityRows.rows);

    // 3. Inspect if 'state' table exists
    console.log("\n================================================================================");
    console.log("3. COLUMNS & DATA OF 'state' TABLE (if exists)");
    console.log("================================================================================");
    const stateTableExists = tablesRes.rows.some(r => r.table_name === "state");
    if (stateTableExists) {
      const stateCols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'state'
        ORDER BY ordinal_position;
      `);
      console.table(stateCols.rows);
      const stateRows = await client.query(`SELECT * FROM "state" LIMIT 50;`);
      console.log(`Total rows in 'state': ${stateRows.rows.length}`);
      console.table(stateRows.rows);
    } else {
      console.log("Table 'state' DOES NOT EXIST in public schema.");
    }

    // 4. Search for 'Kollam' and 'Kerala' across the database
    console.log("\n================================================================================");
    console.log("4. SEARCH FOR 'Kollam' AND 'Kerala' IN 'city' TABLE");
    console.log("================================================================================");
    const kollamInCity = await client.query(`
      SELECT * FROM "city" WHERE name ILIKE '%kollam%' OR id ILIKE '%kollam%';
    `);
    console.log("Kollam in city:", kollamInCity.rows);

    const keralaInCity = await client.query(`
      SELECT * FROM "city" WHERE state ILIKE '%kerala%';
    `);
    console.log("Kerala cities in city table:", keralaInCity.rows);

    // 5. Inspect 'branch' table for Kollam hub / HUB-KLM-01
    console.log("\n================================================================================");
    console.log("5. INSPECT 'branch' TABLE FOR 'HUB-KLM-01' OR 'Kollam'");
    console.log("================================================================================");
    const branchCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'branch'
      ORDER BY ordinal_position;
    `);
    console.log("Branch columns:");
    console.table(branchCols.rows);

    const kollamBranch = await client.query(`
      SELECT *
      FROM "branch"
      WHERE code ILIKE '%HUB-KLM-01%' OR name ILIKE '%kollam%' OR id ILIKE '%kollam%';
    `);
    console.log("Kollam branch:", JSON.stringify(kollamBranch.rows[0], null, 2));

    // 6. Inspect sample branches to see how city and state are stored
    console.log("\n================================================================================");
    console.log("6. SAMPLE BRANCHES (city, city_id, state, state_id, metadata)");
    console.log("================================================================================");
    const sampleBranches = await client.query(`
      SELECT *
      FROM "branch"
      WHERE deleted_at IS NULL
      LIMIT 2;
    `);
    console.log("Sample branch rows:", sampleBranches.rows);

    // 7. Check if settings or other tables store geography
    console.log("\n================================================================================");
    console.log("7. CHECK 'setting' TABLE FOR GEOGRAPHY / STATES / CITIES");
    console.log("================================================================================");
    const distinctStates = await client.query(`
      SELECT DISTINCT state, COUNT(*) as city_count
      FROM "city"
      WHERE deleted_at IS NULL
      GROUP BY state
      ORDER BY state;
    `);
    console.log("Distinct states in 'city' table:");
    console.table(distinctStates.rows);

  } catch (err: any) {
    console.error("ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    await closeDbPool();
    clearTimeout(safetyTimeout);
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  }
}

run();
