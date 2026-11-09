const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/app/api/v1/[...path]/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace Razorpay create-order message
content = content.replace(
  'Razorpay has been decommissioned for new transactions. Use Cashfree (/api/v1/payments/cashfree/create-order).',
  'Razorpay has been decommissioned. Cashfree is the sole active payment gateway.'
);

// Replace Razorpay verify-signature block with 410 Gone decommission guard
const oldVerify = '    if (path === "payments/razorpay/verify-signature" || path === "store/payments/razorpay/verify-signature") {';
const nextBlockStart = '    if (path === "payments/razorpay/webhook" || path === "payments/webhook" || path === "store/payments/webhook") {';

const idx1 = content.indexOf(oldVerify);
const idx2 = content.indexOf(nextBlockStart);
if (idx1 !== -1 && idx2 !== -1) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const replacementVerify = '    if (path === "payments/razorpay/verify-signature" || path === "store/payments/razorpay/verify-signature") {' + eol +
    '      return jsonWithDataSource(' + eol +
    '        {' + eol +
    '          success: false,' + eol +
    '          error: "RAZORPAY_DECOMMISSIONED",' + eol +
    '          message: "Razorpay has been decommissioned. Cashfree is the sole active payment gateway.",' + eol +
    '        },' + eol +
    '        "postgres",' + eol +
    '        410' + eol +
    '      );' + eol +
    '    }' + eol + eol;
  content = content.substring(0, idx1) + replacementVerify + content.substring(idx2);
  console.log('Successfully replaced razorpay verify-signature block');
} else {
  console.error('Failed to locate verify block', { idx1, idx2 });
}

// Replace Razorpay webhook block with 410 Gone decommission guard
const oldWebhook = '    if (path === "payments/razorpay/webhook" || path === "payments/webhook" || path === "store/payments/webhook") {';
const nextOrderStart = '    if (path === "orders" || path === "admin/orders") {';

const widx1 = content.indexOf(oldWebhook);
const widx2 = content.indexOf(nextOrderStart);
if (widx1 !== -1 && widx2 !== -1) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const replacementWebhook = '    if (path === "payments/razorpay/webhook" || path === "payments/webhook" || path === "store/payments/webhook") {' + eol +
    '      return jsonWithDataSource(' + eol +
    '        {' + eol +
    '          success: false,' + eol +
    '          error: "RAZORPAY_DECOMMISSIONED",' + eol +
    '          message: "Razorpay has been decommissioned. Cashfree is the sole active payment gateway.",' + eol +
    '        },' + eol +
    '        "postgres",' + eol +
    '        410' + eol +
    '      );' + eol +
    '    }' + eol + eol;
  content = content.substring(0, widx1) + replacementWebhook + content.substring(widx2);
  console.log('Successfully replaced razorpay webhook block');
} else {
  console.error('Failed to locate webhook block', { widx1, widx2 });
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated route.ts successfully');

