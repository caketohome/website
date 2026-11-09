const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/frontend/src/components/store/checkout/checkout-form.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace state definition
content = content.replace(
  'useState<"cod" | "razorpay" | "test_mode">("cod")',
  'useState<"cod" | "cashfree" | "test_mode">("cashfree")'
);

// Replace button onClick and styling
content = content.replace(
  'onClick={() => setPaymentMethod("razorpay")}',
  'onClick={() => setPaymentMethod("cashfree")}'
);

content = content.replaceAll(
  'paymentMethod === "razorpay"',
  'paymentMethod === "cashfree"'
);

content = content.replace(
  '<h4 className="font-bold text-xs md:text-sm text-pearl ">Online UPI / Card</h4>\n <p className="text-[11px] text-ash mt-0.5">Google Pay, PhonePe, Cards, NetBanking</p>',
  '<h4 className="font-bold text-xs md:text-sm text-pearl ">Online UPI / Card (Cashfree)</h4>\n <p className="text-[11px] text-ash mt-0.5">Google Pay, PhonePe, Cards, NetBanking via Cashfree Gateway</p>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated checkout-form.tsx to Cashfree-only payment method');

