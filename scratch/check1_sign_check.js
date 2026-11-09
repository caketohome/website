const { Client } = require('../frontend/node_modules/pg');
const client = new Client({ connectionString: '[REDACTED_DATABASE_CREDENTIAL]' });

async function run() {
  await client.connect();

  console.log("=== VCH-JOURNAL-FY2026-27-20261017-YRSXXF (5000 Excess) ===");
  const excess = await client.query(`
    SELECT jl.line_no, aa.code, aa.name, jl.debit_amount, jl.credit_amount, jl.narration
    FROM accounting_voucher v
    JOIN accounting_journal_entry je ON je.voucher_id = v.id
    JOIN accounting_journal_line jl ON jl.journal_entry_id = je.id
    JOIN accounting_account aa ON jl.account_id = aa.id
    WHERE v.voucher_no = 'VCH-JOURNAL-FY2026-27-20261017-YRSXXF'
    ORDER BY jl.line_no
  `);
  console.table(excess.rows);

  console.log("\n=== VCH-JOURNAL-FY2026-27-20261017-YNXYCV (175 Shortage) ===");
  const short = await client.query(`
    SELECT jl.line_no, aa.code, aa.name, jl.debit_amount, jl.credit_amount, jl.narration
    FROM accounting_voucher v
    JOIN accounting_journal_entry je ON je.voucher_id = v.id
    JOIN accounting_journal_line jl ON jl.journal_entry_id = je.id
    JOIN accounting_account aa ON jl.account_id = aa.id
    WHERE v.voucher_no = 'VCH-JOURNAL-FY2026-27-20261017-YNXYCV'
    ORDER BY jl.line_no
  `);
  console.table(short.rows);

  console.log("\n=== ALL INDIRANAGAR POSTED JOURNAL LINES ON 1111 ===");
  const all1111 = await client.query(`
    SELECT 
      je.entry_no, v.voucher_no, v.voucher_type, jl.line_no,
      jl.debit_amount, jl.credit_amount, jl.narration, je.created_at
    FROM accounting_journal_line jl
    JOIN accounting_account aa ON jl.account_id = aa.id
    JOIN accounting_journal_entry je ON jl.journal_entry_id = je.id
    LEFT JOIN accounting_voucher v ON je.voucher_id = v.id
    WHERE aa.code = '1111' AND jl.branch_id = 'br_indiranagar' AND je.is_reversed = FALSE
    ORDER BY je.created_at ASC, jl.line_no ASC
  `);
  console.table(all1111.rows);

  await client.end();
}

run().catch(console.error);
