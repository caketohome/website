const fs = require('fs');
const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/actions/checkout.ts', 'utf8');
const p = content.indexOf('paymentMethod');
console.log(content.substring(p, p + 2500));

