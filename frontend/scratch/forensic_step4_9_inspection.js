const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
    }
  }
  const frontendEnv = path.join(__dirname, '../.env.local');
  if (fs.existsSync(frontendEnv)) {
    const envContent = fs.readFileSync(frontendEnv, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) return line.substring('DATABASE_URL='.length).trim();
    }
  }
  throw new Error("No database connection string found");
}

async function run() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();

  console.log('=== 1. ALL TABLES IN PUBLIC SCHEMA ===');
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Total public tables: ${tables.length}`);
  console.log(tables.join(', '));

  console.log('\n=== 2. MATCHED TABLES (delivery, rider, driver, fleet, trip, cod, cash, receipt, settle, remit) ===');
  const matched = tables.filter(t => /delivery|rider|driver|fleet|trip|cod|cash|receipt|settle|remit/i.test(t));
  console.log('Matched tables:', matched);

  for (const t of matched) {
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.log(`\nColumns for ${t}:`);
    colRes.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`));

    const countRes = await client.query(`SELECT count(*) FROM "${t}"`);
    console.log(`  Row count: ${countRes.rows[0].count}`);
  }

  console.log('\n=== 3. ORDER TABLE COLUMNS ===');
  const orderCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order'
    ORDER BY ordinal_position;
  `);
  orderCols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`));

  console.log('\n=== 4. PAYMENT_TRANSACTION TABLE COLUMNS ===');
  const paymentCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transaction'
    ORDER BY ordinal_position;
  `);
  paymentCols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`));

  console.log('\n=== 5. INSPECTION OF ORDER METADATA FOR DELIVERY / RIDER / COD KEYS ===');
  const orderMetadataKeysRes = await client.query(`
    SELECT DISTINCT jsonb_object_keys(metadata) as k
    FROM "order"
    WHERE metadata IS NOT NULL;
  `);
  console.log('Order metadata keys:', orderMetadataKeysRes.rows.map(r => r.k));

  console.log('\n=== 6. CHECK FOR RIDER / DRIVER / DELIVERY FIELDS IN ORDER METADATA ===');
  const deliveryKeysRes = await client.query(`
    SELECT id, status, 
           metadata->>'payment_status' as payment_status, 
           metadata->>'payment_method' as payment_method,
           metadata->>'delivery_type' as delivery_type,
           metadata->>'delivery_partner_id' as delivery_partner_id,
           metadata->>'delivery_partner_name' as delivery_partner_name,
           metadata->>'rider_id' as rider_id,
           metadata->>'driver_id' as driver_id,
           metadata->>'delivery' as delivery_meta,
           metadata->>'pickup_otp' as pickup_otp,
           metadata->>'delivery_otp' as delivery_otp,
           metadata->>'delivery_address' as delivery_address
    FROM "order"
    LIMIT 10;
  `);
  console.log('Sample order delivery metadata fields:');
  console.log(JSON.stringify(deliveryKeysRes.rows, null, 2));

  console.log('\n=== 7. PAYMENT TRANSACTION METHODS & STATUSES ===');
  const ptDist = await client.query(`
    SELECT provider, status, settlement_status, count(*) 
    FROM payment_transaction 
    GROUP BY provider, status, settlement_status;
  `);
  console.log('Payment transaction breakdown:', ptDist.rows);

  console.log('\n=== 8. HISTORICAL COD ORDERS IN ORDER TABLE ===');
  const codOrdersRes = await client.query(`
    SELECT count(*), 
           count(*) FILTER (WHERE metadata->>'delivery_address' IS NOT NULL) as has_address,
           count(*) FILTER (WHERE metadata->>'delivery_partner_id' IS NOT NULL) as has_partner_id,
           count(*) FILTER (WHERE metadata->>'rider_id' IS NOT NULL) as has_rider_id,
           count(*) FILTER (WHERE metadata->>'driver_id' IS NOT NULL) as has_driver_id
    FROM "order"
    WHERE metadata->>'payment_method' ILIKE '%cod%'
       OR metadata->>'payment_mode' ILIKE '%cod%';
  `);
  console.log('COD order stats:', codOrdersRes.rows[0]);

  console.log('\n=== 9. FLEET / VEHICLE / TRIP ROWS ===');
  if (tables.includes('vehicle')) {
    const vRes = await client.query('SELECT count(*) FROM vehicle');
    console.log('Vehicle count:', vRes.rows[0].count);
    const sampleV = await client.query('SELECT * FROM vehicle LIMIT 3');
    console.log('Sample vehicle:', sampleV.rows);
  }
  if (tables.includes('vehicle_trip')) {
    const vtRes = await client.query('SELECT count(*) FROM vehicle_trip');
    console.log('Vehicle trip count:', vtRes.rows[0].count);
    if (parseInt(vtRes.rows[0].count) > 0) {
      const sampleVt = await client.query('SELECT * FROM vehicle_trip LIMIT 3');
      console.log('Sample vehicle_trip:', sampleVt.rows);
    }
  }
  if (tables.includes('fleet_report')) {
    const frRes = await client.query('SELECT count(*) FROM fleet_report');
    console.log('Fleet report count:', frRes.rows[0].count);
  }

  console.log('\n=== 10. BRANCH TABLE COLUMNS (Cash management / branch cash registers) ===');
  const branchCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branch'
    ORDER BY ordinal_position;
  `);
  branchCols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`));

  console.log('\n=== 11. CHECK COA FOR 1111, 1112, 1113, 1121, 1122 ===');
  const coaRes = await client.query(`
    SELECT code, name, type, is_active
    FROM accounting_account
    WHERE code IN ('1111', '1112', '1113', '1121', '1122', '1114')
    ORDER BY code;
  `);
  console.log('Cash & Receivables CoA:', coaRes.rows);

  console.log('\n=== 12. CHECK DRIVER PROFILE ROWS ===');
  const dpRes = await client.query('SELECT count(*) FROM driver_profile');
  console.log('driver_profile count:', dpRes.rows[0].count);

  console.log('\n=== 13. CHECK DRIVER WALLET ROWS ===');
  const dwRes = await client.query('SELECT count(*) FROM driver_wallet');
  console.log('driver_wallet count:', dwRes.rows[0].count);

  console.log('\n=== 14. CHECK DRIVER TRANSACTION ROWS ===');
  const dtRes = await client.query('SELECT count(*) FROM driver_transaction');
  console.log('driver_transaction count:', dtRes.rows[0].count);

  console.log('\n=== 15. CHECK ALL ORDERS WITH METADATA->DELIVERY ===');
  const ordersWithDelivery = await client.query(`
    SELECT id, 
           metadata->>'payment_method' as payment_method,
           metadata->>'payment_status' as payment_status,
           metadata->'delivery' as delivery_meta
    FROM "order"
    WHERE metadata->'delivery' IS NOT NULL 
      AND metadata->'delivery' != '{}'::jsonb;
  `);
  console.log(`Orders with delivery metadata: ${ordersWithDelivery.rows.length}`);
  ordersWithDelivery.rows.forEach(r => {
    console.log(`Order ${r.id} (${r.payment_method}, ${r.payment_status}):`, r.delivery_meta);
  });

  console.log('\n=== 16. CHECK PARTNER, USER, STAFF TABLES ===');
  const partnerTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%partner%'");
  console.log('Partner tables:', partnerTables.rows.map(r => r.table_name));

  const userTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%user%'");
  console.log('User tables:', userTables.rows.map(r => r.table_name));

  const staffTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%staff%'");
  console.log('Staff tables:', staffTables.rows.map(r => r.table_name));

  const authTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name ILIKE '%auth%' OR table_name ILIKE '%role%')");
  console.log('Auth/Role tables:', authTables.rows.map(r => r.table_name));

  if (userTables.rows.some(r => r.table_name === 'user')) {
    const userCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user'");
    console.log('user columns:', userCols.rows.map(r => `${r.column_name} (${r.data_type})`));
  }

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
