const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const branchCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branch'
    ORDER BY ordinal_position;
  `);
  console.log('Branch columns:', branchCols.rows.map(r => `${r.column_name} (${r.data_type})`));

  const sampleBranches = await pool.query(`
    SELECT id, name, city_id, latitude, longitude, is_open 
    FROM "branch" 
    WHERE deleted_at IS NULL 
    LIMIT 5;
  `);
  console.log('Sample branches:', sampleBranches.rows);

  const zoneCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'delivery_zone'
    ORDER BY ordinal_position;
  `);
  console.log('Delivery zone columns:', zoneCols.rows.map(r => `${r.column_name} (${r.data_type})`));

  const sampleZones = await pool.query(`
    SELECT * FROM "delivery_zone" WHERE deleted_at IS NULL LIMIT 5;
  `);
  console.log('Sample delivery zones:', sampleZones.rows);

  const allCities = await pool.query(`
    SELECT id, name, state, is_active FROM "city" WHERE deleted_at IS NULL ORDER BY name;
  `);
  console.log(`Total active/non-deleted cities in DB: ${allCities.rows.length}`);
  console.log('Cities list:', allCities.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
