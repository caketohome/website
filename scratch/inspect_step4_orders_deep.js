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

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const report = {};

  // 1. Order stats & status breakdown
  const orderStats = await client.query(`
    SELECT 
      count(*) as total_orders,
      min(created_at) as earliest_order,
      max(created_at) as latest_order,
      count(DISTINCT customer_id) as distinct_customers,
      count(DISTINCT currency_code) as distinct_currencies
    FROM public."order"
  `);
  report.order_stats = orderStats.rows[0];

  const orderStatuses = await client.query(`
    SELECT status, count(*) as count
    FROM public."order"
    GROUP BY status
  `);
  report.order_statuses = orderStatuses.rows;

  // 2. Order metadata breakdown
  const sampleOrders = await client.query(`
    SELECT id, display_id, customer_id, email, currency_code, status, is_draft_order, metadata, created_at
    FROM public."order"
    ORDER BY created_at DESC
    LIMIT 3
  `);
  report.sample_orders = sampleOrders.rows;

  // Check how many orders have items in metadata vs line items table
  const orderMetadataAnalysis = await client.query(`
    SELECT 
      count(*) FILTER (WHERE metadata IS NOT NULL) as has_metadata,
      count(*) FILTER (WHERE metadata->'items' IS NOT NULL) as has_items_in_meta,
      count(*) FILTER (WHERE metadata->'total' IS NOT NULL) as has_total_in_meta,
      count(*) FILTER (WHERE metadata->'tax_amount' IS NOT NULL) as has_tax_in_meta,
      count(*) FILTER (WHERE metadata->'branch_id' IS NOT NULL) as has_branch_in_meta,
      count(*) FILTER (WHERE metadata->'payment_status' IS NOT NULL) as has_pay_status_in_meta
    FROM public."order"
  `);
  report.order_metadata_analysis = orderMetadataAnalysis.rows[0];

  // 3. Line items tables: order_item, order_line_item, line_item
  const lineItemTables = ['order_item', 'order_line_item', 'line_item'];
  report.line_item_table_counts = {};
  for (const t of lineItemTables) {
    try {
      const r = await client.query(`SELECT count(*) FROM public."${t}"`);
      report.line_item_table_counts[t] = parseInt(r.rows[0].count, 10);
    } catch (e) {
      report.line_item_table_counts[t] = 'TABLE_NOT_FOUND';
    }
  }

  // 4. Payment transaction analysis
  const payStats = await client.query(`
    SELECT 
      count(*) as total_payments,
      min(created_at) as earliest_payment,
      max(created_at) as latest_payment,
      count(DISTINCT order_id) as distinct_order_ids,
      count(DISTINCT customer_id) as distinct_customers
    FROM public.payment_transaction
  `);
  report.payment_stats = payStats.rows[0];

  const payBreakdown = await client.query(`
    SELECT status, provider, settlement_status, count(*) as count, sum(amount) as total_amount
    FROM public.payment_transaction
    GROUP BY status, provider, settlement_status
    ORDER BY count DESC
  `);
  report.payment_breakdown = payBreakdown.rows;

  // Check how many payment_transactions link to valid orders
  const payOrderLink = await client.query(`
    SELECT 
      count(*) as total_payments,
      count(o.id) as matching_orders,
      count(*) FILTER (WHERE o.id IS NULL) as orphaned_payments
    FROM public.payment_transaction pt
    LEFT JOIN public."order" o ON pt.order_id = o.id
  `);
  report.payment_order_link = payOrderLink.rows[0];

  // 5. Output GST accounts in CoA
  const gstAccounts = await client.query(`
    SELECT code, name, type, is_group, parent_id
    FROM public.accounting_account
    WHERE code LIKE '212%'
    ORDER BY code ASC
  `);
  report.gst_output_accounts = gstAccounts.rows;

  // 6. Receivable accounts in CoA
  const arAccounts = await client.query(`
    SELECT code, name, type, is_group, parent_id
    FROM public.accounting_account
    WHERE code LIKE '112%'
    ORDER BY code ASC
  `);
  report.ar_accounts = arAccounts.rows;

  // 7. Check inventory_movement movement_type enum/check constraints
  const movConstraints = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.inventory_movement'::regclass
  `);
  report.movement_constraints = movConstraints.rows;

  // 8. Check inventory_cost_lot constraints
  const lotConstraints = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.inventory_cost_lot'::regclass
  `);
  report.lot_constraints = lotConstraints.rows;

  // 9. Check accounting_voucher voucher_type constraints
  const voucherConstraints = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.accounting_voucher'::regclass
  `);
  report.voucher_constraints = voucherConstraints.rows;

  // Write report to json
  fs.writeFileSync(path.join(__dirname, 'step4_forensic_deep_result.json'), JSON.stringify(report, null, 2));
  console.log('Forensic deep inspection written to scratch/step4_forensic_deep_result.json');

  await client.end();
}

run().catch(console.error);
