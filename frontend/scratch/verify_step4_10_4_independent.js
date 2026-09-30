const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        let val = line.substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  const rootEnvPath = path.join(__dirname, '../../backend/.env');
  if (fs.existsSync(rootEnvPath)) {
    const envContent = fs.readFileSync(rootEnvPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        let val = line.substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  }
  return 'postgresql://postgres:postgres@localhost:5432/cakes2home';
}

async function verifyBaseline() {
  const connectionString = getConnectionString();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const coaCount = parseInt((await client.query('SELECT count(*)::int as c FROM accounting_account')).rows[0].c, 10);
    const batchCount = parseInt((await client.query('SELECT count(*)::int as c FROM gateway_payout_batch')).rows[0].c, 10);
    const orderAllocCount = parseInt((await client.query('SELECT count(*)::int as c FROM gateway_settlement_order')).rows[0].c, 10);
    const bankAccCount = parseInt((await client.query('SELECT count(*)::int as c FROM bank_account')).rows[0].c, 10);
    const slipCount = parseInt((await client.query('SELECT count(*)::int as c FROM bank_deposit_slip')).rows[0].c, 10);
    const voucherCount = parseInt((await client.query('SELECT count(*)::int as c FROM accounting_voucher')).rows[0].c, 10);
    const journalCount = parseInt((await client.query('SELECT count(*)::int as c FROM accounting_journal_entry')).rows[0].c, 10);
    const lineCount = parseInt((await client.query('SELECT count(*)::int as c FROM accounting_journal_line')).rows[0].c, 10);
    const fpCount = parseInt((await client.query('SELECT count(*)::int as c FROM accounting_fiscal_period')).rows[0].c, 10);
    const orderCount = parseInt((await client.query('SELECT count(*)::int as c FROM public."order"')).rows[0].c, 10);
    const txnCount = parseInt((await client.query('SELECT count(*)::int as c FROM payment_transaction')).rows[0].c, 10);
    const startDateCount = parseInt((await client.query("SELECT count(*)::int as c FROM setting WHERE key = 'accounting_start_date'")).rows[0].c, 10);

    console.log('=== INDEPENDENT POSTGRESQL AUDIT REPORT ===');
    console.log(`accounting_account:        ${coaCount} (Expected: 99)`);
    console.log(`gateway_payout_batch:      ${batchCount} (Expected: 0)`);
    console.log(`gateway_settlement_order:  ${orderAllocCount} (Expected: 0)`);
    console.log(`bank_account:              ${bankAccCount} (Expected: 0)`);
    console.log(`bank_deposit_slip:         ${slipCount} (Expected: 0)`);
    console.log(`accounting_voucher:        ${voucherCount} (Expected: 0)`);
    console.log(`accounting_journal_entry:  ${journalCount} (Expected: 0)`);
    console.log(`accounting_journal_line:   ${lineCount} (Expected: 0)`);
    console.log(`accounting_fiscal_period:  ${fpCount} (Expected: 0)`);
    console.log(`order (historical):        ${orderCount} (Expected: 173)`);
    console.log(`payment_transaction:       ${txnCount} (Expected: 53)`);
    console.log(`accounting_start_date:     ${startDateCount} (Expected: 0)`);

    const isPristine = (
      coaCount === 99 &&
      batchCount === 0 &&
      orderAllocCount === 0 &&
      bankAccCount === 0 &&
      slipCount === 0 &&
      voucherCount === 0 &&
      journalCount === 0 &&
      lineCount === 0 &&
      fpCount === 0 &&
      orderCount === 173 &&
      txnCount === 53 &&
      startDateCount === 0
    );

    if (isPristine) {
      console.log('\n>>> AUDIT VERDICT: 100% PRISTINE BASELINE CONFIRMED <<<');
      process.exit(0);
    } else {
      console.error('\n>>> AUDIT VERDICT: BASELINE CORRUPTED OR DIRTY <<<');
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

verifyBaseline().catch(err => {
  console.error('Fatal error during baseline audit:', err);
  process.exit(1);
});
