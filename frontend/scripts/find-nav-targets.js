const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../src/components/store/cms/page-renderer.tsx'), 'utf-8');
const lines = code.split('\n');
const targets = ['mega_menu', 'header', 'breadcrumbs', 'app_download', 'payment_methods', 'delivery_information', 'contact_information'];
targets.forEach(t => {
  const matches = [];
  lines.forEach((l, i) => {
    if (l.includes(t)) matches.push(i + 1);
  });
  console.log(`${t}: lines [${matches.join(', ')}]`);
});
