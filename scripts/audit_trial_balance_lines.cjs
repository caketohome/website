const { Client } = require('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg');
const db = new Client({ connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5' });

async function audit() {
  await db.connect();
  
  // Total journal lines
  const countRes = await db.query('SELECT count(*) FROM public.accounting_journal_line');
  console.log('Total journal lines in DB:', countRes.rows[0].count);

  // Sum of all debits and credits in journal lines
  const sumRes = await db.query('SELECT SUM(debit_amount) as total_debit, SUM(credit_amount) as total_credit FROM public.accounting_journal_line');
  console.log('DB Total Debits:', sumRes.rows[0].total_debit, 'DB Total Credits:', sumRes.rows[0].total_credit);

  // Group by GL account code using public.accounting_account
  const accRes = await db.query(`
    SELECT 
      a.code, 
      a.name, 
      SUM(jl.debit_amount) as total_debit, 
      SUM(jl.credit_amount) as total_credit,
      count(*) as line_count
    FROM public.accounting_journal_line jl
    JOIN public.accounting_account a ON jl.account_id = a.id
    GROUP BY a.code, a.name
    ORDER BY a.code
  `);
  console.log('\n--- ALL ACCOUNTS WITH JOURNAL MOVEMENTS ---');
  let sumDr = 0, sumCr = 0;
  accRes.rows.forEach(r => {
    const dr = parseFloat(r.total_debit || 0);
    const cr = parseFloat(r.total_credit || 0);
    sumDr += dr;
    sumCr += cr;
    console.log(r.code.padEnd(10) + ' | ' + r.name.padEnd(45) + ' | Lines: ' + String(r.line_count).padEnd(4) + ' | Dr: ' + dr.toFixed(2).padStart(12) + ' | Cr: ' + cr.toFixed(2).padStart(12));
  });
  console.log('-------------------------------------------------------------------------------------------------------------------------');
  console.log('SUM OF ALL ACCOUNTS:'.padEnd(62) + ' | Dr: ' + sumDr.toFixed(2).padStart(12) + ' | Cr: ' + sumCr.toFixed(2).padStart(12) + ' | Diff: ' + (sumDr - sumCr).toFixed(2));

  // Also inspect all 69 lines
  const linesRes = await db.query(`
    SELECT 
      jl.id as line_id,
      je.entry_no,
      je.entry_date,
      a.code,
      a.name as account_name,
      jl.debit_amount,
      jl.credit_amount,
      jl.narration
    FROM public.accounting_journal_line jl
    JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
    JOIN public.accounting_account a ON jl.account_id = a.id
    ORDER BY je.entry_date ASC, je.entry_no ASC, jl.id ASC
  `);
  console.log('\n--- ALL INDIVIDUAL JOURNAL LINES (' + linesRes.rows.length + ' LINES) ---');
  linesRes.rows.forEach((l, idx) => {
    console.log(
      String(idx + 1).padStart(2) + '. ' +
      l.entry_no.padEnd(28) + ' | ' +
      l.code.padEnd(10) + ' | Dr: ' +
      Number(l.debit_amount).toFixed(2).padStart(10) + ' | Cr: ' +
      Number(l.credit_amount).toFixed(2).padStart(10) + ' | ' +
      (l.narration || '').substring(0, 45)
    );
  });

  await db.end();
}

audit().catch(console.error);
