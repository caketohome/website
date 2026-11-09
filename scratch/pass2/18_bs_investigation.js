/** Pass 2 / BS investigation — reproduce Balance Sheet independently from journal lines. */
const L = require('./lib');
const { q, api, signJWT, num, save } = L;

const ADMIN = signJWT({ userId: 'admin_01', role: 'SUPER_ADMIN', phone: '9999999999', branchId: 'br_01KYWH9YFVV5AK15D6313HB1NC' });

(async () => {
  const out = {};
  const rows = (await q(`
    SELECT a.code, a.name, a.type, a.subtype, p.code AS parent_code, a.is_group,
           COALESCE(SUM(jl.debit_amount),0) dr, COALESCE(SUM(jl.credit_amount),0) cr
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account a ON a.id = jl.account_id
    LEFT JOIN public.accounting_account p ON p.id = a.parent_id
    GROUP BY a.code, a.name, a.type, a.subtype, p.code, a.is_group ORDER BY a.code`)).rows;
  out.sql_balances = rows;
  console.log('SQL balances (accounts with activity):', JSON.stringify(rows));

  const hier = (await q(`
    SELECT a.code, a.name, a.type, a.is_group, p.code AS parent_code, a.level
    FROM public.accounting_account a LEFT JOIN public.accounting_account p ON p.id = a.parent_id
    WHERE a.code ~ '^(11|15|21|25|3|4|5)' ORDER BY a.code`)).rows;
  out.hierarchy = hier;
  console.log('Hierarchy:');
  hier.forEach(h => console.log(`  ${h.code} ${h.name} [${h.type}] group=${h.is_group} parent=${h.parent_code}`));

  const jeCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='accounting_journal_entry' ORDER BY ordinal_position`)).rows.map(r=>r.column_name);
  console.log('JE cols:', jeCols.join(','));
  out.je_cols = jeCols;

  for (const asOf of ['2026-10-02', '2026-10-03', '2026-10-31', '2027-03-31']) {
    const r = await api('GET', `/api/v1/admin/accounting/balance-sheet?as_of_date=${asOf}`, { token: ADMIN });
    out['bs_' + asOf] = r;
    const d = r.data || {};
    console.log(`BS ${asOf}: HTTP ${r.status} summary=`, JSON.stringify(d.summary), 'recon=', JSON.stringify(d.reconciliation));
  }
  const bs = out['bs_2026-10-31'].data;
  if (bs && bs.sections) {
    console.log('CA categories:', JSON.stringify(bs.sections.current_assets.categories.map(c => [c.group_code, c.subtotal, c.accounts.map(a => a.code + ':' + a.amount)])));
    console.log('Equity:', JSON.stringify(bs.sections.equity));
  }
  for (const rng of [['2026-10-01','2026-10-31'], ['2026-04-01','2027-03-31']]) {
    const r = await api('GET', `/api/v1/admin/accounting/profit-loss?start_date=${rng[0]}&end_date=${rng[1]}`, { token: ADMIN });
    out['pl_' + rng.join('_')] = r;
    console.log(`P&L ${rng}: HTTP ${r.status}`, JSON.stringify(r.data && (r.data.summary || r.data.totals || r.data)).slice(0, 700));
  }
  const tb = await api('GET', `/api/v1/admin/accounting/trial-balance`, { token: ADMIN });
  console.log('TB:', tb.status, JSON.stringify(tb.data).slice(0, 1000));
  out.tb = tb;
  save('18_balance_sheet_investigation_raw.json', out);
  await L.pool.end();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
