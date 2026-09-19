const fs = require('fs');
const content = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
content.split('\n').forEach((l, i) => {
  if (l.includes('/cart') || l.includes('cart') && (l.includes('POST') || l.includes('PATCH') || l.includes('DELETE'))) {
    console.log((i+1) + ': ' + l.trim());
  }
});
