const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
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

  const results = {};

  // 1. Branch totals
  const brCount = await client.query(`
    SELECT 
      count(*) as total_branches,
      count(*) FILTER (WHERE deleted_at IS NULL) as non_deleted_branches,
      count(*) FILTER (WHERE is_open = true AND deleted_at IS NULL) as open_branches,
      count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as branches_with_coords,
      count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as branches_missing_coords
    FROM public.branch;
  `);
  results.branch_totals = brCount.rows[0];

  // 2. Branch Coordinate Clusters
  const brCoords = await client.query(`
    SELECT latitude, longitude, count(*) as branch_count, array_agg(code) as sample_codes
    FROM public.branch
    GROUP BY latitude, longitude
    ORDER BY branch_count DESC
    LIMIT 15;
  `);
  results.branch_coordinate_clusters = brCoords.rows;

  // 3. Delivery Zone Stats
  const dzStats = await client.query(`
    SELECT 
      count(*) as total_zones,
      count(DISTINCT branch_id) as branches_with_zones,
      count(*) FILTER (WHERE polygon_coordinates IS NOT NULL AND jsonb_array_length(polygon_coordinates) >= 3) as polygon_zones,
      count(*) FILTER (WHERE radius_km IS NOT NULL AND (polygon_coordinates IS NULL OR jsonb_array_length(polygon_coordinates) < 3)) as radius_only_zones,
      count(*) FILTER (WHERE (polygon_coordinates IS NULL OR jsonb_array_length(polygon_coordinates) < 3) AND radius_km IS NULL) as neither_zones
    FROM public.delivery_zone;
  `);
  results.delivery_zone_stats = dzStats.rows[0];

  // 4. Sample Delivery Zones
  const sampleZones = await client.query(`
    SELECT id, pincode, branch_id, name, radius_km, center_latitude, center_longitude, 
           CASE WHEN polygon_coordinates IS NOT NULL THEN jsonb_array_length(polygon_coordinates) ELSE 0 END as poly_points
    FROM public.delivery_zone
    ORDER BY id
    LIMIT 20;
  `);
  results.sample_zones = sampleZones.rows;

  // 5. Delivery Partner count and columns
  const dpCount = await client.query(`
    SELECT count(*) as total_partners FROM public.delivery_partner;
  `);
  results.delivery_partner_count = dpCount.rows[0].total_partners;

  const dpSample = await client.query(`
    SELECT * FROM public.delivery_partner LIMIT 5;
  `);
  results.delivery_partner_sample = dpSample.rows;

  // 6. Spatial/Fence columns across entire schema
  const spatialCols = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND (
      column_name LIKE '%polygon%' OR
      column_name LIKE '%radius%' OR
      column_name LIKE '%fence%' OR
      column_name LIKE '%exclus%'
    )
    ORDER BY table_name, column_name;
  `);
  results.spatial_columns = spatialCols.rows;

  // 7. Check PostGIS extension
  const ext = await client.query(`
    SELECT extname, extversion FROM pg_extension WHERE extname LIKE '%postgis%';
  `);
  results.postgis_installed = ext.rows.length > 0 ? ext.rows : false;

  // 8. Check available extensions
  const availExt = await client.query(`
    SELECT name, default_version, installed_version, comment 
    FROM pg_available_extensions 
    WHERE name LIKE '%postgis%';
  `);
  results.postgis_available = availExt.rows;

  // 9. Inspect corporate_employee coordinate verification stats
  const empStats = await client.query(`
    SELECT 
      count(*) as total_employees,
      count(*) FILTER (WHERE default_latitude IS NOT NULL AND default_longitude IS NOT NULL) as employees_with_coords,
      count(*) FILTER (WHERE coordinate_verified = true) as employees_coords_verified
    FROM public.corporate_employee;
  `);
  results.corporate_employee_stats = empStats.rows[0];

  // 10. Inspect corporate_gifting_recipient coordinate fields
  const recipCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'corporate_gifting_recipient'
    ORDER BY ordinal_position;
  `);
  results.recipient_columns = recipCols.rows;

  fs.writeFileSync(path.join(__dirname, 'forensic_c7_10_report.json'), JSON.stringify(results, null, 2));
  console.log('Report written to scratch/forensic_c7_10_report.json successfully');

  await client.end();
}

run().catch(console.error);
