const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

const dbUrl = "[REDACTED_DATABASE_CREDENTIAL]";
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log("Connected to PostgreSQL remote Supabase cluster.");

  // 1. Get Accounts
  const accRes = await client.query(`
    SELECT id, code, name, type 
    FROM accounting_account 
    WHERE code IN ('1111', '1114', '1122', '5210')
  `);
  console.log("Accounts:", accRes.rows);
  const accountMap = {};
  accRes.rows.forEach(r => { accountMap[r.id] = r; accountMap[r.code] = r.id; });

  // 2. All branches
  const branchRes = await client.query(`
    SELECT id, name, code, is_open, created_at, deleted_at 
    FROM branch 
    ORDER BY created_at ASC
  `);
  console.log(`Total branches found: ${branchRes.rows.length}`);

  // 3. Journal lines for 1111, 1114, 1122
  const jlRes = await client.query(`
    SELECT 
      jl.id as line_id,
      jl.journal_entry_id,
      jl.line_no,
      jl.account_id,
      aa.code as account_code,
      aa.name as account_name,
      jl.debit_amount,
      jl.credit_amount,
      jl.branch_id,
      jl.narration as line_narration,
      je.entry_no,
      je.entry_date,
      je.voucher_id,
      v.voucher_no,
      v.voucher_type,
      v.status as voucher_status,
      v.posted_at,
      je.is_reversed,
      je.created_at as je_created_at
    FROM accounting_journal_line jl
    JOIN accounting_account aa ON jl.account_id = aa.id
    JOIN accounting_journal_entry je ON jl.journal_entry_id = je.id
    LEFT JOIN accounting_voucher v ON je.voucher_id = v.id
    WHERE aa.code IN ('1111', '1114', '1122')
    ORDER BY je.created_at ASC, jl.line_no ASC
  `);
  console.log(`Total journal lines for 1111, 1114, 1122: ${jlRes.rows.length}`);

  // 4. All teller sessions
  const sessRes = await client.query(`
    SELECT 
      s.id,
      s.teller_id,
      s.branch_id,
      s.status,
      s.opening_float,
      s.expected_cash,
      s.closing_count,
      s.variance,
      s.opened_at,
      s.closed_at,
      s.settled_at,
      s.settlement_voucher_id,
      s.notes,
      s.created_at,
      b.name as branch_name
    FROM teller_session s
    LEFT JOIN branch b ON s.branch_id = b.id
    ORDER BY s.created_at ASC
  `);
  console.log(`Total teller sessions: ${sessRes.rows.length}`);

  // 5. All teller movements
  const movRes = await client.query(`
    SELECT 
      m.id,
      m.teller_session_id,
      m.branch_id,
      m.direction,
      m.movement_type,
      m.amount,
      m.source_type,
      m.source_id,
      m.narration,
      m.created_at,
      m.created_by
    FROM teller_movement m
    ORDER BY m.created_at ASC
  `);
  console.log(`Total teller movements: ${movRes.rows.length}`);

  // 6. All vault movements
  const vmovRes = await client.query(`
    SELECT 
      vm.id,
      vm.branch_id,
      vm.direction,
      vm.movement_type,
      vm.amount,
      vm.source_type,
      vm.source_id,
      vm.teller_session_id,
      vm.teller_movement_id,
      vm.narration,
      vm.created_at
    FROM branch_vault_movement vm
    ORDER BY vm.created_at ASC
  `);
  console.log(`Total branch vault movements: ${vmovRes.rows.length}`);

  // 7. All delivery cash handovers
  const hoRes = await client.query(`
    SELECT 
      h.id,
      h.handover_number,
      h.branch_id,
      h.delivery_partner_id,
      h.teller_session_id,
      h.status,
      h.expected_amount,
      h.declared_amount,
      h.acknowledged_amount,
      h.shortage_amount,
      h.surplus_amount,
      h.digital_amount,
      h.submitted_at,
      h.acknowledged_at,
      h.settlement_voucher_id,
      h.teller_movement_id,
      h.created_at
    FROM delivery_cash_handover h
    ORDER BY h.created_at ASC
  `);
  console.log(`Total delivery cash handovers: ${hoRes.rows.length}`);

  // Save complete dump to scratch/forensic_dump.json
  const dump = {
    accounts: accRes.rows,
    branches: branchRes.rows,
    journal_lines: jlRes.rows,
    sessions: sessRes.rows,
    movements: movRes.rows,
    vault_movements: vmovRes.rows,
    handovers: hoRes.rows
  };

  fs.writeFileSync(path.join(__dirname, 'forensic_dump.json'), JSON.stringify(dump, null, 2));
  console.log("Forensic dump saved to scratch/forensic_dump.json");

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
