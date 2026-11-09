const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/frontend/src/lib/actions/checkout.ts';
let content = fs.readFileSync(path, 'utf8');

// Update confirmCheckoutAction parameter type
content = content.replace(
  'payment_method: "cod" | "razorpay" | "test_mode" | "wallet";',
  'payment_method: "cod" | "cashfree" | "test_mode" | "wallet";'
);

// Add decommission check in confirmCheckoutAction
const confirmCheckInsert = `
  if ((payload.payment_method as string) === "razorpay") {
    return {
      success: false,
      error: "Razorpay payment gateway is decommissioned. Please select Cashfree for online payments.",
    };
  }
`;
if (!content.includes('Razorpay payment gateway is decommissioned')) {
  content = content.replace(
    'const cookieStore = cookies();',
    'const cookieStore = cookies();' + confirmCheckInsert
  );
}

// Update placeOrder paymentMethod type
content = content.replace(
  'const paymentMethod = (data.get("payment-method")?.toString() || "cod") as "cod" | "razorpay" | "test_mode";',
  'const paymentMethod = (data.get("payment-method")?.toString() || "cashfree") as "cod" | "cashfree" | "test_mode";'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated checkout.ts to Cashfree-only with Razorpay decommission guard');

