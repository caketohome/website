const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== EXTRACTING 13 DELIVERED UN-INVOICED ORDERS ===\n');

  // Query the 13 delivered orders without invoices
  const sql = `
    SELECT 
      o.id as order_id,
      o.order_number,
      o.display_id,
      o.status as order_status,
      o.customer_id,
      o.created_at,
      o.updated_at,
      o.metadata
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id
    WHERE o.deleted_at IS NULL
      AND o.metadata->>'delivery_status' = 'delivered'
      AND i.id IS NULL
    ORDER BY o.created_at ASC;
  `;

  const res = await client.query(sql);
  console.log(`Found ${res.rows.length} delivered orders without invoice in public.invoice.`);

  const detailedOrders = [];

  for (const ord of res.rows) {
    const meta = ord.metadata || {};

    // 1. Check if invoice exists by order_number or any other reference
    let existingInvoices = [];
    try {
      const invCheck = await client.query(`
        SELECT id, invoice_number, order_id, status, created_at, grand_total, voucher_id
        FROM public.invoice
        WHERE order_id = $1 
           OR invoice_number = $2
           OR metadata->>'order_number' = $2
           OR metadata->>'order_id' = $1
      `, [ord.order_id, ord.order_number]);
      existingInvoices = invCheck.rows;
    } catch (e) {
      console.warn('invCheck notice:', e.message);
    }

    // 2. Check if accounting vouchers exist
    let existingVouchers = [];
    try {
      const vchCheck = await client.query(`
        SELECT *
        FROM public.accounting_voucher
        WHERE reference_id = $1 
           OR reference_id = $2
           OR id = $3
           OR id = $4
      `, [ord.order_id, ord.order_number, meta.accounting_voucher_id || null, meta.voucher_id || null]);
      existingVouchers = vchCheck.rows;
    } catch (e) {
      console.warn('vchCheck notice:', e.message);
    }

    // 3. Check for refund or cancellation records
    let refundRecords = [];
    try {
      const refCheck = await client.query(`
        SELECT *
        FROM public.order_lifecycle_refund
        WHERE order_id = $1
      `, [ord.order_id]);
      refundRecords.push(...refCheck.rows);
    } catch (e) {
      console.warn('refCheck notice:', e.message);
    }

    try {
      const refCheck2 = await client.query(`
        SELECT *
        FROM public.refund
        WHERE metadata->>'order_id' = $1
      `, [ord.order_id]);
      refundRecords.push(...refCheck2.rows);
    } catch (e) {
      console.warn('refCheck2 notice:', e.message);
    }

    // 4. Check order items from DB
    let dbItems = [];
    try {
      const itemsCheck = await client.query(`
        SELECT oi.id, oi.quantity, oli.product_id, oli.variant_id, oli.title, oli.unit_price, oli.metadata
        FROM public.order_item oi
        JOIN public.order_line_item oli ON oli.id = oi.item_id
        WHERE oi.order_id = $1 AND oi.deleted_at IS NULL
      `, [ord.order_id]);
      dbItems = itemsCheck.rows;
    } catch (e) {
      console.warn('itemsCheck notice:', e.message);
    }

    // 5. Customer info
    let customerInfo = null;
    if (ord.customer_id) {
      try {
        const custRes = await client.query(`
          SELECT id, first_name, last_name, email, phone, metadata
          FROM public.customer
          WHERE id = $1
        `, [ord.customer_id]);
        if (custRes.rows.length > 0) customerInfo = custRes.rows[0];
      } catch (e) {
        console.warn('custRes notice:', e.message);
      }
    }

    // 6. Branch / Seller entity info
    const branchId = meta.branch_id || meta.compliance_snapshot?.branch_id || null;
    let branchInfo = null;
    if (branchId) {
      try {
        const brRes = await client.query(`
          SELECT id, name, code, metadata
          FROM public.branch
          WHERE id = $1
        `, [branchId]);
        if (brRes.rows.length > 0) branchInfo = brRes.rows[0];
      } catch (e) {
        console.warn('brRes notice:', e.message);
      }
    }

    detailedOrders.push({
      order_id: ord.order_id,
      order_number: ord.order_number,
      display_id: ord.display_id,
      order_status: ord.order_status,
      created_at: ord.created_at,
      updated_at: ord.updated_at,
      metadata: meta,
      existing_invoices: existingInvoices,
      existing_vouchers: existingVouchers,
      refund_records: refundRecords,
      db_items: dbItems,
      customer_info: customerInfo,
      branch_info: branchInfo
    });
  }

  const outPath = path.resolve(__dirname, 'remediation_batch_13_orders.json');
  fs.writeFileSync(outPath, JSON.stringify(detailedOrders, null, 2));

  console.log('Saved detailed forensic analysis of all 13 orders to', outPath);
  await client.end();
}

run().catch(console.error);
