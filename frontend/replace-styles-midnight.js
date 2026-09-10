const fs = require('fs');
const glob = require('glob');

// Use node's glob to find all tsx files in components/store
// We don't have glob installed globally perhaps? Let's use simple find and replace via node if possible, or just specify the array of files.

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

  // Background replacements
  content = content.replace(/bg-alabaster/g, 'bg-obsidian');
  content = content.replace(/bg-white/g, 'bg-velvet');
  
  // Border replacements
  content = content.replace(/border-blush\/[0-9]+/g, 'border-rosegold/20');
  content = content.replace(/border-blush/g, 'border-rosegold/30');
  
  // Text replacements
  content = content.replace(/text-taupe/g, 'text-pearl');
  content = content.replace(/text-stone/g, 'text-ash');
  
  // Specific bg-taupe buttons should become bg-rosegold or bg-velvet
  content = content.replace(/bg-taupe/g, 'bg-rosegold');
  
  // Specific bg-blush -> bg-rosegold/20
  content = content.replace(/bg-blush/g, 'bg-rosegold/20');

  // Ring replacements
  content = content.replace(/ring-taupe/g, 'ring-rosegold');
  
  // Stroke/Fill replacements
  content = content.replace(/stroke-taupe/g, 'stroke-pearl');
  content = content.replace(/fill-taupe/g, 'fill-pearl');
  content = content.replace(/stroke-blush/g, 'stroke-rosegold/40');
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
