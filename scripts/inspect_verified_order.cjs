const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const client = new Client('postgresql://cth_test_user:8b58f6cb35e64015459917243b77e2794c57K9!@127.0.0.1:5433/cth_rehearsal_phase5');

async function main() {
  await client.connect();
  const orderId = 'ord_live_nb_1794401032340';
  
  const o = await client.query('SELECT id, display_id, status, payment_status, grand_total, updated_at FROM public."order" WHERE id = $1', [orderId]);
  console.log('ORDER:', o.rows[0]);

  const tx = await client.query('SELECT id, order_id, provider, gateway_order_id, gateway_payment_id, status, amount, updated_at FROM public.payment_transaction WHERE order_id = $1', [orderId]);
  console.log('TRANSACTIONS:', tx.rows);

  const v = await client.query('SELECT id, voucher_no, voucher_type, narration, total_amount, created_at FROM public.accounting_voucher WHERE reference_id = $1 OR narration ILIKE $2', [orderId, `%${orderId}%`]);
  console.log('VOUCHERS:', v.rows);

  if (v.rows.length > 0) {
    const lines = await client.query('SELECT account_code, account_name, debit_amount, credit_amount, line_description FROM public.accounting_journal_line WHERE voucher_id = $1', [v.rows[0].id]);
    console.log('JOURNAL LINES:', lines.rows);
  }

  // Also check total journal balance across entire database
  const bal = await client.query('SELECT COUNT(*) as line_count, SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM public.accounting_journal_line');
  console.log('ENTIRE DB JOURNAL BALANCE:', bal.rows[0]);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
