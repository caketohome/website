const fs = require('fs');
const content = fs.readFileSync('cakes2home-main/cakes2home-main/frontend/src/components/store/checkout/checkout-form.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('razorpay') || l.includes('paymentMethod') || l.includes('payment_method') || l.includes('cashfree')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});

