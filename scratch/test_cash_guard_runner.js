const path = require('path');
const jiti = require(path.resolve(__dirname, '../frontend/node_modules/jiti'))(__filename);
const { ExpensePostingService } = jiti(path.resolve(__dirname, '../frontend/src/lib/services/expense-posting.service.ts'));
console.log('ExpensePostingService loaded:', typeof ExpensePostingService.postExpenseToGL);
