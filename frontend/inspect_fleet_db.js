const { Client } = require('./node_modules/pg');
const c = new Client({ connectionString: process.env.PG_URL, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  // 1. All tables in public schema
  const tables = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('=== ALL TABLES ===');
  tables.rows.forEach(r => console.log(r.table_name));

  // 2. Delivery table columns
  const delCols = await c.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns " +
    "WHERE table_schema='public' AND table_name='delivery' ORDER BY ordinal_position"
  );
  console.log('=== DELIVERY COLUMNS ===');
  delCols.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '|', r.is_nullable));

  // 3. Any driver/vehicle/fleet/fuel related tables
  const fleetTables = tables.rows.filter(r =>
    ['driver','vehicle','fleet','fuel','trip','odometer','delivery_partner'].some(k => r.table_name.includes(k))
  );
  console.log('=== FLEET-RELATED TABLES ===');
  fleetTables.forEach(r => console.log(r.table_name));

  // 4. Delivery row count + sample
  const delCount = await c.query("SELECT COUNT(*) FROM public.delivery");
  console.log('=== DELIVERY ROW COUNT ===', delCount.rows[0].count);

  // 5. delivery_partner table check
  try {
    const dp = await c.query("SELECT COUNT(*) FROM public.delivery_partner");
    console.log('=== DELIVERY_PARTNER ROW COUNT ===', dp.rows[0].count);
    const dpCols = await c.query(
      "SELECT column_name, data_type FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name='delivery_partner' ORDER BY ordinal_position"
    );
    console.log('=== DELIVERY_PARTNER COLUMNS ===');
    dpCols.rows.forEach(r => console.log(r.column_name, '|', r.data_type));
  } catch(e) { console.log('delivery_partner: NOT FOUND'); }

  // 6. driver table check
  try {
    const drv = await c.query("SELECT COUNT(*) FROM public.driver");
    console.log('=== DRIVER ROW COUNT ===', drv.rows[0].count);
    const drvCols = await c.query(
      "SELECT column_name, data_type FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name='driver' ORDER BY ordinal_position"
    );
    console.log('=== DRIVER COLUMNS ===');
    drvCols.rows.forEach(r => console.log(r.column_name, '|', r.data_type));
  } catch(e) { console.log('driver: NOT FOUND'); }

  // 7. vehicle table check
  try {
    const veh = await c.query("SELECT COUNT(*) FROM public.vehicle");
    console.log('=== VEHICLE ROW COUNT ===', veh.rows[0].count);
    const vehCols = await c.query(
      "SELECT column_name, data_type FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name='vehicle' ORDER BY ordinal_position"
    );
    console.log('=== VEHICLE COLUMNS ===');
    vehCols.rows.forEach(r => console.log(r.column_name, '|', r.data_type));
  } catch(e) { console.log('vehicle: NOT FOUND'); }

  // 8. Sample delivery record structure
  const delSample = await c.query("SELECT * FROM public.delivery LIMIT 1");
  if (delSample.rows.length > 0) {
    console.log('=== DELIVERY SAMPLE KEYS ===');
    Object.keys(delSample.rows[0]).forEach(k => console.log(k, '=', JSON.stringify(delSample.rows[0][k])?.substring(0,60)));
  }

  // 9. Check FLEET permissions
  const staffCtl = await c.query(
    "SELECT * FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('staff_permission','permission','role_permission')"
  );
  console.log('=== PERMISSION TABLES IN DB ===');
  staffCtl.rows.forEach(r => console.log(r.table_name));

  // 10. Check analytics_expense is untouched
  const ae = await c.query("SELECT COUNT(*) FROM public.analytics_expense");
  console.log('=== ANALYTICS_EXPENSE ROWS (must be 0) ===', ae.rows[0].count);

  // 11. Existing FK relationships from delivery
  const fks = await c.query(
    "SELECT tc.table_name, kcu.column_name, ccu.table_name AS fk_table, ccu.column_name AS fk_col, rc.delete_rule " +
    "FROM information_schema.table_constraints tc " +
    "JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema " +
    "LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema " +
    "LEFT JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name " +
    "WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY' AND tc.table_name='delivery' " +
    "ORDER BY kcu.column_name"
  );
  console.log('=== DELIVERY FKs ===');
  fks.rows.forEach(r => console.log(r.column_name, '->', r.fk_table + '.' + r.fk_col, r.delete_rule));

  await c.end();
  process.exit(0);
}).catch(e => { console.error('DB Error:', e.message); process.exit(1); });
