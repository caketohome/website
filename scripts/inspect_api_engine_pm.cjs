const fs = require('fs');

const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('payment_method') || l.includes('paymentMethod')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});

