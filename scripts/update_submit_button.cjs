const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/components/store/checkout/checkout-form.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const eol = content.includes('\r\n') ? '\r\n' : '\n';

content = content.replace(
  'function Submit({ disabled }: { disabled?: boolean }) {',
  'function Submit({ disabled, paymentMethod }: { disabled?: boolean; paymentMethod?: string }) {'
);

content = content.replace(
  '  Place Order Now 🎂' + eol + '  </Button>',
  '  {paymentMethod === "cashfree"' + eol +
  '    ? "Proceed to Cashfree Payment 💳"' + eol +
  '    : paymentMethod === "cod"' + eol +
  '    ? "Confirm Cash on Delivery 💵"' + eol +
  '    : "Place Order Now 🎂"}' + eol +
  '  </Button>'
);

content = content.replace(
  '<Submit disabled={isSubmitDisabled} />',
  '<Submit disabled={isSubmitDisabled} paymentMethod={paymentMethod} />'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated checkout-form.tsx button successfully');

