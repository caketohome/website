const fs = require('fs');

const files = [
  './src/components/store/home/luxury-storefront.tsx',
  './src/components/store/catalog/product-card.tsx',
  './src/components/store/shop/product-detail-client.tsx',
  './src/components/store/cart/cart-modal.tsx',
  './src/components/store/checkout/checkout-form.tsx',
  './src/components/store/checkout/order-summary.tsx',
  './src/components/store/account/order-detail-client.tsx',
  './src/components/store/account/order-tracking-client.tsx',
  './src/app/(checkout)/your-order/page.tsx',
  './src/app/(store)/page.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/rosegold\/20\/[0-9]+/g, 'rosegold/30');
  content = content.replace(/border-white/g, 'border-rosegold/20');
  content = content.replace(/shadow-\[0_20px_40px_rgba\(74,68,65,0\.08\)\]/g, 'shadow-[0_20px_40px_rgba(183,110,121,0.08)]');
  
  fs.writeFileSync(file, content);
  console.log(`Cleaned ${file}`);
});
