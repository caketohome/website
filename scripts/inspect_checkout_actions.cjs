const fs = require('fs');
const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/lib/actions/checkout.ts', 'utf8');
console.log(content.substring(0, 2000));

