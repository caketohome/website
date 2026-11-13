const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const client = new Client('postgresql://cth_test_user:8b58f6cb35e64015459917243b77e2794c57K9!@127.0.0.1:5433/cth_rehearsal_phase5');

async function main() {
  await client.connect();

  console.log('=== LATEST JOURNAL ENTRIES ===');
  const entries = await client.query(`
    SELECT id, entry_no, entry_date, voucher_id, total_debit, total_credit, narration, created_at
    FROM public.accounting_journal_entry
    ORDER BY created_at DESC LIMIT 5
  `);
  console.log(entries.rows);

  if (entries.rows.length > 0) {
    const latestEntry = entries.rows[0];
    console.log('\n=== LINES FOR LATEST ENTRY ===', latestEntry.id);
    const lines = await client.query(`
      SELECT l.id, l.line_no, l.account_id, a.code as account_code, a.name as account_name, l.debit_amount, l.credit_amount, l.narration
      FROM public.accounting_journal_line l
      JOIN public.accounting_account a ON a.id = l.account_id
      WHERE l.journal_entry_id = $1
      ORDER BY l.line_no ASC
    `, [latestEntry.id]);
    console.log(lines.rows);
  }

  console.log('\n=== TOTAL ACCOUNTING JOURNAL BALANCE ACROSS WHOLE DB ===');
  const bal = await client.query(`
    SELECT 
      COUNT(*) as total_lines,
      SUM(debit_amount) as total_debit,
      SUM(credit_amount) as total_credit,
      ROUND(SUM(debit_amount) - SUM(credit_amount), 4) as discrepancy
    FROM public.accounting_journal_line
  `);
  console.log(bal.rows[0]);

  console.log('\n=== ORDER STATE ===');
  const ord = await client.query(`
    SELECT id, display_id, status, payment_status, payment_method, grand_total, updated_at
    FROM public."order"
    WHERE id = 'ord_live_nb_1794401032340'
  `);
  console.log(ord.rows[0]);

  console.log('\n=== PAYMENT TRANSACTION ===');
  const tx = await client.query(`
    SELECT id, order_id, provider, gateway_order_id, gateway_payment_id, status, amount, updated_at
    FROM public.payment_transaction
    WHERE order_id = 'ord_live_nb_1794401032340'
  `);
  console.log(tx.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

