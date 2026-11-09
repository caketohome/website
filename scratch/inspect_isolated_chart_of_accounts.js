const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

async function inspect() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test'
  });
  await client.connect();

  console.log('=== CONNECTED TO ISOLATED TEST DB (127.0.0.1:5433/cth_test) ===');

  // 1. Chart of Accounts
  const accRes = await client.query(`
    SELECT id, code, name, type, subtype, is_group, is_active 
    FROM public.accounting_account 
    WHERE deleted_at IS NULL 
    ORDER BY code ASC
  `);
  console.log(`TOTAL ACTIVE ACCOUNTS: ${accRes.rowCount}`);

  // Summary by type
  const typeRes = await client.query(`
    SELECT type, count(*) as count 
    FROM public.accounting_account 
    WHERE deleted_at IS NULL 
    GROUP BY type 
    ORDER BY type
  `);
  console.log('ACCOUNTS BY TYPE:', typeRes.rows);

  // Key operational accounts
  const keyCodes = ['1111', '1112', '1113', '1114', '1121', '1122', '1131', '1132', '1133', '1141', '1142', '1143', '2111', '2121', '2122', '2123', '2141', '2142', '4110', '4120', '4130', '5110', '5290'];
  console.log('\n--- KEY OPERATIONAL ACCOUNTS ---');
  for (const row of accRes.rows) {
    if (keyCodes.includes(row.code)) {
      console.log(`[${row.code}] ${row.name.padEnd(35)} | Type: ${row.type.padEnd(10)} | Subtype: ${row.subtype || 'none'}`);
    }
  }

  // 2. Vouchers & Journal entries
  const vRes = await client.query(`
    SELECT voucher_type, status, count(*) 
    FROM public.accounting_voucher 
    GROUP BY voucher_type, status 
    ORDER BY voucher_type, status
  `);
  console.log('\nVOUCHERS IN DB:', vRes.rows);

  const jRes = await client.query(`
    SELECT count(*) as total_entries 
    FROM public.accounting_journal_entry
  `);
  console.log('TOTAL JOURNAL ENTRIES:', jRes.rows[0].total_entries);

  const jlRes = await client.query(`
    SELECT 
      SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) as total_credit
    FROM public.accounting_journal_line
  `);
  console.log('TOTAL JOURNAL LINE BALANCE:', jlRes.rows[0]);

  // 3. Inspect recent posted vouchers and journal lines
  const sampleVouchers = await client.query(`
    SELECT v.id, v.voucher_number, v.voucher_type, v.status, v.narration, v.total_amount,
           je.id as journal_entry_id, je.entry_number
    FROM public.accounting_voucher v
    LEFT JOIN public.accounting_journal_entry je ON je.voucher_id = v.id
    ORDER BY v.created_at DESC
    LIMIT 5
  `);
  console.log('\nRECENT VOUCHERS:');
  for (const v of sampleVouchers.rows) {
    console.log(`Voucher ${v.voucher_number} (${v.voucher_type}, ${v.status}): ₹${v.total_amount} - ${v.narration}`);
    if (v.journal_entry_id) {
      const lines = await client.query(`
        SELECT jl.entry_type, jl.amount, acc.code, acc.name
        FROM public.accounting_journal_line jl
        JOIN public.accounting_account acc ON acc.id = jl.account_id
        WHERE jl.journal_entry_id = $1
        ORDER BY jl.entry_type DESC, jl.line_number ASC
      `, [v.journal_entry_id]);
      for (const l of lines.rows) {
        console.log(`   ${l.entry_type.padEnd(6)} [${l.code}] ${l.name.padEnd(30)}: ₹${l.amount}`);
      }
    }
  }

  await client.end();
}

inspect().catch(console.error);
