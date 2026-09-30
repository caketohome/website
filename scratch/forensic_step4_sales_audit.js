/**
 * Forensic Inspection Script for Phase 4F Step 4:
 * Detailed inspection of historical orders (173), order items, payment transactions (53),
 * branch inventory (424), and sales/AR/COGS/GST chart of accounts.
 */
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

async function runForensicAudit() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL for Phase 4F Step 4 forensic audit...\n');

  try {
    // 1. Order table structure and sample
    console.log('=== 1. HISTORICAL ORDERS (173) AUDIT ===');
    const orderTablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name LIKE 'order%' OR table_name LIKE 'payment%')
      ORDER BY table_name
    `);
    console.log('Order & Payment tables in DB:');
    console.log(orderTablesRes.rows.map(r => `  - ${r.table_name}`).join('\n'));

    // Sample 2 complete order rows with metadata
    const sampleOrders = await client.query(`
      SELECT id, display_id, customer_id, email, currency_code, status, is_draft_order, metadata, created_at
      FROM public."order"
      LIMIT 2
    `);
    console.log('\nSample order rows:');
    console.log(JSON.stringify(sampleOrders.rows, null, 2));

    // Inspect metadata keys across all 173 orders
    const metaKeysRes = await client.query(`
      SELECT DISTINCT jsonb_object_keys(metadata) AS key
      FROM public."order"
      WHERE metadata IS NOT NULL
      ORDER BY key
    `);
    console.log('\nMetadata keys present in orders:');
    console.log(metaKeysRes.rows.map(r => `  - ${r.key}`).join('\n'));

    // Check if branch_id is in metadata
    const branchMetaRes = await client.query(`
      SELECT metadata->>'branch_id' AS branch_id, metadata->>'branch_name' AS branch_name, count(*) AS count
      FROM public."order"
      GROUP BY metadata->>'branch_id', metadata->>'branch_name'
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\nBranch in order metadata (top 10):');
    console.table(branchMetaRes.rows);

    // 2. Order items / line items inspection
    console.log('\n=== 2. ORDER LINE ITEMS AUDIT ===');
    // Check which item table exists: order_item, order_line_item, line_item
    for (const t of ['order_item', 'order_line_item', 'line_item']) {
      const exists = orderTablesRes.rows.some(r => r.table_name === t);
      if (exists) {
        const countRes = await client.query(`SELECT count(*) FROM public."${t}"`);
        console.log(`Table public."${t}" exists with ${countRes.rows[0].count} rows.`);
        const cols = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = '${t}' AND table_schema = 'public'
          ORDER BY ordinal_position
        `);
        console.log(`Columns for ${t}:`, cols.rows.map(c => c.column_name).join(', '));

        const sample = await client.query(`SELECT * FROM public."${t}" LIMIT 2`);
        console.log(`Sample from ${t}:`, JSON.stringify(sample.rows, null, 2));
      }
    }

    // 3. Payment transactions inspection
    console.log('\n=== 3. PAYMENT TRANSACTIONS (53) AUDIT ===');
    const payColsRes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payment_transaction' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Payment transaction columns:');
    console.log(payColsRes.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

    const paySample = await client.query(`
      SELECT * FROM public.payment_transaction LIMIT 5
    `);
    console.log('\nSample payment_transaction rows:');
    console.log(JSON.stringify(paySample.rows, null, 2));

    const payAgg = await client.query(`
      SELECT 
        count(*) AS total_txns,
        status,
        provider,
        settlement_status,
        sum(amount) AS sum_amount,
        min(created_at) AS earliest_tx,
        max(created_at) AS latest_tx
      FROM public.payment_transaction
      GROUP BY status, provider, settlement_status
      ORDER BY total_txns DESC
    `);
    console.log('\nPayment transactions summary:');
    console.table(payAgg.rows);

    // Inspect items inside order.metadata
    const sampleOrderWithItems = await client.query(`
      SELECT id, display_id, metadata->'items' AS items, metadata->'total' AS total, metadata->'subtotal' AS subtotal, metadata->'tax_amount' AS tax, metadata->'payment_method' AS pay_method, metadata->'payment_status' AS pay_status, metadata->'branch_id' AS branch_id
      FROM public."order"
      WHERE metadata->'items' IS NOT NULL
      LIMIT 2
    `);
    console.log('\nSample order with metadata items:');
    console.log(JSON.stringify(sampleOrderWithItems.rows, null, 2));

    // Check payment tables
    const payCollRes = await client.query(`SELECT count(*) FROM public.payment_collection`);
    console.log(`\nTable payment_collection has ${payCollRes.rows[0].count} rows.`);

    // 4. Chart of Accounts Audit (Sales, AR, COGS, Output GST, Clearing)
    console.log('\n=== 4. CHART OF ACCOUNTS FOR SALES / AR / COGS / GST ===');
    const coaRes = await client.query(`
      SELECT code, name, type, is_group, parent_id
      FROM public.accounting_account
      WHERE code LIKE '111%' OR code LIKE '112%' OR code LIKE '113%' OR code LIKE '211%' OR code LIKE '213%' OR code LIKE '4%' OR code LIKE '51%' OR code LIKE '52%'
      ORDER BY code ASC
    `);
    console.table(coaRes.rows);

    // 5. Cost Lot & Inventory Schema Check
    console.log('\n=== 5. COST LOT & MOVEMENT SCHEMA CHECK ===');
    const lotCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'inventory_cost_lot' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('inventory_cost_lot columns:');
    console.log(lotCols.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

    const consCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'inventory_cost_consumption' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\ninventory_cost_consumption columns:');
    console.log(consCols.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

    const movCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'inventory_movement' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\ninventory_movement columns:');
    console.log(movCols.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

  } catch (err) {
    console.error('Forensic inspection error:', err);
  } finally {
    await client.end();
  }
}

runForensicAudit();
