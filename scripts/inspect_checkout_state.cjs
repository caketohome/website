const fs = require('fs');
const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/components/store/checkout/checkout-form.tsx', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(140, 160).join('\n'));

