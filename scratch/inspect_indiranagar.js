const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const p = new Pool({
  connectionString: '[REDACTED_DATABASE_CREDENTIAL]',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const b = await p.query("SELECT id, name FROM public.branch WHERE name ILIKE '%indiranagar%'");
  const bId = b.rows[0]?.id;
  console.log('Branch:', b.rows[0]);

  const acc1111 = await p.query("SELECT id FROM public.accounting_account WHERE code = '1111'");
  const id1111 = acc1111.rows[0]?.id;

  const gl = await p.query(
    `SELECT jl.debit_amount, jl.credit_amount, jl.narration, je.entry_no, je.voucher_id, je.entry_date
     FROM public.accounting_journal_line jl
     JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
     WHERE jl.branch_id = $1 AND jl.account_id = $2
     ORDER BY je.entry_date ASC`,
    [bId, id1111]
  );
  console.log('GL 1111 lines count:', gl.rows.length);
  gl.rows.forEach(r => console.log('  ', r.entry_no, 'Dr:', r.debit_amount, 'Cr:', r.credit_amount, '|', r.narration));

  const sessions = await p.query("SELECT id, status, opening_float, opened_at, closed_at FROM public.teller_session WHERE branch_id = $1", [bId]);
  console.log('Sessions count:', sessions.rows.length);
  sessions.rows.forEach(s => console.log('  ', s.id, s.status, 'float:', s.opening_float, s.opened_at, s.closed_at));

  const movs = await p.query("SELECT id, teller_session_id, direction, amount, movement_type, narration FROM public.teller_movement WHERE branch_id = $1", [bId]);
  console.log('Movements count:', movs.rows.length);
  movs.rows.forEach(m => console.log('  ', m.id, m.teller_session_id, m.direction, m.amount, m.movement_type, '|', m.narration));

  p.end();
})().catch(console.error);
