const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/frontend/src/lib/services/cashfree-payment.service.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replaceAll("'branch_koramangala'", "'br_indiranagar_01'");
fs.writeFileSync(path, content, 'utf8');
console.log('Updated branch_id to br_indiranagar_01 in cashfree-payment.service.ts');

