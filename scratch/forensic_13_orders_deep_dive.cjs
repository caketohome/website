const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

const DB_URL = '[REDACTED_DATABASE_CREDENTIAL]';

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== FORENSIC DEEP-DIVE: 13 HISTORICAL COD ORDERS ===\n');

  // 1. Fetch the 13 orders
  const ordersRes = await client.query(`
    SELECT *
    FROM public."order"
    WHERE id LIKE 'ord_test_cod_%'
    ORDER BY created_at ASC
  `);

  console.log(`Total orders found: ${ordersRes.rowCount}`);

  const orderIds = ordersRes.rows.map(o => o.id);
  const report = [];

  for (let i = 0; i < ordersRes.rows.length; i++) {
    const o = ordersRes.rows[i];
    const total = o.metadata?.total || o.total_amount || 350;
    const items = o.metadata?.items || [];
    const customer = o.metadata?.customer || {};
    const delivery = o.metadata?.delivery || {};
    const voucherId = o.metadata?.settlement_voucher_id || null;

    // Check if invoice exists
    const invRes = await client.query('SELECT * FROM public.invoice WHERE order_id = $1', [o.id]);
    
    // Check if voucher exists in accounting or cash tables
    let voucherData = null;
    if (voucherId) {
      const vRes = await client.query('SELECT * FROM public.accounting_voucher WHERE id = $1', [voucherId]);
      if (vRes.rowCount > 0) voucherData = vRes.rows[0];
    }

    report.push({
      index: i + 1,
      id: o.id,
      order_number: o.order_number,
      created_at: o.created_at,
      status: o.status,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      branch_id: o.branch_id,
      delivery_partner_id: o.delivery_partner_id,
      pickup_verified_at: o.pickup_verified_at,
      delivered_at: o.delivered_at,
      total: Number(total),
      items_count: items.length,
      items_summary: items.map(it => `${it.title || it.name || 'Item'} (x${it.quantity || 1}) @ ₹${it.price || it.unit_price || 350}`).join(', '),
      customer_id: o.customer_id,
      customer_name: customer.name || o.customer_name || 'N/A',
      customer_phone: customer.phone || o.customer_phone || 'N/A',
      delivery_address: delivery.address || o.delivery_address || 'N/A',
      has_invoice: invRes.rowCount > 0,
      invoice_number: invRes.rows[0]?.invoice_number || null,
      settlement_voucher_id: voucherId,
      settlement_voucher_found_in_db: Boolean(voucherData),
    });
  }

  console.log(JSON.stringify(report, null, 2));

  // Totals summary
  const totalAmount = report.reduce((sum, r) => sum + r.total, 0);
  const ordersWithVoucher = report.filter(r => r.settlement_voucher_id).length;
  const ordersWithInvoice = report.filter(r => r.has_invoice).length;

  console.log('\n=== RECONCILIATION SUMMARY ===');
  console.log(`Aggregate Face Value: ₹${totalAmount.toFixed(2)}`);
  console.log(`Orders with Settlement Voucher: ${ordersWithVoucher} / ${report.length}`);
  console.log(`Orders with Statutory Invoice: ${ordersWithInvoice} / ${report.length}`);

  // Check public.invoice_sequence
  const seqRes = await client.query('SELECT * FROM public.invoice_sequence');
  console.log('\n=== INVOICE SEQUENCE WATERMARK ===');
  console.log(JSON.stringify(seqRes.rows, null, 2));

  // Check public.company
  const compRes = await client.query('SELECT * FROM public.company');
  console.log('\n=== COMPANY MASTER ===');
  console.log(JSON.stringify(compRes.rows, null, 2));

  // Check public.gst_registration
  const gstRes = await client.query('SELECT * FROM public.gst_registration');
  console.log('\n=== GST REGISTRATIONS ===');
  console.log(JSON.stringify(gstRes.rows, null, 2));

  // Check public.setting (accounting_start_date)
  const setRes = await client.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date'");
  console.log('\n=== ACCOUNTING START DATE SETTING ===');
  console.log(JSON.stringify(setRes.rows, null, 2));

  // Check journal entries causing lock
  const jRes = await client.query(`
    SELECT *
    FROM public.accounting_journal_entry
    ORDER BY created_at ASC
    LIMIT 5
  `);
  console.log('\n=== SAMPLE JOURNAL ENTRIES (Out of 56) ===');
  console.log(JSON.stringify(jRes.rows, null, 2));

  fs.writeFileSync(
    path.resolve(__dirname, 'forensic_13_orders_report.json'),
    JSON.stringify({ report, summary: { totalAmount, ordersWithVoucher, ordersWithInvoice }, sequence: seqRes.rows[0], company: compRes.rows, gst: gstRes.rows, setting: setRes.rows[0] }, null, 2)
  );

  await client.end();
}

main().catch(console.error);
