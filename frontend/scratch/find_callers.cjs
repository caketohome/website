const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '.next' && entry.name !== 'dist') {
        searchDir(fullPath, pattern, results);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.cjs'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          results.push({
            file: path.relative('e:/vig/cakes2home-main/cakes2home-main', fullPath).replace(/\\/g, '/'),
            line: idx + 1,
            text: line.trim()
          });
        }
      });
    }
  }
  return results;
}

const terms = [
  { name: 'generateInvoiceOnDelivery', regex: /generateInvoiceOnDelivery/ },
  { name: 'allocateInvoiceNumber', regex: /allocateInvoiceNumber/ },
  { name: 'InvoiceQueueService', regex: /InvoiceQueueService/ },
  { name: 'allocate_invoice_number', regex: /allocate_invoice_number/ },
];

for (const t of terms) {
  console.log(`\n=== Pattern: ${t.name} ===`);
  const matches = searchDir('e:/vig/cakes2home-main/cakes2home-main/frontend/src', t.regex);
  matches.forEach(m => console.log(`${m.file}:${m.line}: ${m.text}`));
}
