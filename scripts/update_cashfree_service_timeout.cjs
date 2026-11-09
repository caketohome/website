const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/lib/services/cashfree-payment.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'body: JSON.stringify(requestPayload),',
  'body: JSON.stringify(requestPayload),\n        signal: AbortSignal.timeout(3000),'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added timeout signal to Cashfree fetch');

