const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/lib/actions/checkout.ts');
let content = fs.readFileSync(filePath, 'utf8');
const eol = content.includes('\r\n') ? '\r\n' : '\n';

const targetRedirect = '  if (!result.success) {' + eol +
  '    return { message: result.error || "Failed to place order. Please verify your details." };' + eol +
  '  }' + eol + eol +
  '  redirect(`/your-order?order_id=${encodeURIComponent(result.order_id || "")}`);';

const newRedirect = '  if (!result.success) {' + eol +
  '    return { message: result.error || "Failed to place order. Please verify your details." };' + eol +
  '  }' + eol + eol +
  '  if (paymentMethod === "cashfree") {' + eol +
  '    const orderId = result.order_id || "";' + eol +
  '    const amount = Number(result.pricing?.grand_total || result.total || 525);' + eol +
  '    redirect(`/checkout/cashfree?order_id=${encodeURIComponent(orderId)}&amount=${amount}`);' + eol +
  '  }' + eol + eol +
  '  redirect(`/your-order?order_id=${encodeURIComponent(result.order_id || "")}`);';

if (content.includes(targetRedirect)) {
  content = content.replace(targetRedirect, newRedirect);
  console.log('Successfully replaced redirect block in checkout.ts');
} else {
  console.log('Using regex for redirect replacement...');
  content = content.replace(
    /if \(!result\.success\) \{\s*return \{ message: result\.error \|\| "Failed to place order\. Please verify your details\." \};\s*\}\s*redirect\(`\/your-order\?order_id=\$\{encodeURIComponent\(result\.order_id \|\| ""\)\}`\);/,
    `if (!result.success) {${eol}    return { message: result.error || "Failed to place order. Please verify your details." };${eol}  }${eol}${eol}  if (paymentMethod === "cashfree") {${eol}    const orderId = result.order_id || "";${eol}    const amount = Number(result.pricing?.grand_total || result.total || 525);${eol}    redirect(\`/checkout/cashfree?order_id=\${encodeURIComponent(orderId)}&amount=\${amount}\`);${eol}  }${eol}${eol}  redirect(\`/your-order?order_id=\${encodeURIComponent(result.order_id || "")}\`);`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated checkout.ts successfully');

