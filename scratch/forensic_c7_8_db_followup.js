const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
let cs = process.env.DATABASE_URL;
if (!cs) {
  const p = fs.existsSync(path.join(__dirname, '../frontend/.env')) ? path.join(__dirname, '../frontend/.env') : path.join(__dirname, '../.env');
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/); if (m) { cs = m[1].trim(); break; } }
}
const pool = new Pool({ connectionString: cs, ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false });
const Q = {
  postgis_available: `SELECT name, default_version FROM pg_available_extensions WHERE name IN ('postgis','earthdistance','cube') ORDER BY name`,
  corp_customers: `SELECT COUNT(*) FILTER (WHERE is_corporate) corp, COUNT(*) FILTER (WHERE is_corporate AND gstin IS NOT NULL) corp_gstin, COUNT(*) FILTER (WHERE credit_enabled) credit, COUNT(*) FILTER (WHERE company_name IS NOT NULL) with_company_name, COUNT(*) total FROM customer WHERE deleted_at IS NULL`,
  zone_geo: `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE polygon_coordinates IS NOT NULL AND jsonb_typeof(polygon_coordinates)='array' AND jsonb_array_length(polygon_coordinates)>=3) with_polygon, COUNT(*) FILTER (WHERE radius_km IS NOT NULL) with_radius, COUNT(*) FILTER (WHERE center_latitude IS NOT NULL) with_center, COUNT(*) FILTER (WHERE manual_override_branch_id IS NOT NULL) with_override, COUNT(*) FILTER (WHERE pincode IS NOT NULL) with_pin, COUNT(DISTINCT branch_id) branches FROM delivery_zone WHERE deleted_at IS NULL`,
  branch_geo: `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) with_coords, COUNT(*) FILTER (WHERE is_open) open FROM branch WHERE deleted_at IS NULL`,
  branch_meta_keys: `SELECT DISTINCT jsonb_object_keys(metadata) k FROM branch WHERE metadata IS NOT NULL AND jsonb_typeof(metadata)='object' ORDER BY 1`,
  customer_meta_keys: `SELECT DISTINCT jsonb_object_keys(metadata) k FROM customer WHERE metadata IS NOT NULL AND jsonb_typeof(metadata)='object' ORDER BY 1`,
  cust_addr_coords: `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE metadata ? 'latitude') with_lat FROM customer_address`,
  delivery_partner_cols_related: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%partner%' OR table_name ILIKE '%store_partner%' OR table_name ILIKE '%routing%' OR table_name ILIKE '%assignment%' OR table_name ILIKE '%employee%' OR table_name ILIKE '%corporate%') ORDER BY 1`,
  geo_zone_service_zone: `SELECT (SELECT COUNT(*) FROM geo_zone) geo_zone, (SELECT COUNT(*) FROM service_zone) service_zone`,
  rbac_tables: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%permission%' OR table_name ILIKE '%role%' OR table_name ILIKE '%policy%' OR table_name='user' OR table_name ILIKE '%audit%') ORDER BY 1`,
  user_cols: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='user' ORDER BY ordinal_position`,
  invoice_cols: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice' ORDER BY ordinal_position`,
  order_branch_link: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('branch_id','fulfillment_branch_id','store_id') AND table_name IN ('order','delivery','invoice','transaction','order_fulfillment') ORDER BY 1,2`,
};
(async () => {
  const out = {};
  for (const [k, q] of Object.entries(Q)) {
    try { out[k] = (await pool.query(q)).rows; } catch (e) { out[k] = { error: e.message }; }
  }
  fs.writeFileSync(path.join(__dirname, 'forensic_c7_8_db_followup.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
  await pool.end();
})();
