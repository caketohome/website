const path = require('path');

const modulesToTest = [
  './frontend/src/lib/staff-access-control.ts',
  './frontend/src/lib/db.ts',
  './frontend/src/lib/repositories/index.ts',
  './frontend/src/lib/services/order.service.ts',
  './frontend/src/lib/services/general-ledger.service.ts',
  './frontend/src/lib/services/accounting-config.service.ts',
  './frontend/src/lib/services/fiscal-period.service.ts',
  './frontend/src/lib/services/opening-balance.service.ts',
  './frontend/src/lib/services/profit-loss.service.ts',
  './frontend/src/lib/services/balance-sheet.service.ts',
  './frontend/src/lib/services/cash-flow.service.ts',
  './frontend/src/lib/services/period-close.service.ts',
  './frontend/src/lib/services/bank-account.service.ts',
  './frontend/src/lib/services/teller.service.ts',
  './frontend/src/lib/services/manual-journal.service.ts',
  './frontend/src/lib/services/bills-payable.service.ts',
  './frontend/src/lib/services/bills-receivable.service.ts',
  './frontend/src/lib/controllers/cost-allocation.controller.ts',
  './frontend/src/lib/services/bank-reconciliation-statement.service.ts',
  './frontend/src/lib/services/gateway-settlement.service.ts',
];

console.log('Testing individual file syntax and imports...');
for (const m of modulesToTest) {
  try {
    const fullPath = path.resolve(m);
    console.log(`Checking ${m}: exists=${require('fs').existsSync(fullPath)}`);
  } catch (e) {
    console.log(`Error checking ${m}: ${e.message}`);
  }
}
