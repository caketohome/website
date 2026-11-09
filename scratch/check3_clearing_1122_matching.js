const { Client } = require('../frontend/node_modules/pg');
const client = new Client({ connectionString: '[REDACTED_DATABASE_CREDENTIAL]' });

async function run() {
  await client.connect();

  console.log("=== 1. ALL 10 RECEIPT VOUCHERS CREDITING ACCOUNT 1122 ===");
  const receipts = await client.query(`
    SELECT 
      v.id as voucher_id,
      v.voucher_no,
      v.voucher_date,
      v.branch_id,
      b.name as branch_name,
      v.total_amount,
      v.reference_type,
      v.reference_id,
      v.narration,
      jl.debit_amount,
      jl.credit_amount,
      je.entry_no
    FROM accounting_voucher v
    JOIN accounting_journal_entry je ON je.voucher_id = v.id
    JOIN accounting_journal_line jl ON jl.journal_entry_id = je.id
    JOIN accounting_account aa ON jl.account_id = aa.id
    LEFT JOIN branch b ON v.branch_id = b.id
    WHERE aa.code = '1122' AND jl.credit_amount > 0 AND v.status = 'POSTED'
    ORDER BY v.created_at ASC
  `);
  console.log(`Found ${receipts.rows.length} vouchers crediting 1122:`);
  
  for (const r of receipts.rows) {
    console.log(`\nVoucher: ${r.voucher_no} (${r.voucher_id}) | Branch: ${r.branch_id} | Amount: ₹${r.credit_amount}`);
    console.log(`  Reference: ${r.reference_type} -> ${r.reference_id}`);
    console.log(`  Narration: ${r.narration}`);

    // Find linked handover
    const ho = await client.query(`
      SELECT id, handover_number, branch_id, delivery_partner_id, status, 
             expected_amount, declared_amount, acknowledged_amount, order_ids, settlement_voucher_id
      FROM delivery_cash_handover
      WHERE id = $1 OR settlement_voucher_id = $2
    `, [r.reference_id, r.voucher_id]);
    
    if (ho.rows.length > 0) {
      console.log(`  MATCHED HANDOVER: ${ho.rows[0].handover_number} (${ho.rows[0].id})`);
      console.log(`    Status: ${ho.rows[0].status}, Ack: ₹${ho.rows[0].acknowledged_amount}, Orders: ${JSON.stringify(ho.rows[0].order_ids)}`);
    } else {
      console.log(`  NO DIRECT HANDOVER MATCH BY ID/VOUCHER`);
    }
  }

  console.log("\n=== 2. ALL 8 SUBMITTED (UNACKNOWLEDGED) HANDOVERS ===");
  const submittedHO = await client.query(`
    SELECT 
      id, handover_number, branch_id, delivery_partner_id, status,
      expected_amount, declared_amount, acknowledged_amount, shortage_amount, surplus_amount,
      order_ids, submitted_at, created_at
    FROM delivery_cash_handover
    WHERE status = 'SUBMITTED'
    ORDER BY created_at ASC
  `);
  console.log(`Found ${submittedHO.rows.length} SUBMITTED handovers:`);
  console.table(submittedHO.rows.map(h => ({
    id: h.id,
    handover_no: h.handover_number,
    branch_id: h.branch_id,
    rider_id: h.delivery_partner_id,
    declared: parseFloat(h.declared_amount),
    expected: parseFloat(h.expected_amount),
    order_count: (h.order_ids || []).length,
    submitted_at: h.submitted_at
  })));

  // Total sums
  const sumCleared = receipts.rows.reduce((acc, r) => acc + parseFloat(r.credit_amount), 0);
  const sumSubmitted = submittedHO.rows.reduce((acc, h) => acc + parseFloat(h.declared_amount), 0);
  console.log(`\nTotal Cleared from 1122 by Receipts: ₹${sumCleared.toFixed(2)}`);
  console.log(`Total Pending in SUBMITTED Handovers: ₹${sumSubmitted.toFixed(2)}`);

  await client.end();
}

run().catch(console.error);
