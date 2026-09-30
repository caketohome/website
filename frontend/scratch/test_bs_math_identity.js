/**
 * Forensic test to empirically prove the Balance Sheet mathematical identity
 * using our exact 99-account CoA structure.
 * Simulates a variety of complex accounting events and asserts:
 * Assets === Liabilities + Equity (including Net Profit from nominal accounts).
 */

const assert = require('assert');

// Account definitions from our CoA
const ACCOUNTS = {
  // Assets
  1111: { code: '1111', type: 'ASSET', name: 'Cash in Hand', parent: '1110' },
  1112: { code: '1112', type: 'ASSET', name: 'Bank Operating A/c', parent: '1110' },
  1121: { code: '1121', type: 'ASSET', name: 'Accounts Receivable', parent: '1120' },
  1132: { code: '1132', type: 'ASSET', name: 'Merchandise Inventory - Cakes', parent: '1130' },
  1141: { code: '1141', type: 'ASSET', name: 'Input CGST 2.5%', parent: '1140' },
  1510: { code: '1510', type: 'ASSET', name: 'Bakery Equipment', parent: '1500' },
  1590: { code: '1590', type: 'ASSET', name: 'Accumulated Depreciation', parent: '1500', is_contra: true },

  // Liabilities
  2111: { code: '2111', type: 'LIABILITY', name: 'Accounts Payable', parent: '2110' },
  2121: { code: '2121', type: 'LIABILITY', name: 'Output CGST 2.5%', parent: '2120' },
  2510: { code: '2510', type: 'LIABILITY', name: 'Bank Loans', parent: '2500' },

  // Equity
  3110: { code: '3110', type: 'EQUITY', name: 'Partner Capital', parent: '3100' },
  3120: { code: '3120', type: 'EQUITY', name: 'Drawings / Distributions', parent: '3100', is_contra: true },
  3210: { code: '3210', type: 'EQUITY', name: 'Retained Earnings (Prior Years)', parent: '3200' },
  3220: { code: '3220', type: 'EQUITY', name: 'Current Year Net Earnings', parent: '3200' },
  3300: { code: '3300', type: 'EQUITY', name: 'Opening Balance Offset', parent: '3000' },

  // Revenue (P&L)
  4110: { code: '4110', type: 'REVENUE', name: 'Cake Sales Revenue', parent: '4100' },
  4190: { code: '4190', type: 'REVENUE', name: 'Sales Returns', parent: '4100', is_contra: true },

  // Expense (P&L)
  5110: { code: '5110', type: 'EXPENSE', name: 'COGS - Cakes', parent: '5100' },
  5210: { code: '5210', type: 'EXPENSE', name: 'Salaries Expense', parent: '5200' },
  5330: { code: '5330', type: 'EXPENSE', name: 'Depreciation Expense', parent: '5300' },
};

// GL Journal Lines Store
const glLines = [];

function postEntry(lines) {
  let dSum = 0, cSum = 0;
  for (const l of lines) {
    dSum += l.debit;
    cSum += l.credit;
  }
  assert.strictEqual(dSum, cSum, "Unbalanced journal entry!");
  glLines.push(...lines);
}

// 1. Opening Balances:
// Bank: 500,000 (Dr), Inventory: 100,000 (Dr), Equipment: 1,000,000 (Dr)
// Loan: 400,000 (Cr), Capital: 1,000,000 (Cr), Prior Retained Earnings: 200,000 (Cr)
// Sum Dr = 1,600,000; Sum Cr = 1,600,000. OB Offset (3300) = 0!
postEntry([
  { code: '1112', debit: 500000, credit: 0 },
  { code: '3300', debit: 0, credit: 500000 },
]);
postEntry([
  { code: '1132', debit: 100000, credit: 0 },
  { code: '3300', debit: 0, credit: 100000 },
]);
postEntry([
  { code: '1510', debit: 1000000, credit: 0 },
  { code: '3300', debit: 0, credit: 1000000 },
]);
postEntry([
  { code: '2510', debit: 0, credit: 400000 },
  { code: '3300', debit: 400000, credit: 0 },
]);
postEntry([
  { code: '3110', debit: 0, credit: 1000000 },
  { code: '3300', debit: 1000000, credit: 0 },
]);
postEntry([
  { code: '3210', debit: 0, credit: 200000 },
  { code: '3300', debit: 200000, credit: 0 },
]);

// 2. Sale on credit: ₹10,000 + ₹250 GST
postEntry([
  { code: '1121', debit: 10250, credit: 0 },
  { code: '4110', debit: 0, credit: 10000 },
  { code: '2121', debit: 0, credit: 250 },
]);

// 3. COGS for sale: ₹4,000
postEntry([
  { code: '5110', debit: 4000, credit: 0 },
  { code: '1132', debit: 0, credit: 4000 },
]);

