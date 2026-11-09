const fs = require('fs');
const path = require('path');
const { Client } = require('../frontend/node_modules/pg');

function getDatabaseUrl() {
  const envContent = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return line.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
}

async function run() {
  const client = new Client({ connectionString: getDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("===============================================================================");
  console.log("   CAKETOHOME ERP — FORENSIC AUDIT OF THE ₹550 TEST VOUCHERS");
  console.log("===============================================================================\n");

  const vchs = await client.query(`
    SELECT 
      v.id as voucher_id,
      v.voucher_no,
      v.voucher_type,
      v.branch_id,
      v.status,
      v.total_amount,
      v.reference_type,
      v.reference_id,
      v.created_at,
      v.posted_at,
      v.created_by,
      v.approved_by,
      v.posted_by,
      je.id as journal_entry_id,
      je.entry_no
    FROM public.accounting_voucher v
    LEFT JOIN public.accounting_journal_entry je ON je.voucher_id = v.id
    WHERE v.voucher_no IN ('VCH-VAL-tc_1792398245910', 'VCH-C-A-tc_1792398245910')
       OR v.id IN ('vch_val_tc_1792398245910', 'vch_c_A_tc_1792398245910')
    ORDER BY v.created_at ASC;
  `);

  console.log("--- 1. Voucher & Journal Entry Metadata ---");
  console.table(vchs.rows);

  const jeIds = vchs.rows.map(r => r.journal_entry_id).filter(Boolean);
  if (jeIds.length > 0) {
    const lines = await client.query(`
      SELECT 
        l.id as line_id,
        l.journal_entry_id,
        l.account_id,
        a.code as account_code,
        a.name as account_name,
        l.debit_amount,
        l.credit_amount,
        l.narration
      FROM public.accounting_journal_line l
      JOIN public.accounting_account a ON a.id = l.account_id
      WHERE l.journal_entry_id = ANY($1)
      ORDER BY l.journal_entry_id, l.id;
    `, [jeIds]);

    console.log("\n--- 2. Journal Entry Lines & Accounts ---");
    console.table(lines.rows);
  }

  // Check the associated teller session
  const session = await client.query(`
    SELECT *
    FROM public.teller_session
    WHERE branch_id = 'br_tc_1792398245910'
  `);
  console.log("\n--- 3. Associated Teller Session ---");
  console.table(session.rows.map(r => ({
    id: r.id,
    teller_id: r.teller_id,
    status: r.status,
    opening_float: r.opening_float,
    closing_cash_actual: r.closing_cash_actual,
    variance: r.variance,
    created_at: r.created_at
  })));

  // Check the branch
  const br = await client.query(`
    SELECT id, name, code, status, created_at
    FROM public.branch
    WHERE id = 'br_tc_1792398245910'
  `);
  console.log("\n--- 4. Associated Test Branch ---");
  console.table(br.rows);

  await client.end();
}

run().catch(console.error);
