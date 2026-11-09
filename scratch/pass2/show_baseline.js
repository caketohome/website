const b = require('../../CHECKPOINTS/acceptance-test-evidence/pass-2/00_db_baseline_v4.json');
console.log(JSON.stringify({
  vouchers: b.vouchers.map(v => ({ no: v.voucher_no, type: v.voucher_type, st: v.status, amt: v.total_amount, ref: v.reference_id, cb: v.created_by, ab: v.approved_by, pb: v.posted_by })),
  invoices: b.invoices.map(i => ({ n: i.invoice_number, o: i.order_id, s: i.status, c: i.created_at })),
  jes: b.journal_entries,
  lines: b.journal_lines,
  fp: b.fiscal_periods,
  order_status: b.order_status,
  invoice_columns: b.invoice_columns,
  account_columns: b.account_columns,
  order_columns: b.order_columns,
}, null, 1));
