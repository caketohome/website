const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/lib/api-client.ts');
let content = fs.readFileSync(filePath, 'utf8');
const eol = content.includes('\r\n') ? '\r\n' : '\n';

content = content.replace(
  'payment_method: "cod" | "razorpay" | "test_mode" | "wallet";',
  'payment_method: "cod" | "cashfree" | "test_mode" | "wallet";'
);

const oldRzpMethods = '  // ── Razorpay Payment APIs ──' + eol +
  '  async createRazorpayOrder(amount: number, currency = "INR", receipt?: string) {' + eol +
  '    return this.request("/payments/razorpay/create-order", {' + eol +
  '      method: "POST",' + eol +
  '      body: JSON.stringify({ amount, currency, receipt }),' + eol +
  '    });' + eol +
  '  }' + eol + eol +
  '  async verifyRazorpaySignature(payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {' + eol +
  '    return this.request("/payments/razorpay/verify-signature", {' + eol +
  '      method: "POST",' + eol +
  '      body: JSON.stringify(payload),' + eol +
  '    });' + eol +
  '  }';

const newCfMethods = '  // ── Cashfree Payment APIs (Sole Active Online Gateway) ──' + eol +
  '  async createCashfreeOrder(payload: {' + eol +
  '    order_id: string;' + eol +
  '    amount: number;' + eol +
  '    currency?: string;' + eol +
  '    customer_id?: string;' + eol +
  '    customer_phone?: string;' + eol +
  '    customer_name?: string;' + eol +
  '    customer_email?: string;' + eol +
  '  }) {' + eol +
  '    return this.request("/payments/cashfree/create-order", {' + eol +
  '      method: "POST",' + eol +
  '      body: JSON.stringify(payload),' + eol +
  '    });' + eol +
  '  }' + eol + eol +
  '  // Legacy decommission stubs' + eol +
  '  async createRazorpayOrder() {' + eol +
  '    throw new Error("Razorpay has been decommissioned. Cashfree is the sole active payment gateway.");' + eol +
  '  }' + eol + eol +
  '  async verifyRazorpaySignature() {' + eol +
  '    throw new Error("Razorpay has been decommissioned. Cashfree is the sole active payment gateway.");' + eol +
  '  }';

if (content.includes('// ── Razorpay Payment APIs ──')) {
  content = content.replace(oldRzpMethods, newCfMethods);
  console.log('Replaced Razorpay methods with Cashfree methods in api-client.ts');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated api-client.ts successfully');

