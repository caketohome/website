const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check customer address structure
  const custRes = await pool.query(`
    SELECT id, email, metadata 
    FROM "customer" 
    WHERE deleted_at IS NULL 
    LIMIT 3;
  `);
  console.log('Customer sample:', custRes.rows);

  // Check order addresses
  const ordRes = await pool.query(`
    SELECT id, metadata->'delivery' as delivery, metadata->'address' as address 
    FROM "order" 
    WHERE deleted_at IS NULL 
    LIMIT 3;
  `);
  console.log('Order address sample:', ordRes.rows);

  // Check branches by city_id
  const branchCityCounts = await pool.query(`
    SELECT b.city_id, c.name as city_name, COUNT(*) as branch_count
    FROM "branch" b
    LEFT JOIN "city" c ON b.city_id = c.id
    WHERE b.deleted_at IS NULL
    GROUP BY b.city_id, c.name;
  `);
  console.log('Branch city counts:', branchCityCounts.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
