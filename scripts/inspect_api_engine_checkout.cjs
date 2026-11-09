const fs = require('fs');

const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/api-engine.ts', 'utf8');
const p = content.indexOf('confirmCheckout');
console.log(content.substring(p, p + 2000));

