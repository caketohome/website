const fs = require('fs');
const content = fs.readFileSync('src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('accounting_account')) {
    console.log(`${idx + 1}: ${l}`);
  }
});
