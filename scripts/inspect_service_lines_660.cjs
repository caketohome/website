const fs = require('fs');

const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/services/payment-verification.service.ts', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(660, 715).join('\n'));

