const path = require('path');
const fs = require('fs');
const testFile = 'E:/vig/cakes2home-main/cakes2home-main/scripts/test_bank_cash_management.cjs';
let content = fs.readFileSync(testFile, 'utf8');

content = content.replace(
  'await client.query("DELETE FROM public.accounting_account WHERE code LIKE \'1112-99%\' OR code LIKE \'1112-t%\';");',
  'await client.query("DELETE FROM public.bank_transaction WHERE description LIKE \'%Test%\' OR description LIKE \'%test%\';");\n    await client.query("DELETE FROM public.bank_transfer WHERE description LIKE \'%Test%\' OR description LIKE \'%test%\';");\n    await client.query("DELETE FROM public.bank_account WHERE account_name LIKE \'%Test%\' OR account_name LIKE \'%test%\';");\n    await client.query("DELETE FROM public.accounting_account WHERE name LIKE \'%Test%\' OR name LIKE \'%test%\';");'
);

fs.writeFileSync(testFile, content, 'utf8');
console.log('Fixed cleanup order in test suite!');
