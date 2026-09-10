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

  // Background replacements
  content = content.replace(/bg-obsidian/g, 'bg-obsidian-base');
  
  // Cards and Elevated Surfaces
  // Where we used bg-velvet/80, bg-velvet/50, etc., let's make it the gradient.
  content = content.replace(/bg-velvet\/[0-9]+/g, 'bg-gradient-to-b from-navy-surface to-obsidian-base border border-navy-accent/50');
  content = content.replace(/bg-velvet/g, 'bg-navy-surface');
  
  // Border replacements
  content = content.replace(/border-rosegold\/[0-9]+/g, 'border-navy-accent/60');
  content = content.replace(/border-rosegold/g, 'border-navy-accent');
  content = content.replace(/hover:border-navy-accent\/60/g, 'hover:border-navy-glow');
  content = content.replace(/hover:border-navy-accent/g, 'hover:border-navy-glow');
  
  // Revert rosegold buttons if they were changed to border-navy-accent
  // Specifically we want buttons (bg-rosegold) to keep their background.
  // Wait, I didn't change bg-rosegold to navy-accent. I only changed border-rosegold.
  
  // Focus Rings
  content = content.replace(/ring-rosegold/g, 'ring-navy-glow');
  content = content.replace(/focus:border-rosegold/g, 'focus:border-navy-glow');
  
  // In inputs we should make sure they have focus:border-navy-glow
  content = content.replace(/focus:ring-navy-glow/g, 'focus:border-navy-glow focus:ring-1 focus:ring-navy-glow');

  // We need to clean up any duplicate focus:border-navy-glow classes
  content = content.replace(/focus:border-navy-glow focus:border-navy-glow/g, 'focus:border-navy-glow');
  content = content.replace(/border border-navy-accent\/50 border border-navy-accent\/50/g, 'border border-navy-accent/50');
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
