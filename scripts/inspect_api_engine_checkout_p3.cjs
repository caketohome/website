const fs = require('fs');

const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts', 'utf8');
const p = content.indexOf('confirmCheckout');
const nextPart = content.substring(p + 3500, p + 5500);
console.log(nextPart);

