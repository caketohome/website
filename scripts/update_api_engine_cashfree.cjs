const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/lib/api-engine.ts');
let content = fs.readFileSync(filePath, 'utf8');
const eol = content.includes('\r\n') ? '\r\n' : '\n';

// 1. Clean accidental payload check in get memoryStore()
content = content.replace(/static get memoryStore\(\)\s*\{[\s\r\n]*if \(\(payload\.payment_method as string\) === "razorpay"\)[\s\S]*?ApiEngine\.ensureOrdersStore\(\);/, 'static get memoryStore() {' + eol + '    ApiEngine.ensureOrdersStore();');

// 2. Update PaymentSettings interface
content = content.replace(
  'supported_methods: Array<"cod" | "razorpay" | "wallet" | "test_mode">;',
  'supported_methods: Array<"cod" | "cashfree" | "wallet" | "test_mode">;'
);
content = content.replace(
  'razorpay_key_id?: string;',
  'cashfree_app_id?: string;'
);

// 3. Update DEFAULT_PAYMENT_SETTINGS
content = content.replace(
  'supported_methods: ["cod", "razorpay", "test_mode", "wallet"],',
  'supported_methods: ["cod", "cashfree", "test_mode", "wallet"],'
);
content = content.replace(
  'razorpay_key_id: "rzp_test_placeholder_key",',
  'cashfree_app_id: "TEST_CF_APP_ID",'
);

// 4. Update confirmCheckout to guard against Razorpay
const bodyAnchor = '    // 1. Revalidate everything authoritatively on server';
const guardCode = '    if ((payload.payment_method as string) === "razorpay") {' + eol +
  '      return {' + eol +
  '        success: false,' + eol +
  '        statusCode: 410,' + eol +
  '        error: "Razorpay has been decommissioned. Cashfree is the sole active payment gateway.",' + eol +
  '      };' + eol +
  '    }' + eol + eol +
  '    // 1. Revalidate everything authoritatively on server';

if (content.includes(bodyAnchor) && !content.includes('Razorpay has been decommissioned')) {
  content = content.replace(bodyAnchor, guardCode);
  console.log('Added decommission guard in confirmCheckout');
}

// 5. Update transaction_id assignment in confirmCheckout
content = content.replace(
  'payload.payment_details?.razorpay_payment_id || `TXN_${Date.now()}`',
  'payload.payment_details?.cf_payment_id || payload.payment_details?.payment_id || `TXN_CF_${Date.now()}`'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated frontend/src/lib/api-engine.ts');
