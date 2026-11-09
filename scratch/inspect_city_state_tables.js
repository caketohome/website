const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));

const pool = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check tables related to city/state/location/branch
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('city', 'state', 'states', 'cities', 'delivery_zone', 'branch', 'address', 'customer', 'order')
    ORDER BY table_name;
  `);
  console.log('Tables found:', tables.rows.map(r => r.table_name));

  // Check columns of city table
  const cityCols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'city'
    ORDER BY ordinal_position;
  `);
  console.log('City columns:', cityCols.rows);

  // Check data in city table
  const cityData = await pool.query(`SELECT * FROM "city" LIMIT 15;`);
  console.log('Sample city rows:', cityData.rows);

  // Check if state or states table exists
  const stateCols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name IN ('state', 'states')
    ORDER BY table_name, ordinal_position;
  `);
  console.log('State columns (if any):', stateCols.rows);

  // Check branches city/state columns
  const branchCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branch' AND column_name IN ('city', 'state', 'city_id', 'state_id');
  `);
  console.log('Branch city/state columns:', branchCols.rows);

  // Check sample branch city values
  const branchCities = await pool.query(`
    SELECT DISTINCT city, state FROM "branch" WHERE deleted_at IS NULL;
  `);
  console.log('Distinct branch cities:', branchCities.rows);

  // Check delivery_zone table
  const zoneCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'delivery_zone';
  `);
  console.log('Delivery zone columns:', zoneCols.rows.map(r => r.column_name));

  // Check orders table metadata / city references
  const sampleOrders = await pool.query(`
    SELECT id, metadata->>'delivery' as delivery, metadata->'address' as address 
    FROM "order" 
    WHERE deleted_at IS NULL 
    LIMIT 3;
  `);
  console.log('Sample order delivery/address info:', sampleOrders.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
  process.exit(1);
});
