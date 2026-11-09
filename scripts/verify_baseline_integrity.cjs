const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const crypto = require('crypto');

async function checkBaseline() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_test'
  });
  await client.connect();

  const getCols = async (tbl) => {
    const res = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tbl]);
    return res.rows.map(r => r.column_name);
  };

  const orderCols = await getCols('order');
  const invoiceCols = await getCols('invoice');
  const voucherCols = await getCols('accounting_voucher');

  console.log('Order columns:', orderCols);
  console.log('Invoice columns:', invoiceCols);
  console.log('Voucher columns:', voucherCols);

  const counts = await client.query(`
    SELECT 
      (SELECT count(*) FROM public."order") as orders,
      (SELECT count(*) FROM public.invoice) as invoices,
      (SELECT count(*) FROM public.accounting_voucher) as vouchers,
      (SELECT count(*) FROM public.payment_transaction) as payments,
      (SELECT count(*) FROM public.product) as products
  `);

  // Hash the entire rows of order, invoice, and accounting_voucher
  const orderRows = await client.query('SELECT * FROM public."order" ORDER BY id');
  const invoiceRows = await client.query('SELECT * FROM public.invoice ORDER BY id');
  const voucherRows = await client.query('SELECT * FROM public.accounting_voucher ORDER BY id');

  const orderHash = crypto.createHash('sha256').update(JSON.stringify(orderRows.rows)).digest('hex');
  const invoiceHash = crypto.createHash('sha256').update(JSON.stringify(invoiceRows.rows)).digest('hex');
  const voucherHash = crypto.createHash('sha256').update(JSON.stringify(voucherRows.rows)).digest('hex');

  const baselineFingerprint = {
    database: 'cth_test',
    port: 5433,
    counts: counts.rows[0],
    hashes: {
      orders_sha256: orderHash,
      invoices_sha256: invoiceHash,
      vouchers_sha256: voucherHash
    },
    verified_at: new Date().toISOString()
  };

  console.log('BASELINE_FINGERPRINT_RESULT:\n' + JSON.stringify(baselineFingerprint, null, 2));
  await client.end();
  return baselineFingerprint;
}

checkBaseline().catch(console.error);
