const path = require('path');
const Client = require(path.resolve('E:/vig/cakes2home-main/cakes2home-main/frontend/node_modules/pg')).Client;

async function testInsert() {
  const client = new Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password@127.0.0.1:5433/cth_rehearsal_phase5'
  });
  await client.connect();
  const jeId = `je_test_multi_${Date.now()}`;
  const vchId = `vch_test_multi_${Date.now()}`;

  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO public.accounting_voucher (
        id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
        status, total_amount, currency, reference_type, reference_id, reference_event,
        narration, created_by, posted_by, posted_at, created_at, updated_at
      ) VALUES (
        $1, 'VCH-TEST-M', '2026-04-01', 'br_indiranagar_01', '26-27',
        'POSTED', 100.00, 'INR', 'TEST', '123', 'TEST',
        'test narration', 'test', 'test', NOW(), NOW(), NOW()
      );
    `, [vchId]);

    await client.query(`
      INSERT INTO public.accounting_journal_entry (
        id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
        total_debit, total_credit, is_reversed, narration, created_by, created_at
      ) VALUES (
        $1, 'JE-TEST-M', $2, '2026-04-01', 'br_indiranagar_01', '26-27',
        100.00, 100.00, false, 'test', 'test', NOW()
      );
    `, [jeId, vchId]);

    // Test multi-row insert
    await client.query(`
      INSERT INTO public.accounting_journal_line (
        id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
      ) VALUES 
        ($1, $2, 1, '1e2781c0-e633-4576-9014-aaacaa71337e', 100.00, 0.00, 'br_indiranagar_01', 'debit line'),
        ($3, $2, 2, '34cd9ce6-dfbe-4c9b-a2a6-130c8813dfc4', 0.00, 100.00, 'br_indiranagar_01', 'credit line');
    `, [`jl_1_${Date.now()}`, jeId, `jl_2_${Date.now()}`]);

    console.log('Multi-row insert succeeded!');
    await client.query('ROLLBACK');
  } catch (e) {
    console.error('Multi-row insert error:', e.message);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

testInsert();
