// Read-only GST data probe. Prints only tax-relevant fields (no customer names/phones, no secrets).
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
function conn() {
  for (const p of ['../.env.local', '../.env']) {
    const f = path.join(__dirname, p);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (t.startsWith('DATABASE_URL=')) return t.slice(13).replace(/^["']|["']$/g, '');
    }
  }
}
(async () => {
  const c = new Client({ connectionString: conn(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN READ ONLY');
  const q = async (label, sql) => {
    await c.query('SAVEPOINT s');
    try { const r = await c.query(sql); console.log(`\n## ${label} (${r.rows.length})`); for (const row of r.rows) console.log(JSON.stringify(row)); await c.query('RELEASE SAVEPOINT s'); }
    catch (e) { console.log(`\n## ${label} ERROR: ${e.message}`); await c.query('ROLLBACK TO SAVEPOINT s'); }
  };
  await q('GST CoA accounts', `SELECT * FROM accounting_account WHERE name ILIKE '%GST%' OR name ILIKE '%cess%' OR code LIKE '212%' OR code LIKE '114%' ORDER BY code`);
  await q('accounting_account columns', `SELECT column_name FROM information_schema.columns WHERE table_name='accounting_account' ORDER BY ordinal_position`);
  await q('Vouchers', `SELECT id, voucher_no, voucher_type, voucher_date, status, total_amount, reference_type, reference_event, branch_id, fiscal_year, (SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(metadata,'{}'::jsonb)) k) meta_keys FROM accounting_voucher ORDER BY voucher_date, voucher_no`);
  await q('Journal lines on GST accounts', `SELECT je.entry_no, je.voucher_id, a.code, a.name, jl.debit_amount, jl.credit_amount FROM accounting_journal_line jl JOIN accounting_account a ON a.id=jl.account_id JOIN accounting_journal_entry je ON je.id=jl.journal_entry_id WHERE a.name ILIKE '%GST%' ORDER BY je.entry_no`);
  await q('All journal lines', `SELECT je.entry_no, je.posting_date, a.code, jl.debit_amount, jl.credit_amount FROM accounting_journal_line jl JOIN accounting_account a ON a.id=jl.account_id JOIN accounting_journal_entry je ON je.id=jl.journal_entry_id ORDER BY je.entry_no, jl.line_no`).catch(e => console.log('journal err', e.message));
  await q('Invoices (tax fields only)', `SELECT id, invoice_number, order_id, branch_id, status, delivered_at, subtotal, tax_total, delivery_fee, discount_total, grand_total, voucher_id, is_corporate, metadata->>'seller_gstin' seller_gstin, metadata->>'seller_state_code' seller_state_code, metadata->>'customer_state' customer_state, metadata->>'supply_type' supply_type, metadata->>'is_intra_state' intra, jsonb_array_length(COALESCE(metadata->'items','[]'::jsonb)) n_items, metadata->'items'->0 first_item FROM invoice ORDER BY delivered_at`);
  await q('Expense (tax fields)', `SELECT id, branch_id, expense_date, status, taxable_value, cgst, sgst, igst, total, itc_eligibility, rcm_applicable, hsn_sac_code, vendor_gstin IS NOT NULL has_vendor_gstin, voucher_id FROM expense`);
  await q('Expense itc check', `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.expense'::regclass AND contype='c'`);
  await q('Marketplace partner invoices', `SELECT id, partner_id, partner_invoice_number, status, claimed_amount, created_at FROM marketplace_partner_invoice`);
  await q('Branch columns', `SELECT column_name FROM information_schema.columns WHERE table_name='branch' AND (column_name ILIKE '%gst%' OR column_name ILIKE '%state%' OR column_name ILIKE '%company%')`);
  await q('Product HSN columns', `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND (column_name ILIKE '%hsn%' OR column_name ILIKE '%sac%') ORDER BY 1`);
  await q('voucher unique idx', `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='accounting_voucher'`);
  await q('sequences', `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' AND sequence_name ILIKE '%invoice%'`);
  await c.query('ROLLBACK');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
