const fs = require('fs');

const services = [
  { name: 'Manual Journal', file: 'src/lib/services/manual-journal.service.ts' },
  { name: 'Expense Posting', file: 'src/lib/services/expense-posting.service.ts' },
  { name: 'Purchase Posting', file: 'src/lib/services/purchase-posting.service.ts' },
  { name: 'Sales Posting', file: 'src/lib/services/sales-posting.service.ts' },
  { name: 'Petty Cash', file: 'src/lib/services/petty-cash.service.ts' },
  { name: 'Customer Receipt', file: 'src/lib/services/customer-receipt.service.ts' },
  { name: 'Purchase Payment', file: 'src/lib/services/purchase-payment.service.ts' },
  { name: 'Bills Payable', file: 'src/lib/services/bills-payable.service.ts' },
  { name: 'Bills Receivable', file: 'src/lib/services/bills-receivable.service.ts' },
  { name: 'Branch Cash', file: 'src/lib/services/branch-cash.service.ts' },
  { name: 'Bank Deposit Slip', file: 'src/lib/services/bank-deposit-slip.service.ts' },
  { name: 'Gateway Settlement', file: 'src/lib/services/gateway-settlement.service.ts' },
  { name: 'COD Collection', file: 'src/lib/services/cod-collection.service.ts' },
  { name: 'Period Close', file: 'src/lib/services/period-close.service.ts' },
  { name: 'Opening Balance', file: 'src/lib/services/opening-balance.service.ts' }
];

console.log("=== SCANNING POSTING SERVICES FOR ACCOUNT CODES / CONFIGURATION ===");

services.forEach(s => {
  if (fs.existsSync(s.file)) {
    const content = fs.readFileSync(s.file, 'utf8');
    // find 4-digit account code patterns like '1111', '2111', etc.
    const matches = content.match(/['"]\b[1-5]\d{3}\b['"]/g) || [];
    const uniqueCodes = Array.from(new Set(matches.map(m => m.replace(/['"]/g, ''))));
    console.log(`\n${s.name} (${s.file}):`);
    console.log(`  Explicit codes: ${uniqueCodes.join(', ') || 'None found (may use config/lookup)'}`);
  }
});
