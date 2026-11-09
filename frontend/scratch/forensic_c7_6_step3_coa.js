const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("DATABASE_URL not found");
}

async function runForensics() {
  const conn = getConnectionString();
  const client = new Client({ connectionString: conn, ssl: conn.includes('supabase') ? { rejectUnauthorized: false } : false });
  await client.connect();

  const results = {};

  try {
    // 1. Columns of public.accounting_account
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_account'
      ORDER BY ordinal_position;
    `);
    results.accountColumns = colsRes.rows;

    // 2. Constraints of public.accounting_account
    const constrRes = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.relname = 'accounting_account';
    `);
    results.accountConstraints = constrRes.rows;

    // 3. Indexes of public.accounting_account
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'accounting_account';
    `);
    results.accountIndexes = idxRes.rows;

    // 4. Triggers on public.accounting_account, accounting_voucher, accounting_journal_entry, accounting_journal_line, cost_centre
    const trigRes = await client.query(`
      SELECT event_object_table, trigger_name, event_manipulation, action_statement, action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table IN ('accounting_account', 'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line', 'cost_centre')
      ORDER BY event_object_table, trigger_name;
    `);
    results.triggers = trigRes.rows;

    // 5. Foreign keys referencing or referenced by accounting_account
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public'
        AND (tc.table_name = 'accounting_account' OR ccu.table_name = 'accounting_account');
    `);
    results.accountForeignKeys = fkRes.rows;

    // 6. Distinct types and subtypes in accounting_account
    const typeSummary = await client.query(`
      SELECT type, subtype, is_group, COUNT(*) as count
      FROM public.accounting_account
      GROUP BY type, subtype, is_group
      ORDER BY type, is_group DESC, subtype;
    `);
    results.typeSummary = typeSummary.rows;

    // 7. All 100 rows in accounting_account
    const allAccounts = await client.query(`
      SELECT *
      FROM public.accounting_account
      ORDER BY code ASC;
    `);
    results.accounts = allAccounts.rows;

    // 8. Journal line usage of accounts & cost centres
    const jlUsage = await client.query(`
      SELECT 
        a.code, a.name, a.type, a.subtype,
        COUNT(jl.id) as line_count,
        COUNT(jl.cost_centre_id) as cc_count,
        SUM(jl.debit_amount) as total_dr,
        SUM(jl.credit_amount) as total_cr
      FROM public.accounting_account a
      LEFT JOIN public.accounting_journal_line jl ON a.id = jl.account_id
      GROUP BY a.code, a.name, a.type, a.subtype
      HAVING COUNT(jl.id) > 0
      ORDER BY a.code;
    `);
    results.postedAccounts = jlUsage.rows;

    // 9. Total journal lines and cost centre usage
    const jlOverall = await client.query(`
      SELECT 
        COUNT(*) as total_lines,
        COUNT(cost_centre_id) as lines_with_cc,
        COUNT(*) - COUNT(cost_centre_id) as lines_without_cc
      FROM public.accounting_journal_line;
    `);
    results.journalLineStats = jlOverall.rows[0];

    // 10. Voucher count and cost centre usage
    const vchOverall = await client.query(`
      SELECT 
        COUNT(*) as total_vouchers,
        COUNT(cost_centre_id) as vouchers_with_cc,
        COUNT(*) - COUNT(cost_centre_id) as vouchers_without_cc
      FROM public.accounting_voucher;
    `);
    results.voucherStats = vchOverall.rows[0];

    // 11. Immutability checks: any triggers preventing updates or deletes on accounting_account?
    const pgTriggers = await client.query(`
      SELECT tgname, relname, tgenabled, proname, prosrc
      FROM pg_trigger tr
      JOIN pg_class c ON tr.tgrelid = c.oid
      JOIN pg_proc p ON tr.tgfoid = p.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = 'accounting_account';
    `);
    results.pgTriggers = pgTriggers.rows;

    // Write output to JSON
    fs.writeFileSync(path.join(__dirname, 'forensic_c7_6_step3_data.json'), JSON.stringify(results, null, 2));
    console.log("Forensics completed successfully. Output written to scratch/forensic_c7_6_step3_data.json");
    console.log(`Total accounts: ${results.accounts.length}`);
    console.log(`Total journal lines: ${results.journalLineStats.total_lines}, with CC: ${results.journalLineStats.lines_with_cc}`);
    console.log(`Total vouchers: ${results.voucherStats.total_vouchers}, with CC: ${results.voucherStats.vouchers_with_cc}`);
    console.log(`Posted distinct accounts: ${results.postedAccounts.length}`);
  } catch (err) {
    console.error("Forensic query error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runForensics();
