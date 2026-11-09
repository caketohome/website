const path = require('path');
const fs = require('fs');
const testFile = 'E:/vig/cakes2home-main/cakes2home-main/scripts/test_bank_cash_management.cjs';
let content = fs.readFileSync(testFile, 'utf8');

// Replace code generation
content = content.replace("`1112-99`", "`1112-t${Date.now().toString().slice(-4)}`");
// Also clean up 1112-99 before test
content = content.replace(
  "const offsetRes = await client.query(\"SELECT id FROM public.accounting_account WHERE code = '3300' LIMIT 1;\");",
  "await client.query(\"DELETE FROM public.accounting_account WHERE code LIKE '1112-99%' OR code LIKE '1112-t%';\");\n    const offsetRes = await client.query(\"SELECT id FROM public.accounting_account WHERE code = '3300' LIMIT 1;\");"
);

fs.writeFileSync(testFile, content, 'utf8');
console.log('Fixed test code collision!');
