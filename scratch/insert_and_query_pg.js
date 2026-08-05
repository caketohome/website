const path = require("path");
const pgPath = path.join(__dirname, "../backend/node_modules/pg");
const { Client } = require(pgPath);

const connectionString = "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

async function runPgVerification() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("=========================================================");
    console.log("CONNECTED TO PRODUCTION POSTGRESQL DATABASE (SUPABASE)");
    console.log("=========================================================");

    // 1. Check existing shops in PostgreSQL shop table
    const shopRes = await client.query(`SELECT id, name FROM shop LIMIT 5;`);
    console.log("\n1. EXISTING SHOPS IN POSTGRESQL 'shop' TABLE:");
    console.table(shopRes.rows);

    let shopId = shopRes.rows[0]?.id;
    if (!shopId) {
      console.log("\nNo shop found. Inserting root shop into 'shop' table...");
      shopId = `shop_root_${Date.now()}`;
      await client.query(
        `INSERT INTO shop (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW());`,
        [shopId, "CakeToHome Flagship Bakery"]
      );
      console.log(`Created parent shop "${shopId}".`);
    }

    const timestamp = Date.now();
    const branchId = `br_live_pg_${timestamp}`;
    const branchName = `Empirical Live PostgreSQL Hub ${timestamp}`;
    const branchEmail = `indiranagar_${timestamp}@cakes2home.com`;
    const branchCode = `HUB-${Math.floor(100 + Math.random() * 900)}`;

    // 2. Insert row into PostgreSQL branch table using valid parent shopId
    const insertRes = await client.query(
      `INSERT INTO branch (id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) 
       RETURNING id, name, code, is_open, phone, email, address, latitude, longitude, shop_id, created_at;`,
      [
        branchId,
        branchName,
        branchCode,
        true,
        "+91 98765 11111",
        branchEmail,
        "100 Feet Rd, Indiranagar, Bengaluru",
        12.9716,
        77.6412,
        shopId,
      ]
    );

    console.log("\n2. DIRECT POSTGRESQL INSERT SUCCESS — RETURNED ROW:");
    console.log(insertRes.rows[0]);

    // 3. Query top 5 rows from PostgreSQL branch table
    const selectRes = await client.query(
      `SELECT id, name, code, email, phone, address, latitude, longitude, shop_id, created_at 
       FROM branch 
       ORDER BY created_at DESC 
       LIMIT 5;`
    );

    console.log("\n3. QUERY RESULT — SELECT * FROM branch ORDER BY created_at DESC LIMIT 5:");
    console.table(selectRes.rows);

    await client.end();
  } catch (err) {
    console.error("PostgreSQL Query Error:", err.message);
  }
}

runPgVerification();
