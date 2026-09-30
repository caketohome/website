import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const pg = require('../frontend/node_modules/pg');

const envContent = fs.readFileSync(path.join(__dirname, '../backend/.env'), 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) dbUrl = line.substring('DATABASE_URL='.length).trim();
}

const { Client } = pg;
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log('=== SEPARATE INDEPENDENT VERIFICATION GATE (PHASE 4E REVIEW) ===');

const q = async (sql) => (await client.query(sql)).rows;

const accounts = await q('SELECT count(*)::int as total, count(*) FILTER (WHERE is_group = true)::int as groups, count(*) FILTER (WHERE is_group = false)::int as leaves FROM public.accounting_account;');
console.log('Accounting Accounts:', JSON.stringify(accounts[0]));

const vouchers = await q('SELECT count(*)::int as cnt FROM public.accounting_voucher;');
console.log('Accounting Vouchers:', vouchers[0].cnt);

const journals = await q('SELECT count(*)::int as cnt FROM public.accounting_journal_entry;');
console.log('Accounting Journal Entries:', journals[0].cnt);

const lines = await q('SELECT count(*)::int as cnt FROM public.accounting_journal_line;');
console.log('Accounting Journal Lines:', lines[0].cnt);

const periods = await q('SELECT count(*)::int as cnt FROM public.accounting_fiscal_period;');
console.log('Fiscal Periods:', periods[0].cnt);

const orders = await q('SELECT count(*)::int as cnt FROM public."order";');
console.log('Historical Orders:', orders[0].cnt);

const payments = await q('SELECT count(*)::int as cnt FROM public.payment_transaction;');
console.log('Historical Payment Transactions:', payments[0].cnt);

const startDate = await q("SELECT count(*)::int as cnt FROM public.setting WHERE key = 'accounting_start_date';");
console.log('accounting_start_date configured:', startDate[0].cnt > 0);

const pass = (
  accounts[0].total === 98 &&
  accounts[0].groups === 24 &&
  accounts[0].leaves === 74 &&
  vouchers[0].cnt === 0 &&
  journals[0].cnt === 0 &&
  lines[0].cnt === 0 &&
  periods[0].cnt === 0 &&
  orders[0].cnt === 173 &&
  payments[0].cnt === 53 &&
  startDate[0].cnt === 0
);

console.log('INDEPENDENT VERIFICATION GATE RESULT:', pass ? 'ALL CHECKS PASSED (100% SUCCESS)' : 'FAILURES DETECTED');
await client.end();
process.exit(pass ? 0 : 1);
