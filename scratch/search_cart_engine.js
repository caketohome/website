const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../frontend/src/lib/api-engine.ts'), 'utf8');
const lines = content.split('\n');
const cartLines = [];
lines.forEach((l, i) => {
  if (l.includes('addToCart') || l.includes('addItemToCart') || l.includes('saveCart') || l.includes('getCart') || l.includes('cart_line_item') || l.includes('cart') && l.includes('static ')) {
    cartLines.push(`Line ${i + 1}: ${l.trim()}`);
  }
});
console.log(`Found ${cartLines.length} matches:`);
console.log(cartLines.slice(0, 50).join('\n'));
