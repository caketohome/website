const { Client } = require('./node_modules/pg');
const c = new Client({ connectionString: process.env.PG_URL, ssl: { rejectUnauthorized: false } });

c.connect().then(async () => {
  // driver_profile columns
  const dp = await c.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_profile' ORDER BY ordinal_position");
  console.log('=== DRIVER_PROFILE COLUMNS ===');
  dp.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '|', r.is_nullable));
  const dpCount = await c.query("SELECT COUNT(*) FROM public.driver_profile");
  console.log('=== DRIVER_PROFILE ROWS ===', dpCount.rows[0].count);

  // driver_attendance columns
  const da = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_attendance' ORDER BY ordinal_position");
  console.log('=== DRIVER_ATTENDANCE COLUMNS ===');
  da.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '|', r.is_nullable));
  const daCount = await c.query("SELECT COUNT(*) FROM public.driver_attendance");
  console.log('=== DRIVER_ATTENDANCE ROWS ===', daCount.rows[0].count);

  // driver_location columns
  const dl = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_location' ORDER BY ordinal_position");
  console.log('=== DRIVER_LOCATION COLUMNS ===');
  dl.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '|', r.is_nullable));
  const dlCount = await c.query("SELECT COUNT(*) FROM public.driver_location");
  console.log('=== DRIVER_LOCATION ROWS ===', dlCount.rows[0].count);

  // driver_wallet + driver_transaction
  const dw = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_wallet' ORDER BY ordinal_position");
  console.log('=== DRIVER_WALLET COLUMNS ==='); dw.rows.forEach(r => console.log(r.column_name, '|', r.data_type));
  const dwCount = await c.query("SELECT COUNT(*) FROM public.driver_wallet");
  console.log('=== DRIVER_WALLET ROWS ===', dwCount.rows[0].count);

  const dt = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='driver_transaction' ORDER BY ordinal_position");
  console.log('=== DRIVER_TRANSACTION COLUMNS ==='); dt.rows.forEach(r => console.log(r.column_name, '|', r.data_type));
  const dtCount = await c.query("SELECT COUNT(*) FROM public.driver_transaction");
  console.log('=== DRIVER_TRANSACTION ROWS ===', dtCount.rows[0].count);

  // delivery_partner sample
  const dps = await c.query("SELECT * FROM public.delivery_partner LIMIT 3");
  console.log('=== DELIVERY_PARTNER SAMPLE ===');
  dps.rows.forEach(r => console.log(JSON.stringify(r)));

  // delivery_delivery_partner junction
  const ddp = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_delivery_partner' ORDER BY ordinal_position");
  console.log('=== DELIVERY_DELIVERY_PARTNER COLUMNS ==='); ddp.rows.forEach(r => console.log(r.column_name, '|', r.data_type));
  const ddpCount = await c.query("SELECT COUNT(*) FROM public.delivery_delivery_partner");
  console.log('=== DELIVERY_DELIVERY_PARTNER ROWS ===', ddpCount.rows[0].count);

  // driver_profile FKs + branch relationship
  const dpFks = await c.query(
    "SELECT kcu.column_name, ccu.table_name AS fk_table, ccu.column_name AS fk_col " +
    "FROM information_schema.table_constraints tc " +
    "JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema " +
    "LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema " +
    "WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY' AND tc.table_name='driver_profile'"
  );
  console.log('=== DRIVER_PROFILE FKs ===');
  dpFks.rows.forEach(r => console.log(r.column_name, '->', r.fk_table + '.' + r.fk_col));

  // branch table columns (for reference)
  const br = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='branch' ORDER BY ordinal_position");
  console.log('=== BRANCH KEY COLUMNS ==='); br.rows.slice(0,8).forEach(r => console.log(r.column_name, '|', r.data_type));

  // Check what FKs delivery_partner has
  const dpFks2 = await c.query(
    "SELECT kcu.column_name, ccu.table_name AS fk_table, ccu.column_name AS fk_col " +
    "FROM information_schema.table_constraints tc " +
    "JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema " +
    "LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema " +
    "WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY' AND tc.table_name='delivery_partner'"
  );
  console.log('=== DELIVERY_PARTNER FKs ===');
  dpFks2.rows.forEach(r => console.log(r.column_name, '->', r.fk_table + '.' + r.fk_col));

  await c.end(); process.exit(0);
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
