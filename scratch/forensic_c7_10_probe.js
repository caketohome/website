const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../frontend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB successfully');

  // 1. Delivery Zone Columns
  const dzCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'delivery_zone'
    ORDER BY ordinal_position;
  `);
  console.log('--- delivery_zone Columns ---');
  console.log(JSON.stringify(dzCols.rows, null, 2));

  // 2. Delivery Zone stats
  const dzStats = await client.query(`
    SELECT 
      count(*) as total_zones,
      count(DISTINCT branch_id) as branches_with_zones,
      count(*) FILTER (WHERE polygon_coordinates IS NOT NULL AND jsonb_array_length(polygon_coordinates) >= 3) as polygon_zones,
      count(*) FILTER (WHERE radius_km IS NOT NULL AND (polygon_coordinates IS NULL OR jsonb_array_length(polygon_coordinates) < 3)) as radius_only_zones,
      count(*) FILTER (WHERE polygon_coordinates IS NULL AND radius_km IS NULL) as neither_zones,
      count(*) FILTER (WHERE exclusion_polygons IS NOT NULL) as zones_with_exclusions
    FROM public.delivery_zone;
  `);
  console.log('--- delivery_zone Stats ---');
  console.log(JSON.stringify(dzStats.rows, null, 2));

  // 3. Delivery Partner Columns
  const dpCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'delivery_partner'
    ORDER BY ordinal_position;
  `);
  console.log('--- delivery_partner Columns ---');
  console.log(JSON.stringify(dpCols.rows, null, 2));

  // 4. Delivery Partner Sample Rows
  const dpSample = await client.query(`
    SELECT * FROM public.delivery_partner LIMIT 10;
  `);
  console.log('--- delivery_partner Sample (first 10) ---');
  console.log(JSON.stringify(dpSample.rows, null, 2));

  // 5. Total Delivery Partners
  const dpCount = await client.query(`
    SELECT count(*) as total_partners FROM public.delivery_partner;
  `);
  console.log('--- delivery_partner Total ---');
  console.log(JSON.stringify(dpCount.rows, null, 2));

  // 6. Branch Columns
  const brCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch'
    ORDER BY ordinal_position;
  `);
  console.log('--- branch Columns ---');
  console.log(JSON.stringify(brCols.rows.map(r => r.column_name), null, 2));

  // 7. Branch coordinate distribution
  const brCoords = await client.query(`
    SELECT latitude, longitude, count(*) as branch_count, array_agg(code) as codes
    FROM public.branch
    GROUP BY latitude, longitude
    ORDER BY branch_count DESC
    LIMIT 10;
  `);
  console.log('--- branch top coordinate clusters ---');
  console.log(JSON.stringify(brCoords.rows, null, 2));

  // 8. Distinct branches total
  const brCount = await client.query(`
    SELECT count(*) as total_branches, count(*) FILTER (WHERE is_active = true) as active_branches FROM public.branch;
  `);
  console.log('--- branch Total ---');
  console.log(JSON.stringify(brCount.rows, null, 2));

  await client.end();
}

run().catch(console.error);
