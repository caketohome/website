/** C7.8 follow-up #2: READ-ONLY customer/RBAC/trigger conventions. BEGIN READ ONLY + ROLLBACK. */
const path = require('path');
const fs = require('fs');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
let cs = process.env.DATABASE_URL;
if (!cs) {
  for (const l of fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8').split('\n')) { const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/); if (m) { cs = m[1].trim(); break; } }
}
const pool = new Pool({ connectionString: cs, ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false });
const Q = {
  customer_cols: `select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='customer' and column_name in ('id','created_by','has_account','email','phone','gstin','company_name','is_corporate','user_id','credit_status','deleted_at') order by 1`,
  customer_id_prefix: `select split_part(id,'_',1) p, count(*) n from customer group by 1`,
  customer_constraints: `select conname, contype, pg_get_constraintdef(oid) d from pg_constraint where conrelid='public.customer'::regclass and contype in ('c','u')`,
  user_rbac_role_cols: `select column_name,data_type from information_schema.columns where table_schema='public' and table_name='user_rbac_role' order by ordinal_position`,
  rbac_counts: `select (select count(*) from user_rbac_role) user_rbac_role_rows, (select count(*) from "user") users`,
  triggers_on_c7: `select event_object_table t, trigger_name, event_manipulation e from information_schema.triggers where event_object_table like 'corporate%' or event_object_table in ('company','cost_centre','customer','invoice') order by 1,2`,
  distinct_customer_has_account: `select has_account, count(*) n from customer where deleted_at is null group by 1`,
};
(async () => {
  const out = {};
  const c = await pool.connect();
  try {
    await c.query('BEGIN READ ONLY');
    for (const [k, q] of Object.entries(Q)) {
      try { await c.query('SAVEPOINT s'); out[k] = (await c.query(q)).rows; await c.query('RELEASE SAVEPOINT s'); }
      catch (e) { out[k] = { error: e.message }; await c.query('ROLLBACK TO SAVEPOINT s'); }
    }
    await c.query('ROLLBACK');
  } finally { c.release(); await pool.end(); }
  fs.writeFileSync(path.join(__dirname, 'forensic_c7_8_customer_rbac_conventions.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
