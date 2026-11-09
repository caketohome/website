/**
 * C7.8 follow-up: READ-ONLY classification of branch / delivery_zone data.
 * Runs inside BEGIN READ ONLY; any write attempt fails at the server. Always ROLLBACKs.
 * Output: scratch/forensic_c7_8_data_classification.json
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
let cs = process.env.DATABASE_URL;
if (!cs) {
  const p = fs.existsSync(path.join(__dirname, '../frontend/.env')) ? path.join(__dirname, '../frontend/.env') : path.join(__dirname, '../.env');
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/); if (m) { cs = m[1].trim(); break; } }
}
const pool = new Pool({ connectionString: cs, ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false });

const FIXTURE = `(b.name ~* '(pipeline|test|e2e|fixture|dummy|sample)' OR b.code ~* '(test|e2e|pipe)' OR (jsonb_typeof(b.metadata)='object' AND (b.metadata ? 'test_suite' OR b.metadata ? 'is_test' OR b.metadata ? 'seeded_by')))`;

const Q = {
  branch_totals: `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE deleted_at IS NULL) live, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) soft_deleted, MIN(created_at) first_created, MAX(created_at) last_created FROM branch`,
  branch_fixture_split: `SELECT CASE WHEN ${FIXTURE} THEN 'LIKELY_FIXTURE' ELSE 'UNCLASSIFIED_OR_REAL' END cls, COUNT(*) n, MIN(b.created_at) first_created, MAX(b.created_at) last_created FROM branch b WHERE b.deleted_at IS NULL GROUP BY 1`,
  branch_coord_clusters: `SELECT ROUND(latitude::numeric,4) lat, ROUND(longitude::numeric,4) lng, COUNT(*) n FROM branch WHERE deleted_at IS NULL GROUP BY 1,2 ORDER BY n DESC LIMIT 15`,
  branch_unclassified_sample: `SELECT b.id, b.name, b.code, b.city_id, b.latitude, b.longitude, b.is_open, b.created_at, b.metadata->>'test_suite' test_suite FROM branch b WHERE b.deleted_at IS NULL AND NOT ${FIXTURE} ORDER BY b.created_at LIMIT 40`,
  branch_fixture_sample: `SELECT b.id, b.name, b.code, b.latitude, b.longitude, b.created_at, b.metadata->>'test_suite' test_suite FROM branch b WHERE b.deleted_at IS NULL AND ${FIXTURE} ORDER BY b.created_at LIMIT 10`,
  branch_id_prefixes: `SELECT split_part(id,'_',1) prefix, COUNT(*) n FROM branch WHERE deleted_at IS NULL GROUP BY 1 ORDER BY n DESC`,
  branch_ref_columns: `SELECT c.table_name, c.column_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE' WHERE c.table_schema='public' AND c.column_name IN ('branch_id','fulfillment_branch_id','home_branch_id','manual_override_branch_id') ORDER BY 1,2`,
  zone_totals: `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE deleted_at IS NULL) live FROM delivery_zone`,
  zone_orphans: `SELECT COUNT(*) FILTER (WHERE b.id IS NULL) orphan_zones, COUNT(DISTINCT z.branch_id) FILTER (WHERE b.id IS NULL) orphan_branch_ids, COUNT(*) FILTER (WHERE b.id IS NOT NULL) linked_zones FROM delivery_zone z LEFT JOIN branch b ON b.id=z.branch_id WHERE z.deleted_at IS NULL`,
  zone_orphan_ids: `SELECT z.branch_id, COUNT(*) zones FROM delivery_zone z LEFT JOIN branch b ON b.id=z.branch_id WHERE z.deleted_at IS NULL AND b.id IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  zone_geometry_class: `SELECT CASE
      WHEN polygon_coordinates IS NOT NULL AND jsonb_typeof(polygon_coordinates)='array' AND jsonb_array_length(polygon_coordinates)>=3 AND radius_km IS NOT NULL AND center_latitude IS NOT NULL THEN 'POLYGON+RADIUS'
      WHEN polygon_coordinates IS NOT NULL AND jsonb_typeof(polygon_coordinates)='array' AND jsonb_array_length(polygon_coordinates)>=3 THEN 'POLYGON_ONLY'
      WHEN radius_km IS NOT NULL AND center_latitude IS NOT NULL AND center_longitude IS NOT NULL THEN 'RADIUS_ONLY'
      WHEN polygon_coordinates IS NOT NULL AND jsonb_typeof(polygon_coordinates)='array' THEN 'DEGENERATE_POLYGON(<3)'
      ELSE 'PIN_ONLY' END cls, COUNT(*) n, COUNT(*) FILTER (WHERE is_serviceable) serviceable FROM delivery_zone WHERE deleted_at IS NULL GROUP BY 1 ORDER BY n DESC`,
  zone_radius_stats: `SELECT MIN(radius_km) min_r, MAX(radius_km) max_r, ROUND(AVG(radius_km)::numeric,2) avg_r, COUNT(*) FILTER (WHERE radius_km<=0) nonpositive FROM delivery_zone WHERE deleted_at IS NULL AND radius_km IS NOT NULL`,
  zone_center_out_of_india: `SELECT COUNT(*) n FROM delivery_zone WHERE deleted_at IS NULL AND center_latitude IS NOT NULL AND (center_latitude NOT BETWEEN 6 AND 38 OR center_longitude NOT BETWEEN 68 AND 98)`,
  zone_duplicate_pins: `SELECT pincode, COUNT(*) zones, COUNT(DISTINCT branch_id) branches FROM delivery_zone WHERE deleted_at IS NULL GROUP BY 1 HAVING COUNT(*)>1 ORDER BY 2 DESC LIMIT 15`,
  zone_per_branch_class: `SELECT CASE WHEN b.id IS NULL THEN 'ORPHAN' WHEN ${FIXTURE} THEN 'FIXTURE_BRANCH' ELSE 'OTHER_BRANCH' END cls, COUNT(*) zones, COUNT(DISTINCT z.branch_id) branches FROM delivery_zone z LEFT JOIN branch b ON b.id=z.branch_id WHERE z.deleted_at IS NULL GROUP BY 1`,
  zone_name_sample: `SELECT name, pincode, branch_id, is_serviceable, radius_km, priority, created_at FROM delivery_zone WHERE deleted_at IS NULL ORDER BY created_at LIMIT 15`,
};

(async () => {
  const out = { generated_at: new Date().toISOString(), mode: 'READ ONLY TRANSACTION' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    for (const [k, q] of Object.entries(Q)) {
      try { await client.query('SAVEPOINT s'); out[k] = (await client.query(q)).rows; await client.query('RELEASE SAVEPOINT s'); }
      catch (e) { out[k] = { error: e.message }; await client.query('ROLLBACK TO SAVEPOINT s'); }
    }
    // Reference counts per branch-bearing table: how many distinct branches are referenced, and how many are fixture-classified
    out.branch_references = [];
    const cols = Array.isArray(out.branch_ref_columns) ? out.branch_ref_columns : [];
    for (const { table_name: t, column_name: c } of cols) {
      if (t === 'branch') continue;
      try {
        await client.query('SAVEPOINT s');
        const r = await client.query(`SELECT COUNT(*) rows_total, COUNT(${'x.'+'"'+c+'"'}) rows_with_branch, COUNT(DISTINCT x."${c}") distinct_branches, COUNT(*) FILTER (WHERE x."${c}" IS NOT NULL AND b.id IS NULL) dangling, COUNT(*) FILTER (WHERE b.id IS NOT NULL AND ${FIXTURE}) rows_on_fixture_branches FROM public."${t}" x LEFT JOIN branch b ON b.id = x."${c}"`);
        out.branch_references.push({ table: t, column: c, ...r.rows[0] });
        await client.query('RELEASE SAVEPOINT s');
      } catch (e) { out.branch_references.push({ table: t, column: c, error: e.message }); await client.query('ROLLBACK TO SAVEPOINT s'); }
    }
    await client.query('ROLLBACK');
  } finally { client.release(); await pool.end(); }
  fs.writeFileSync(path.join(__dirname, 'forensic_c7_8_data_classification.json'), JSON.stringify(out, null, 1));
  console.log('written; keys:', Object.keys(out).length);
})().catch(e => { console.error(e); process.exit(1); });
