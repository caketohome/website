const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(__dirname, "../frontend/.env");
  const env = fs.readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    if (line.trim().startsWith("DATABASE_URL=")) {
      let val = line.trim().substring("DATABASE_URL=".length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env.DATABASE_URL = val;
      return val;
    }
  }
}
const dbUrl = loadEnv();
const { Pool } = require("../frontend/node_modules/pg");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && dbUrl.includes("supabase") ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 20000,
});

async function main() {
  const client = await pool.connect();
  const evidence = {};

  try {
    console.log("Connected to PostgreSQL. Running investigative queries...");

    // 1. Database Info
    const dbInfo = await client.query(`
      SELECT current_database() as db_name,
             current_user as user_name,
             version() as pg_version,
             current_setting('TIMEZONE') as timezone,
             NOW() as server_now;
    `);
    evidence.dbInfo = dbInfo.rows[0];

    // 2. Inspect 'order' table columns and sample
    const orderCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'order' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    evidence.orderColumns = orderCols.rows;

    // Check sample order row to see how items, amounts, status are stored
    const sampleOrder = await client.query(`
      SELECT id, display_id, status, total, subtotal, tax_total, discount_total, currency_code, 
             created_at, updated_at, metadata
      FROM public.order
      LIMIT 3;
    `);
    evidence.sampleOrders = sampleOrder.rows;

    // Order status breakdown and totals
    const orderStats = await client.query(`
      SELECT 
        status, 
        COUNT(*) as count, 
        SUM(total) as sum_total,
        SUM(subtotal) as sum_subtotal,
        SUM(tax_total) as sum_tax,
        SUM(discount_total) as sum_discount
      FROM public.order
      GROUP BY status;
    `);
    evidence.orderStats = orderStats.rows;

    // Total orders summary
    const orderTotalSummary = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total) as gross_total,
        SUM(subtotal) as gross_subtotal,
        SUM(tax_total) as gross_tax,
        SUM(discount_total) as gross_discount,
        MIN(created_at) as earliest_order,
        MAX(created_at) as latest_order
      FROM public.order;
    `);
    evidence.orderTotalSummary = orderTotalSummary.rows[0];

    // 3. Why order_item and order_line_item are 0 - let's check cart_line_item or where items live
    const lineItemTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%item%'
      ORDER BY table_name;
    `);
    evidence.itemTables = lineItemTables.rows.map(r => r.table_name);

    // Check if Medusa line_item table exists
    const lineItemRows = await client.query(`
      SELECT COUNT(*) as count FROM public.cart_line_item;
    `);
    evidence.cartLineItemCount = lineItemRows.rows[0].count;

    // Check if order items are in order.metadata or another table
    const orderWithItems = await client.query(`
      SELECT id, metadata->'items' as items_meta, metadata
      FROM public.order
      WHERE metadata IS NOT NULL
      LIMIT 2;
    `);
    evidence.orderMetadataSample = orderWithItems.rows;

    // 4. Exact Trial Balance
    const tbRes = await client.query(`
      SELECT 
        SUM(debit_amount) as grand_debit,
        SUM(credit_amount) as grand_credit,
        SUM(debit_amount) - SUM(credit_amount) as imbalance
      FROM public.accounting_voucher_line line
      JOIN public.accounting_voucher vch ON line.voucher_id = vch.id
      WHERE vch.status = 'POSTED' AND vch.is_deleted = false;
    `);
    evidence.trialBalance = tbRes.rows[0];

    // 5. Account Balances breakdown (including 1111, 1114, 1121, 1122, 5296)
    const keyAccountsRes = await client.query(`
      SELECT 
        line.account_code,
        COALESCE(chart.name, chart2.name, 'Unknown') as account_name,
        COALESCE(chart.type, chart2.type, 'Unknown') as account_type,
        SUM(line.debit_amount) as total_debit,
        SUM(line.credit_amount) as total_credit,
        SUM(line.debit_amount) - SUM(line.credit_amount) as net_debit_balance
      FROM public.accounting_voucher_line line
      JOIN public.accounting_voucher vch ON line.voucher_id = vch.id
      LEFT JOIN public.accounting_account chart ON line.account_code = chart.code
      LEFT JOIN public.accounting_account chart2 ON line.account_code = chart2.account_number
      WHERE vch.status = 'POSTED' AND vch.is_deleted = false
      GROUP BY line.account_code, chart.name, chart.type, chart2.name, chart2.type
      ORDER BY line.account_code;
    `);
    evidence.allPostedAccounts = keyAccountsRes.rows;

    // Line-by-line vouchers for 1111, 1114, 1121, 1122, 5296
    const lineDetails = await client.query(`
      SELECT 
        line.account_code,
        line.debit_amount,
        line.credit_amount,
        line.narration as line_narration,
        vch.id as voucher_id,
        vch.voucher_no,
        vch.branch_id,
        vch.status,
        vch.created_at,
        vch.narration as voucher_narration
      FROM public.accounting_voucher_line line
      JOIN public.accounting_voucher vch ON line.voucher_id = vch.id
      WHERE line.account_code IN ('1111', '1114', '1121', '1122', '5296', '2121', '2122', '2123', '4111')
        AND vch.status = 'POSTED' AND vch.is_deleted = false
      ORDER BY line.account_code, vch.created_at;
    `);
    evidence.voucherLineDetails = lineDetails.rows;

    // 6. Inspect delivery_cash_handover (all rows)
    const handoverCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'delivery_cash_handover' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    evidence.handoverColumns = handoverCols.rows;

    const handovers = await client.query(`
      SELECT *
      FROM public.delivery_cash_handover
      ORDER BY created_at ASC;
    `);
    evidence.allHandovers = handovers.rows;

    // 7. Check teller_movement and teller_session
    const tellerSessions = await client.query(`
      SELECT id, branch_id, teller_id, status, opening_balance, closing_balance, created_at, closed_at
      FROM public.teller_session
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    evidence.tellerSessionsSample = tellerSessions.rows;

    const tellerMovements = await client.query(`
      SELECT id, session_id, type, amount, created_at, description, reference_type, reference_id
      FROM public.teller_movement
      ORDER BY created_at DESC
      LIMIT 20;
    `);
    evidence.tellerMovementsSample = tellerMovements.rows;

    // 8. Output Tax and Sales accounts in accounting_account
    const revenueTaxAccounts = await client.query(`
      SELECT code, name, type, is_active, description
      FROM public.accounting_account
      WHERE code LIKE '212%' OR code LIKE '4%' OR code = '5296'
      ORDER BY code;
    `);
    evidence.revenueTaxAccounts = revenueTaxAccounts.rows;

    // 9. Inspect gst_registration
    const gstRegs = await client.query(`
      SELECT * FROM public.gst_registration;
    `);
    evidence.gstRegistrations = gstRegs.rows;

    // 10. Check for recipe / production / batch / yield tables
    const prodTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name ILIKE '%recipe%' 
             OR table_name ILIKE '%production%' 
             OR table_name ILIKE '%batch%' 
             OR table_name ILIKE '%yield%' 
             OR table_name ILIKE '%bom%')
      ORDER BY table_name;
    `);
    evidence.productionRelatedTables = prodTables.rows.map(r => r.table_name);

    // Save evidence to file
    fs.writeFileSync(path.resolve(__dirname, "investigation_evidence.json"), JSON.stringify(evidence, null, 2));
    console.log("Investigation complete! Evidence saved to scratch/investigation_evidence.json");

  } catch (err) {
    console.error("Query error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
