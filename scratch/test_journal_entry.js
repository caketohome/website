const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));
const jiti = require(path.resolve(__dirname, '../frontend/node_modules/jiti'))(__filename);

const env = fs.readFileSync('.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim().replace(/^['\"]|['\"]$/g, '');
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const { AccountingAccountRepository } = jiti(path.resolve(__dirname, '../frontend/src/lib/repositories/accounting-account.repository.ts'));
const { AccountingJournalRepository } = jiti(path.resolve(__dirname, '../frontend/src/lib/repositories/accounting-journal.repository.ts'));

async function run() {
  await client.connect();
  const tx = await client.query('BEGIN');
  
  const acc1111 = await AccountingAccountRepository.findByCode("1111", client);
  const acc5296 = await AccountingAccountRepository.findByCode("5296", client);
  console.log('acc1111:', acc1111?.id, acc1111?.code);
  console.log('acc5296:', acc5296?.id, acc5296?.code);

  const lines = [
    {
      account_id: acc1111.id,
      debit_amount: 250,
      credit_amount: 0,
      branch_id: 'br_indiranagar',
      narration: 'Test debit',
    },
    {
      account_id: acc5296.id,
      debit_amount: 0,
      credit_amount: 250,
      branch_id: 'br_indiranagar',
      narration: 'Test credit',
    }
  ];

  const { PostingService } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/posting.service.ts'));
  const { AccountingFiscalPeriodRepository } = jiti(path.resolve(__dirname, '../frontend/src/lib/repositories/accounting-fiscal-period.repository.ts'));

  const todayStr = new Date().toISOString().split('T')[0];
  const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(todayStr, client);
  const fiscalYear = periodStatus.status === 'PERIOD_OPEN' ? periodStatus.period.fiscal_year : 'FY2026-27';

  const draftRes = await PostingService.createVoucherDraft({
    input: {
      voucher_type: 'JOURNAL',
      voucher_date: todayStr,
      branch_id: 'br_indiranagar',
      narration: 'Test entry',
      reference_type: 'TELLER_MOVEMENT',
      reference_id: `test_ref_${Date.now()}`,
      reference_event: 'MANUAL_ADJUSTMENT',
    },
    branchId: 'br_indiranagar',
    fiscalYear,
    createdBy: 'admin_01',
    client,
  });
  console.log('draftRes:', draftRes);

  const submitRes = await PostingService.submitVoucher({
    voucherId: draftRes.data.id,
    submittedBy: 'admin_01',
    branchId: 'br_indiranagar',
    client,
  });
  console.log('submitRes:', submitRes);

  const approveRes = await PostingService.approveVoucher({
    voucherId: draftRes.data.id,
    approvedBy: 'usr_approver_01',
    branchId: 'br_indiranagar',
    client,
  });
  console.log('approveRes:', approveRes);

  const postRes = await PostingService.postVoucher({
    voucherId: draftRes.data.id,
    postedBy: 'usr_approver_01',
    lines,
    branchId: 'br_indiranagar',
    client,
  });
  console.log('postRes:', postRes);

  await client.query('ROLLBACK');
  await client.end();
}
run().catch(console.error);
