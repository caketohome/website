/**
 * Pass 2 / Step 1 — complete PostgreSQL baseline (v4).
 * Captures counts for every ERP-relevant table, GL totals, and
 * identifies pre-existing acceptance-test records (from Pass 1).
 */
const L = require('./lib');
const { q, save, num } = L;

(async () => {
  const out = { captured_at: new Date().toISOString() };

  const tables = (await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name`)).rows.map(r => r.table_name);
  out.all_tables = tables;

  const erpLike = tables.filter(t =>
    /^(order|invoice|payment|accounting_|inventory_|branch_inventory|gateway_|bank_|cod_|rider_|purchase|expense|customer|supplier|stock_|credit_note|debit_note|delivery|fiscal|order_status_history|journal|voucher|sales_|ar_|ap_)/.test(t));
  out.counts = {};
  for (const t of erpLike) {
    try {
      out.counts[t] = parseInt((await q(`SELECT COUNT(*) c FROM public."${t}"`)).rows[0].c, 10);
    } catch (e) { out.counts[t] = 'ERR ' + e.message.slice(0, 60); }
  }

  const gl = (await q(`SELECT COALESCE(SUM(debit_amount),0) d, COALESCE(SUM(credit_amount),0) c, COUNT(*) n FROM public.accounting_journal_line`)).rows[0];
  out.gl = { debit: num(gl.d), credit: num(gl.c), lines: parseInt(gl.n, 10), balanced: num(gl.d) === num(gl.c) };

  out.vouchers = (await q(`SELECT id, voucher_no, voucher_type, status, total_amount, reference_id, branch_id, created_by, approved_by, posted_by, created_at FROM public.accounting_voucher ORDER BY created_at`)).rows;
  out.invoice_columns = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='invoice' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  out.invoices = (await q(`SELECT * FROM public.invoice ORDER BY created_at`)).rows.map(r => { const o = { ...r }; for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object' && !(o[k] instanceof Date)) o[k] = '[json]'; return o; });
  out.journal_entries = (await q(`SELECT * FROM public.accounting_journal_entry ORDER BY created_at`)).rows
    .map(r => ({ id: r.id, voucher_id: r.voucher_id, entry_no: r.entry_no || r.entry_number, status: r.status, entry_date: r.entry_date, posted_by: r.posted_by }));
  out.journal_lines = (await q(`
    SELECT jl.journal_entry_id, jl.line_no, a.code, a.name, jl.debit_amount, jl.credit_amount
    FROM public.accounting_journal_line jl LEFT JOIN public.accounting_account a ON a.id = jl.account_id
    ORDER BY jl.journal_entry_id, jl.line_no`)).rows;
  out.fiscal_periods = (await q(`SELECT * FROM public.accounting_fiscal_period ORDER BY start_date`)).rows;

  // Orders — identify those created by acceptance runs (metadata/ids heuristics)
  out.order_status = (await q(`SELECT status, COUNT(*) n FROM public."order" GROUP BY status ORDER BY n DESC`)).rows;
  out.orders_total = parseInt((await q(`SELECT COUNT(*) c FROM public."order"`)).rows[0].c, 10);
  out.order_columns = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='order' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  out.orders_recent = (await q(`SELECT * FROM public."order" ORDER BY created_at DESC LIMIT 25`)).rows.map(r => { const o = {}; for (const k of Object.keys(r)) o[k] = (r[k] && typeof r[k] === 'object' && !(r[k] instanceof Date)) ? '[json]' : r[k]; return o; });

  out.suppliers = (await q(`SELECT * FROM public.supplier ORDER BY created_at`)).rows.map(r => { const o = {}; for (const k of Object.keys(r)) o[k] = (r[k] && typeof r[k] === 'object' && !(r[k] instanceof Date)) ? '[json]' : r[k]; return o; });
  out.branches_sample = (await q(`SELECT id, name FROM public.branch ORDER BY created_at LIMIT 8`)).rows;

  // Accounts used so far
  out.account_columns = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='accounting_account' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  out.account_codes = (await q(`SELECT * FROM public.accounting_account ORDER BY code`)).rows.map(r => ({ id: r.id, code: r.code, name: r.name, type: r.type || r.account_class || r.category || r.normal_balance, group: r.is_group, active: r.is_active }));

  save('00_db_baseline_v4.json', out);
  console.log('Tables:', tables.length);
  console.log('GL:', out.gl);
  console.log('Counts:', out.counts);
  console.log('Vouchers:', out.vouchers.length, 'Invoices:', out.invoices.length, 'JEs:', out.journal_entries.length, 'Lines:', out.journal_lines.length);
  console.log('Orders:', out.orders_total);
  console.log('Suppliers:', out.suppliers.length);
  await L.pool.end();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
