const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const db = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });

async function check() {
  await db.connect();
  const cols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounting_account'");
  console.log('Columns of accounting_account:', cols.rows.map(r => r.column_name + ' (' + r.data_type + ')'));

  const res = await db.query(`
    SELECT a.*,
           COALESCE(SUM(jl.debit_amount), 0) as total_debit,
           COALESCE(SUM(jl.credit_amount), 0) as total_credit
    FROM public.accounting_account a
    LEFT JOIN public.accounting_journal_line jl ON a.id = jl.account_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id
    ORDER BY a.code ASC
  `);
  console.log('Total accounts in CoA:', res.rows.length);
  res.rows.slice(0, 15).forEach(r => {
    console.log(r.code.padEnd(10) + ' | ' + r.name.padEnd(35) + ' | ' + r.type.padEnd(10) + ' | Dr:' + Number(r.total_debit).toFixed(2).padStart(10) + ' | Cr:' + Number(r.total_credit).toFixed(2).padStart(10));
  });
  await db.end();
}

check().catch(console.error);
