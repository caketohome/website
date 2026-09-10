const fs = require('fs');

const files = [
  './src/components/store/checkout/checkout-form.tsx',
  './src/components/store/checkout/order-summary.tsx',
  './src/components/store/account/order-detail-client.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Colors
  content = content.replace(/rose-600/g, 'taupe');
  content = content.replace(/rose-500/g, 'taupe');
  content = content.replace(/rose-400/g, 'taupe');
  content = content.replace(/rose-50/g, 'alabaster');
  content = content.replace(/rose-900/g, 'taupe');
  content = content.replace(/rose-950/g, 'taupe');
  content = content.replace(/rose-100/g, 'blush');
  content = content.replace(/rose-200/g, 'blush/50');
  
  content = content.replace(/zinc-900/g, 'taupe');
  content = content.replace(/zinc-800/g, 'taupe');
  content = content.replace(/zinc-700/g, 'taupe');
  content = content.replace(/zinc-600/g, 'stone');
  content = content.replace(/zinc-500/g, 'stone');
  content = content.replace(/zinc-400/g, 'stone/70');
  content = content.replace(/zinc-300/g, 'blush');
  content = content.replace(/zinc-200/g, 'blush/40');
  content = content.replace(/zinc-100/g, 'blush/30');
  content = content.replace(/zinc-50/g, 'alabaster');

  // Remove dark mode classes
  content = content.replace(/dark:[a-zA-Z0-9-\/]+/g, '');
  
  // Fix multiple spaces that might result from removing dark mode
  content = content.replace(/ +/g, ' ');

  // Border radii
  content = content.replace(/rounded-xl/g, 'rounded-2xl');
  content = content.replace(/rounded-lg/g, 'rounded-xl');
  content = content.replace(/rounded-md/g, 'rounded-xl');

  // Buttons
  // Some buttons might have "bg-taupe hover:bg-taupe text-white font-bold".
  // The client likes uppercase tracking-widest for buttons.
  // We'll leave the classes as they are mostly but maybe change font-bold to font-medium uppercase tracking-[0.15em]
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