// 4. Customer payment: ₹10,250 to Bank
postEntry([
  { code: '1112', debit: 10250, credit: 0 },
  { code: '1121', debit: 0, credit: 10250 },
]);

// 5. Depreciation charge: ₹5,000
postEntry([
  { code: '5330', debit: 5000, credit: 0 },
  { code: '1590', debit: 0, credit: 5000 },
]);

// 6. Partner drawing: ₹15,000 cash withdrawal
postEntry([
  { code: '3120', debit: 15000, credit: 0 },
  { code: '1112', debit: 0, credit: 15000 },
]);

// Now let's calculate Trial Balance & Balance Sheet
const tbBalances = {};
for (const [code, acct] of Object.entries(ACCOUNTS)) {
  tbBalances[code] = { code, type: acct.type, debit: 0, credit: 0, net: 0 };
}

for (const line of glLines) {
  tbBalances[line.code].debit += line.debit;
  tbBalances[line.code].credit += line.credit;
  tbBalances[line.code].net = tbBalances[line.code].debit - tbBalances[line.code].credit;
}

// Compute P&L Net Profit
let totalRevenue = 0;
let totalExpense = 0;
for (const b of Object.values(tbBalances)) {
  if (b.type === 'REVENUE') totalRevenue += (b.credit - b.debit);
  if (b.type === 'EXPENSE') totalExpense += (b.debit - b.credit);
}
const netProfit = totalRevenue - totalExpense; // 10000 - 4000 - 5000 = 1000

// Compute Assets
// Current Assets
const cash = tbBalances['1111'].net;
const bank = tbBalances['1112'].net;
const ar = tbBalances['1121'].net;
const inv = tbBalances['1132'].net;
const inputTax = tbBalances['1141'].net;
const totalCurrentAssets = cash + bank + ar + inv + inputTax;

// Fixed Assets (Gross - Accumulated Depreciation)
const grossFixedAssets = tbBalances['1510'].net;
const accumDepr = Math.abs(tbBalances['1590'].net); // Credit balance -> positive deduction
const netFixedAssets = grossFixedAssets - accumDepr;

const totalAssets = totalCurrentAssets + netFixedAssets;

// Compute Liabilities
// Current Liabilities (credit - debit)
const outputTax = tbBalances['2121'].credit - tbBalances['2121'].debit;
const ap = tbBalances['2111'].credit - tbBalances['2111'].debit;
const totalCurrentLiabilities = outputTax + ap;

// Long-Term Liabilities
const loans = tbBalances['2510'].credit - tbBalances['2510'].debit;
const totalLiabilities = totalCurrentLiabilities + loans;

// Compute Equity
const capital = tbBalances['3110'].credit - tbBalances['3110'].debit;
const drawings = tbBalances['3120'].debit - tbBalances['3120'].credit; // Debit balance -> deduction
const netCapital = capital - drawings;

const priorRetainedEarnings = tbBalances['3210'].credit - tbBalances['3210'].debit;
const currentNetEarnings = netProfit; // Dynamic roll-up from P&L!
const obOffset = tbBalances['3300'].credit - tbBalances['3300'].debit;

const totalEquity = netCapital + priorRetainedEarnings + currentNetEarnings + obOffset;
const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

console.log('--- BALANCE SHEET SIMULATION RESULTS ---');
console.log(`Total Current Assets: ₹${totalCurrentAssets}`);
console.log(`Gross Fixed Assets: ₹${grossFixedAssets}, Less Accum Depr: ₹${accumDepr}, Net Fixed: ₹${netFixedAssets}`);
console.log(`TOTAL ASSETS: ₹${totalAssets}`);
console.log('----------------------------------------');
console.log(`Total Current Liabilities: ₹${totalCurrentLiabilities}`);
console.log(`Total Long-Term Liabilities: ₹${loans}`);
console.log(`TOTAL LIABILITIES: ₹${totalLiabilities}`);
console.log('----------------------------------------');
console.log(`Capital: ₹${capital}, Less Drawings: ₹${drawings}, Net Capital: ₹${netCapital}`);
console.log(`Prior Retained Earnings: ₹${priorRetainedEarnings}`);
console.log(`Current Year Net Earnings (from P&L): ₹${currentNetEarnings}`);
console.log(`Opening Balance Offset (3300): ₹${obOffset}`);
console.log(`TOTAL EQUITY: ₹${totalEquity}`);
console.log('----------------------------------------');
console.log(`TOTAL LIABILITIES & EQUITY: ₹${totalLiabilitiesAndEquity}`);
console.log(`DIFFERENCE (Assets - Liab&Eq): ₹${totalAssets - totalLiabilitiesAndEquity}`);

assert.strictEqual(totalAssets, totalLiabilitiesAndEquity, "BALANCE SHEET DOES NOT BALANCE!");
console.log('\nMATHEMATICAL IDENTITY PROVEN PERFECTLY BALANCED: Variance = ₹0.00');
