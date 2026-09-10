const fs = require('fs');
const path = require('path');

function searchInDir(dir, terms) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && !f.name.includes('node_modules') && !f.name.includes('.next')) {
      searchInDir(full, terms);
    } else if (f.isFile() && (f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.js'))) {
      const content = fs.readFileSync(full, 'utf8');
      for (const term of terms) {
        if (content.toLowerCase().includes(term.toLowerCase())) {
          console.log(`[${term}] found in: ${full}`);
        }
      }
    }
  }
}

console.log('Searching for delivery / payment table queries...');
searchInDir('frontend/src', [
  'payment_transaction',
  'INSERT INTO "delivery"',
  'INSERT INTO delivery',
  'order_status_history',
  'branch_inventory',
]);
