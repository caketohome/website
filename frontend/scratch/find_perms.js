const fs = require('fs');
const content = fs.readFileSync('src/lib/staff-access-control.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('ACCOUNTING.') || l.includes('COST_CENTRE.') || l.includes('JOURNAL.')) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
