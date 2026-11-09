const fs = require('fs');
const content = fs.readFileSync('src/lib/types/accounting.types.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.toLowerCase().includes('account') && (l.includes('interface') || l.includes('type ') || l.includes('class ') || l.includes('function '))) {
    console.log(`${idx + 1}: ${l}`);
  }
});
