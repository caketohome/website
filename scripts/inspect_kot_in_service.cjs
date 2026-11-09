const fs = require('fs');

const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/services/payment-verification.service.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('KOT') || l.includes('kot') || l.includes('kitchen')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});

