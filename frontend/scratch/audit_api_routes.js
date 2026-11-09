const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '../src/app/api/v1/[...path]/route.ts');
const content = fs.readFileSync(routePath, 'utf8');
const lines = content.split('\n');

const modules = [
  'products',
  'inventory',
  'cart',
  'orders',
  'billing',
  'invoices',
  'accounting',
  'reports',
  'partners',
  'delivery',
  'branches',
  'customers'
];

console.log('Total lines in route.ts:', lines.length);

const findings = {};

modules.forEach(m => {
  findings[m] = [];
});

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  const trimmed = line.trim();
  modules.forEach(m => {
    if (trimmed.includes(`"${m}"`) || trimmed.includes(`"${m}/`) || trimmed.includes(`admin/${m}`) || trimmed.includes(`manager/${m}`)) {
      if (trimmed.startsWith('if (') || trimmed.startsWith('} else if (') || trimmed.startsWith('case ') || trimmed.includes('path ===') || trimmed.includes('path.startsWith')) {
        findings[m].push({ line: lineNum, text: trimmed });
      }
    }
  });
});

Object.keys(findings).forEach(m => {
  console.log(`\n=== Module: ${m} (${findings[m].length} route conditions) ===`);
  findings[m].slice(0, 10).forEach(f => console.log(`  Line ${f.line}: ${f.text}`));
  if (findings[m].length > 10) console.log(`  ... and ${findings[m].length - 10} more`);
});
