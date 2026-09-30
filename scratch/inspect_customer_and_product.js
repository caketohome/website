const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../frontend/node_modules/pg'));

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return 'postgresql://postgres:postgres@localhost:5432/caketohome';
}

async function inspect() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('--- CUSTOMERS ---');
  const custCount = await client.query('SELECT count(*) FROM public.customer');
  console.log('Customer count:', custCount.rows[0].count);
  const custCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'customer' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('Customer columns:', custCols.rows.map(c => c.column_name).join(', '));
  const sampleCust = await client.query('SELECT id, email, first_name, last_name, phone FROM public.customer LIMIT 3');
  console.log('Sample customers:', sampleCust.rows);

  console.log('\n--- ORDER CUSTOMER IDS IN HISTORICAL ORDERS ---');
  const ordCust = await client.query(`
    SELECT 
      customer_id, 
      count(*) as order_count,
      min(email) as sample_email,
      min(metadata->>'customer_name') as sample_name
    FROM public."order"
    GROUP BY customer_id
    ORDER BY order_count DESC
    LIMIT 10
  `);
  console.table(ordCust.rows);

  console.log('\n--- PRODUCT CLASSIFICATIONS & GST RATES ---');
  const prodStats = await client.query(`
    SELECT 
      metadata->'pim_config'->>'inventory_mode' as inventory_mode,
      metadata->>'category_slug' as category_slug,
      COALESCE(metadata->>'gst_rate', '0') as gst_rate,
      count(*) as count
    FROM public.product
    WHERE deleted_at IS NULL
    GROUP BY 
      metadata->'pim_config'->>'inventory_mode',
      metadata->>'category_slug',
      COALESCE(metadata->>'gst_rate', '0')
    ORDER BY count DESC
  `);
  console.table(prodStats.rows);

  console.log('\n--- BRANCH MASTER ---');
  const branchCount = await client.query('SELECT count(*) FROM public.branch');
  console.log('Branch count:', branchCount.rows[0].count);
  const branchCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'branch' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('Branch columns:', branchCols.rows.map(c => c.column_name).join(', '));
  const sampleBranch = await client.query('SELECT id, name, code, is_open, metadata FROM public.branch LIMIT 3');
  console.log('Sample branches:', JSON.stringify(sampleBranch.rows, null, 2));

  await client.end();
}

inspect().catch(console.error);
