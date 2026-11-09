const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const client = new Client({ connectionString: match[1].trim(), ssl: { rejectUnauthorized: false } });

async function checkReferences() {
  await client.connect();
  console.log("=== CHECKING ALL DEPENDENT REFERENCES FOR DUPLICATE ORDERS ===\n");

  const dupOrderIds = [
    // 6 orders with CTH-20260828-101
    'ord_1787900766743_gtr5x',
    'ord_1787903174695_yztpv',
    'ord_1787907079251_3qx4x',
    'ord_1787909175508_8k2e5',
    'ord_1787910986723_tdtqa',
    'ord_1787921723978_3ibo9',
    // 2 orders with CTH-20260828-214
    'ord_1787895804793_jrmeg',
    'ord_1787898849846_nf6h0',
    // 13 orders with display_id 99991
    'ord_test_cod_1792216816562',
    'ord_test_cod_1792216866898',
    'ord_test_cod_1792217303420',
    'ord_test_cod_1792217567929',
    'ord_test_cod_1792218199553',
    'ord_test_cod_1792218268062',
    'ord_test_cod_1792218470807',
    'ord_test_cod_1792219136677',
    'ord_test_cod_1792219161849',
    'ord_test_cod_1792219239431',
    'ord_test_cod_1792219314509',
    'ord_test_cod_1792219412950',
    'ord_test_cod_1792220817636'
  ];

  // 1. Check invoices
  const invs = await client.query(`
    SELECT id, invoice_number, order_id, created_at 
    FROM public.invoice 
    WHERE order_id = ANY($1::text[])
  `, [dupOrderIds]);
  console.log("1. Invoices referencing these orders:", invs.rows);

  // 2. Check payment_transaction
  const ptxns = await client.query(`
    SELECT id, order_id, amount, status, settlement_status, created_at 
    FROM public.payment_transaction 
    WHERE order_id = ANY($1::text[])
  `, [dupOrderIds]);
  console.log(`2. Payment transactions referencing these orders: ${ptxns.rows.length} rows`);
  ptxns.rows.forEach(r => console.log(`   ptxn: ${r.id} -> order: ${r.order_id} (status: ${r.status}, amt: ${r.amount})`));

  // 3. Check delivery table
  const dels = await client.query(`
    SELECT id, transaction_id, delivery_status, recipient_name 
    FROM public.delivery 
    WHERE transaction_id = ANY($1::text[])
  `, [dupOrderIds]);
  console.log(`3. Delivery records referencing these orders: ${dels.rows.length} rows`);

  // 4. Check accounting vouchers
  const vchs = await client.query(`
    SELECT id, voucher_no, voucher_type, reference_id, reference_type 
    FROM public.accounting_voucher 
    WHERE reference_id = ANY($1::text[])
  `, [dupOrderIds]);
  console.log(`4. Accounting vouchers referencing these orders: ${vchs.rows.length} rows`);
  vchs.rows.forEach(r => console.log(`   voucher: ${r.voucher_no} (${r.id}) -> ref: ${r.reference_id}`));

  // 5. Check order status history
  const history = await client.query(`
    SELECT COUNT(*) as cnt 
    FROM public.order_status_history 
    WHERE order_id = ANY($1::text[])
  `, [dupOrderIds]);
  console.log(`5. Order status history entries: ${history.rows[0].cnt}`);

  // 6. Check order line items
  const items = await client.query(`
    SELECT COUNT(*) as cnt 
    FROM public.order_item 
    WHERE order_id = ANY($1::text[])
  `, [dupOrderIds]);
  console.log(`6. Order item entries: ${items.rows[0].cnt}`);

  // 7. Check how statutory_invoice_seq was used
  console.log("\n=== INVESTIGATING statutory_invoice_seq (last_value = 192) ===");
  const seqDetails = await client.query(`
    SELECT sequencename, last_value, start_value, increment_by FROM pg_sequences WHERE sequencename = 'statutory_invoice_seq';
  `);
  console.log("statutory_invoice_seq details:", seqDetails.rows[0]);

  // Check if any invoice numbers above 35 exist anywhere in order metadata or invoice table
  const metaInvs = await client.query(`
    SELECT id, metadata->>'invoice_number' as inv_num, metadata->>'order_number' as ord_num
    FROM public."order"
    WHERE metadata->>'invoice_number' IS NOT NULL;
  `);
  console.log("All orders with metadata.invoice_number:", metaInvs.rows);

  await client.end();
}

checkReferences().catch(console.error);
