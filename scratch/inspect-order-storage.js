const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '../frontend/.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const pgPath = path.join(__dirname, '../frontend/node_modules/pg');
const { Client } = require(pgPath);

async function testOrderQueries() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✅ Connected to database.\n');

  // Test 1: Check if "total" column query in customer/orders route fails
  console.log('--- Test 1: Testing customer orders route SQL query ---');
  try {
    const res = await client.query(`
      SELECT COUNT(*)::int as count, COALESCE(SUM(total), 0)::numeric as total_spend 
      FROM "order" 
      WHERE deleted_at IS NULL;
    `);
    console.log('Result:', res.rows[0]);
  } catch (err) {
    console.error('❌ Query failed as expected because column "total" does not exist:', err.message);
  }

  // Test 2: Proper way to calculate total spend from metadata
  console.log('\n--- Test 2: Correct query reading total from metadata ---');
  try {
    const res = await client.query(`
      SELECT 
        COUNT(*)::int as count, 
        COALESCE(SUM((metadata->>'total_amount')::numeric), 0) as total_spend_amount,
        COALESCE(SUM((metadata->>'total')::numeric), 0) as total_spend_fallback
      FROM "order" 
      WHERE deleted_at IS NULL;
    `);
    console.log('✅ Correct metadata total calculation result:', res.rows[0]);
  } catch (err) {
    console.error('Query failed:', err.message);
  }

  // Test 3: Check customer_id column in order table
  console.log('\n--- Test 3: Customer ID linkage in "order" table ---');
  const custLinkage = await client.query(`
    SELECT 
      count(*) as total_orders,
      count(customer_id) as orders_with_customer_id_col,
      count(*) FILTER (WHERE metadata->>'customer_uid' IS NOT NULL) as orders_with_metadata_customer_uid,
      count(*) FILTER (WHERE metadata->>'customer_phone' IS NOT NULL) as orders_with_metadata_phone
    FROM "order";
  `);
  console.table(custLinkage.rows);

  // Test 4: Check if customer table has matching customers
  console.log('\n--- Test 4: Inspecting "customer" table ---');
  const custCount = await client.query(`SELECT count(*) as total_customers FROM "customer";`);
  console.log(`Total customers in "customer" table: ${custCount.rows[0].total_customers}`);

  // Test 5: Check orders placed in the last 7 days vs older
  console.log('\n--- Test 5: Recent Orders Date Range ---');
  const dateRange = await client.query(`
    SELECT 
      to_char(created_at, 'YYYY-MM-DD') as order_day,
      count(*) as count,
      sum((metadata->>'total_amount')::numeric) as daily_revenue
    FROM "order"
    GROUP BY to_char(created_at, 'YYYY-MM-DD')
    ORDER BY order_day DESC
    LIMIT 10;
  `);
  console.table(dateRange.rows);

  // Test 6: Check for any data integrity issues in metadata
  console.log('\n--- Test 6: Data Integrity in Order Metadata ---');
  const integrity = await client.query(`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE metadata IS NULL) as null_metadata,
      count(*) FILTER (WHERE metadata->'items' IS NULL) as missing_items,
      count(*) FILTER (WHERE metadata->>'total_amount' IS NULL AND metadata->>'total' IS NULL) as missing_totals,
      count(*) FILTER (WHERE metadata->>'branch_id' IS NULL) as missing_branch,
      count(*) FILTER (WHERE metadata->>'delivery_date' IS NULL) as missing_delivery_date,
      count(*) FILTER (WHERE metadata->>'delivery_address' IS NULL) as missing_address,
      count(*) FILTER (WHERE metadata->>'customer_phone' IS NULL) as missing_phone
    FROM "order";
  `);
  console.table(integrity.rows);

  await client.end();
}

testOrderQueries().catch(console.error);
