const fs = require('fs');

const services = [
  'src/lib/services/expense-posting.service.ts',
  'src/lib/services/purchase-posting.service.ts',
  'src/lib/services/sales-posting.service.ts',
  'src/lib/services/petty-cash.service.ts',
  'src/lib/services/customer-receipt.service.ts',
  'src/lib/services/purchase-payment.service.ts',
  'src/lib/services/bills-payable.service.ts',
  'src/lib/services/bills-receivable.service.ts',
  'src/lib/services/posting.service.ts',
  'src/lib/services/branch-cash.service.ts',
  'src/lib/services/bank-deposit-slip.service.ts',
  'src/lib/services/gateway-settlement.service.ts',
  'src/lib/services/cod-collection.service.ts',
  'src/lib/services/manual-journal.service.ts'
];

console.log("=== INSPECTING COST CENTRE PROPAGATION IN POSTING SERVICES ===");

for (const s of services) {
  if (fs.existsSync(s)) {
    const content = fs.readFileSync(s, 'utf8');
    const hasCC = content.includes('cost_centre_id');
    const lines = content.split('\n');
    const matchingLines = [];
    lines.forEach((l, idx) => {
      if (l.includes('cost_centre_id')) {
        matchingLines.push(`${idx + 1}: ${l.trim()}`);
      }
    });
    console.log(`\nService: ${s}`);
    console.log(`  Mentions cost_centre_id: ${hasCC} (occurrences: ${matchingLines.length})`);
    if (matchingLines.length > 0) {
      matchingLines.slice(0, 5).forEach(m => console.log(`    ${m}`));
    }
  } else {
    console.log(`\nService: ${s} - NOT FOUND`);
  }
}
